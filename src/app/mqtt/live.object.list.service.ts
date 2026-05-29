import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import mqtt from "mqtt";

import { MqttService } from "./mqtt.service";

interface LiveObjectListEntry<R extends { id: number } = any> {
  subject: BehaviorSubject<R[]>;
  refCount: number;
  topicFilters: string[];
  deserialize: (buf: Buffer) => R;
  subscribedFilters: Set<string>;
}

@Injectable({ providedIn: 'root' })
export class LiveObjectListService {

  private topicSubscriptionMap = new Map<string, LiveObjectListEntry>();

  private messageListenerAttached = false;
  private connectionListenersAttached = false;

  constructor(
    private mqtt: MqttService
  ) { }

  subscribeToTopicTree$<R extends { id: number }>(
    client: mqtt.MqttClient,
    topicFilters: string[],
    deserialize: (buf: Buffer) => R
  ): Observable<R[]> {

    this.ensureListener(client);

    return new Observable<R[]>(observer => {
      const entry = this.getOrCreateEntry(client, topicFilters, deserialize);

      entry.refCount++;
      console.log(
        `LiveObjectListService.subscribeToTopicTree$: SUBSCRIBE '${this.mapKey(topicFilters)}', refCount incremented to ${entry.refCount}`
      );

      const subscription = entry.subject.subscribe(observer);

      return () => {
        subscription.unsubscribe();
        this.releaseTopicTreeReference(client, topicFilters, entry);
      };
    });
  }

  unsubscribeTopicTree(topicFilters: string[]): void {
    console.log(`LiveObjectListService.unsubscribeTopicTree: topicFilters: ${topicFilters}`);

    const mapKey = this.mapKey(topicFilters);
    const entry = this.topicSubscriptionMap.get(mapKey);

    if (!entry) {
      console.warn(`LiveObjectListService.unsubscribeTopicTree: topic tree '${mapKey}' not found`);
      return;
    }

    this.mqtt.getConnection().then(client => {
      this.unsubscribeAndDeleteTopicTree(client, topicFilters, entry, true);

      console.log(
        `LiveObjectListService.unsubscribeTopicTree: ListenerCount after UNSUBSCRIBE '${topicFilters}':`,
        client.listenerCount('message')
      );
    }).catch(err => {
      console.error(`LiveObjectListService.unsubscribeTopicTree: failed to get MQTT connection`, err);
    });
  }

  /**
   * Attach one MQTT message listener for the whole service.
   *
   * Individual topic-tree subscriptions are still made per filter, but incoming MQTT
   * messages are dispatched through this single listener rather than adding one
   * client.on('message', ...) handler per topic tree.
   */
  private ensureListener(client: mqtt.MqttClient): void {
    if (!this.messageListenerAttached) {
      console.log(`LiveObjectListService.ensureListener: attaching MQTT message dispatcher`);

      client.on('message', this.liveObjectListDispatcher.bind(this));
      this.messageListenerAttached = true;

      console.log(
        `LiveObjectListService.ensureListener: ListenerCount after attaching dispatcher:`,
        client.listenerCount('message')
      );
    }

    if (!this.connectionListenersAttached) {
      client.on('connect', (connack: any) => {
        console.log(
          `LiveObjectListService.ensureListener: [MQTT] connect seen in LiveObjectListService sessionPresent=${connack?.sessionPresent}`
        );
        this.resubscribeAll(client);
      });

      client.on('reconnect', () => {
        console.log(`LiveObjectListService.ensureListener: [MQTT] reconnecting (LiveObjectListService)`);
      });

      this.connectionListenersAttached = true;
    }
  }

  /**
   * Single MQTT message dispatcher for all live object-list topic trees.
   */
  private liveObjectListDispatcher(messageTopic: string, payload: Buffer): void {
    for (const [mapKey, entry] of this.topicSubscriptionMap.entries()) {
      if (!this.topicMatchesFilters(messageTopic, entry.topicFilters)) {
        continue;
      }

      this.applyMessageToEntry(mapKey, entry, messageTopic, payload);
    }
  }

  private applyMessageToEntry<R extends { id: number }>(
    mapKey: string,
    entry: LiveObjectListEntry<R>,
    messageTopic: string,
    payload: Buffer
  ): void {

    const current = entry.subject.getValue();

    // Handle retained delete / tombstone message.
    if (!payload || payload.byteLength === 0) {
      const id = this.extractIdFromTopic(messageTopic);

      if (id !== null) {
        console.log(`LiveObjectListService.liveObjectListDispatcher: Handle delete for: ${messageTopic}`);
        entry.subject.next(current.filter(item => item.id !== id));
      }

      return;
    }

    try {
      const value = entry.deserialize(payload);
      const index = current.findIndex(item => item.id === value.id);
      const updated = [...current];

      if (index !== -1) {
        updated[index] = value;
      } else {
        updated.push(value);
      }

      updated.sort((a, b) => {
        const aSeq = (a as any).sequence;
        const bSeq = (b as any).sequence;

        if (typeof aSeq === 'number' && typeof bSeq === 'number') {
          return aSeq - bSeq;
        }

        return a.id - b.id;
      });

      entry.subject.next(updated);

    } catch (err) {
      console.error(
        `LiveObjectListService.liveObjectListDispatcher: failed to parse message on ${messageTopic} for ${mapKey}`,
        err
      );
    }
  }

  private getOrCreateEntry<R extends { id: number }>(
    client: mqtt.MqttClient,
    topicFilters: string[],
    deserialize: (buf: Buffer) => R
  ): LiveObjectListEntry<R> {

    const mapKey = this.mapKey(topicFilters);
    const existing = this.topicSubscriptionMap.get(mapKey) as LiveObjectListEntry<R> | undefined;
    if (existing) return existing;

    const entry: LiveObjectListEntry<R> = {
      subject: new BehaviorSubject<R[]>([]),
      refCount: 0,
      topicFilters: [...topicFilters],
      deserialize,
      subscribedFilters: new Set<string>()
    };

    this.topicSubscriptionMap.set(mapKey, entry);
    this.subscribeToTopicFilters(client, mapKey, entry);

    return entry;
  }

  private subscribeToTopicFilters(
    client: mqtt.MqttClient,
    mapKey: string,
    entry: LiveObjectListEntry
  ): void {

    entry.topicFilters.forEach(topicFilter => {
      console.log(
        `LiveObjectListService.subscribeToTopicFilters: [MQTT] SUBSCRIBE -> ${topicFilter} (client.connected=${client.connected})`
      );

      client.subscribe(topicFilter, { qos: 1 }, err => {
        const latest = this.topicSubscriptionMap.get(mapKey);
        if (latest !== entry) return;

        console.log(`LiveObjectListService.subscribeToTopicFilters: [MQTT] SUBSCRIBE ACK <- ${topicFilter}`, { err });

        if (err) {
          console.error(`LiveObjectListService.subscribeToTopicFilters: failed to subscribe to ${topicFilter}`, err);
          entry.subject.error(err);
          this.topicSubscriptionMap.delete(mapKey);
          return;
        }

        entry.subscribedFilters.add(topicFilter);

        console.log(
          `LiveObjectListService.subscribeToTopicFilters: subscribed to '${topicFilter}' using shared dispatcher`
        );
        console.log(
          `LiveObjectListService.subscribeToTopicFilters: ListenerCount after subscribeToTopicTree:`,
          client.listenerCount('message')
        );
      });
    });
  }

  private releaseTopicTreeReference(
    client: mqtt.MqttClient,
    topicFilters: string[],
    entry: LiveObjectListEntry
  ): void {

    const mapKey = this.mapKey(topicFilters);
    const current = this.topicSubscriptionMap.get(mapKey);
    if (current !== entry) return;

    entry.refCount--;
    console.log(
      `LiveObjectListService.releaseTopicTreeReference: UNSUBSCRIBE '${mapKey}', refCount decremented to ${entry.refCount}`
    );

    if (entry.refCount <= 0) {
      this.unsubscribeAndDeleteTopicTree(client, topicFilters, entry, false);
    }
  }

  private unsubscribeAndDeleteTopicTree(
    client: mqtt.MqttClient,
    topicFilters: string[],
    entry: LiveObjectListEntry,
    completeSubject: boolean
  ): void {

    const mapKey = this.mapKey(topicFilters);
    const current = this.topicSubscriptionMap.get(mapKey);
    if (current !== entry) return;

    this.topicSubscriptionMap.delete(mapKey);

    if (completeSubject) {
      entry.subject.complete();
    }

    entry.topicFilters.forEach(topicFilter => {
      console.log(`LiveObjectListService.unsubscribeAndDeleteTopicTree: [MQTT] UNSUBSCRIBE -> ${topicFilter}`);

      client.unsubscribe(topicFilter, err => {
        if (err) {
          console.error(
            `LiveObjectListService.unsubscribeAndDeleteTopicTree: failed to unsubscribe '${topicFilter}'`,
            err
          );
          return;
        }

        console.log(`LiveObjectListService.unsubscribeAndDeleteTopicTree: unsubscribed '${topicFilter}'`);
        console.log(
          `LiveObjectListService.unsubscribeAndDeleteTopicTree: ListenerCount after unsubscribeTopicTree cleanup:`,
          client.listenerCount('message')
        );
      });
    });
  }

  private resubscribeAll(client: mqtt.MqttClient): void {
    for (const [mapKey, entry] of this.topicSubscriptionMap.entries()) {
      if (entry.refCount <= 0) continue;

      entry.topicFilters.forEach(topicFilter => {
        console.log(
          `LiveObjectListService.resubscribeAll: [MQTT] RESUBSCRIBE -> ${topicFilter} refCount=${entry.refCount}`
        );

        client.subscribe(topicFilter, { qos: 1 }, (err: any) => {
          console.log(`LiveObjectListService.resubscribeAll: [MQTT] RESUBSCRIBE ACK <- ${topicFilter}`, { err });

          if (err) {
            entry.subject.error(err);
            this.topicSubscriptionMap.delete(mapKey);
            return;
          }

          entry.subscribedFilters.add(topicFilter);
        });
      });
    }
  }

  private topicMatchesFilters(topic: string, filters: string[]): boolean {
    return filters.some(filter => this.topicMatchesFilter(topic, filter));
  }

  /** Robust MQTT topic filter matching. */
  private topicMatchesFilter(topic: string, filter: string): boolean {
    const topicLevels = topic.split('/');
    const filterLevels = filter.split('/');

    for (let i = 0; i < filterLevels.length; i++) {
      const f = filterLevels[i];
      const t = topicLevels[i];

      if (f === '#') {
        return true; // Multi-level wildcard.
      }

      if (f === '+') {
        if (t === undefined) return false;
        continue; // Single-level wildcard.
      }

      if (t === undefined || f !== t) {
        return false;
      }
    }

    // Handles edge case: topic is longer than filter without trailing '#'.
    return topicLevels.length === filterLevels.length;
  }

  private extractIdFromTopic(topic: string): number | null {
    const parts = topic.split('/');
    const id = Number(parts.at(-1));
    return Number.isNaN(id) ? null : id;
  }

  private mapKey(topicFilters: string[]): string {
    return topicFilters.join(',');
  }
}
