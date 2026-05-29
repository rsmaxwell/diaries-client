import { Injectable } from "@angular/core";
import { Observable, ReplaySubject } from "rxjs";
import mqtt from "mqtt";

import { MqttService } from "./mqtt.service";

interface LiveObjectEntry<T = any> {
  subject: ReplaySubject<T | null>;
  refCount: number;
  deserialize: (buf: Buffer) => T;
  subscribed: boolean;
}

@Injectable({ providedIn: 'root' })
export class LiveObjectService {

  private subjects = new Map<string, LiveObjectEntry>();

  private messageListenerAttached = false;
  private connectionListenersAttached = false;

  constructor(
    private mqtt: MqttService
  ) {
    this.ensureListener();
  }

  /**
   * Returns an observable that emits deserialized objects received on a specific MQTT topic.
   *
   * This function ensures that:
   * - Only one MQTT message listener is attached for the whole LiveObjectService.
   * - Only one MQTT subscription is created per live object topic.
   * - Results for a topic are shared through a ReplaySubject.
   * - Each subscriber receives the latest retained/live object for the topic.
   * - Empty retained payloads are treated as deletes and emitted as null.
   * - Topic subscriptions are reference-counted and removed when no longer needed.
   *
   * @template T - The type of the deserialized object.
   * @param topic - The MQTT topic to subscribe to.
   * @param deserialize - A function to convert the MQTT payload Buffer into a typed object.
   * @returns An observable stream of deserialized objects, or null for retained deletes.
   */
  getObjectById$<T>(
    topic: string,
    deserialize: (buf: Buffer) => T
  ): Observable<T | null> {

    this.ensureListener();

    return new Observable<T | null>(observer => {
      const entry = this.getOrCreateEntry(topic, deserialize);

      entry.refCount++;
      console.log(`LiveObjectService.getObjectById$: SUBSCRIBE '${topic}', refCount incremented to ${entry.refCount}`);

      const subscription = entry.subject.subscribe(observer);

      return () => {
        subscription.unsubscribe();
        this.releaseTopicReference(topic, entry);
      };
    });
  }

  /**
   * Explicitly unsubscribe from a topic regardless of its current refCount.
   *
   * This is useful when the owning ModelContext cache is being deliberately cleared.
   * Normal RxJS unsubscription will also clean topics up automatically when the last
   * subscriber goes away, so this method should only be used when you really want to
   * force-release the topic.
   */
  unsubscribeTopic(topic: string): void {
    const entry = this.subjects.get(topic);
    if (!entry) {
      console.warn(`LiveObjectService.unsubscribeTopic: topic '${topic}' not found`);
      return;
    }

    console.log(`LiveObjectService.unsubscribeTopic: force unsubscribing '${topic}', refCount=${entry.refCount}`);
    this.unsubscribeAndDeleteTopic(topic, entry, true);
  }

  /**
   * Register the small number of MQTT client listeners used by this service.
   *
   * The important one is the single global 'message' listener. It dispatches incoming
   * MQTT messages to the matching topic entry in this.subjects instead of attaching a
   * separate MQTT listener for every live object topic.
   */
  private ensureListener(): void {
    this.mqtt.getConnection().then(client => {
      if (!this.messageListenerAttached) {
        console.log(`LiveObjectService.ensureListener: attaching MQTT message dispatcher`);

        client.on('message', this.liveObjectDispatcher.bind(this));
        this.messageListenerAttached = true;

        console.log(
          `LiveObjectService.ensureListener: ListenerCount after attaching dispatcher:`,
          client.listenerCount('message')
        );
      }

      if (!this.connectionListenersAttached) {
        client.on('connect', (connack: any) => {
          console.log(
            `LiveObjectService.ensureListener: [MQTT] connect seen in LiveObjectService sessionPresent=${connack?.sessionPresent}`
          );
          this.resubscribeAll(client);
        });

        client.on('reconnect', () => {
          console.log(`LiveObjectService.ensureListener: [MQTT] reconnecting (LiveObjectService)`);
        });

        this.connectionListenersAttached = true;
      }
    }).catch(err => {
      console.error(`LiveObjectService.ensureListener: failed to get MQTT connection`, err);
    });
  }

  /**
   * Single MQTT message listener for all live object topics.
   */
  private liveObjectDispatcher(messageTopic: string, payload: Buffer, packet?: any): void {
    const entry = this.subjects.get(messageTopic);
    if (!entry) return;

    // retained delete => zero-length payload
    if (!payload || payload.length === 0) {
      console.log(`LiveObjectService.liveObjectDispatcher: zero-length payload => emit null for ${messageTopic}`);
      entry.subject.next(null);
      return;
    }

    this.logFragmentMessage(messageTopic, payload, packet);

    try {
      entry.subject.next(entry.deserialize(payload));
    } catch (err) {
      console.error(`LiveObjectService.liveObjectDispatcher: parse error on ${messageTopic}:`, err);
      entry.subject.error(err as Error);
    }
  }

  private getOrCreateEntry<T>(
    topic: string,
    deserialize: (buf: Buffer) => T
  ): LiveObjectEntry<T> {

    const existing = this.subjects.get(topic) as LiveObjectEntry<T> | undefined;
    if (existing) return existing;

    const entry: LiveObjectEntry<T> = {
      subject: new ReplaySubject<T | null>(1),
      refCount: 0,
      deserialize,
      subscribed: false
    };

    this.subjects.set(topic, entry);
    this.subscribeToTopic(topic, entry);

    return entry;
  }

  private subscribeToTopic(topic: string, entry: LiveObjectEntry): void {
    this.mqtt.getConnection().then(client => {
      const current = this.subjects.get(topic);
      if (current !== entry) return;
      if (entry.subscribed) return;

      console.log(
        `LiveObjectService.subscribeToTopic: [MQTT] SUBSCRIBE -> ${topic} (client.connected=${client.connected})`
      );

      client.subscribe(topic, { qos: 1 }, err => {
        const latest = this.subjects.get(topic);
        if (latest !== entry) return;

        console.log(`LiveObjectService.subscribeToTopic: [MQTT] SUBSCRIBE ACK <- ${topic}`, { err });

        if (err) {
          entry.subject.error(err);
          this.subjects.delete(topic);
          return;
        }

        entry.subscribed = true;
        console.log(`LiveObjectService.subscribeToTopic: SUBSCRIBED to '${topic}'`);
      });
    }).catch(err => {
      const latest = this.subjects.get(topic);
      if (latest === entry) {
        entry.subject.error(err);
        this.subjects.delete(topic);
      }
    });
  }

  private releaseTopicReference(topic: string, entry: LiveObjectEntry): void {
    const current = this.subjects.get(topic);
    if (current !== entry) return;

    entry.refCount--;
    console.log(`LiveObjectService.releaseTopicReference: UNSUBSCRIBE '${topic}', refCount decremented to ${entry.refCount}`);

    if (entry.refCount <= 0) {
      this.unsubscribeAndDeleteTopic(topic, entry, false);
    }
  }

  private unsubscribeAndDeleteTopic(topic: string, entry: LiveObjectEntry, completeSubject: boolean): void {
    const current = this.subjects.get(topic);
    if (current !== entry) return;

    this.subjects.delete(topic);

    if (completeSubject) {
      entry.subject.complete();
    }

    this.mqtt.getConnection().then(client => {
      console.log(`LiveObjectService.unsubscribeAndDeleteTopic: [MQTT] UNSUBSCRIBE -> ${topic}`);

      client.unsubscribe(topic, err => {
        if (err) {
          console.error(`LiveObjectService.unsubscribeAndDeleteTopic: failed to unsubscribe '${topic}'`, err);
          return;
        }

        console.log(`LiveObjectService.unsubscribeAndDeleteTopic: unsubscribed '${topic}'`);
        console.log(
          `LiveObjectService.unsubscribeAndDeleteTopic: ListenerCount after UNSUBSCRIBE '${topic}':`,
          client.listenerCount('message')
        );
      });
    }).catch(err => {
      console.error(`LiveObjectService.unsubscribeAndDeleteTopic: failed to get MQTT connection`, err);
    });
  }

  private resubscribeAll(client: mqtt.MqttClient): void {
    for (const [topic, entry] of this.subjects.entries()) {
      if (entry.refCount <= 0) continue;

      console.log(`LiveObjectService.resubscribeAll: [MQTT] RESUBSCRIBE -> ${topic} refCount=${entry.refCount}`);

      client.subscribe(topic, { qos: 1 }, (err: any) => {
        console.log(`LiveObjectService.resubscribeAll: [MQTT] RESUBSCRIBE ACK <- ${topic}`, { err });

        if (err) {
          entry.subject.error(err);
          this.subjects.delete(topic);
          return;
        }

        entry.subscribed = true;
      });
    }
  }

  private logFragmentMessage(messageTopic: string, payload: Buffer, packet?: any): void {
    if (!messageTopic.startsWith('diaries/fragments/')) return;

    try {
      const obj = JSON.parse(payload.toString());

      console.log(`LiveObjectService.liveObjectDispatcher: [MQTT] RX ${messageTopic}`, {
        id: obj.id,
        version: obj.version,
        locked: !!obj.lock?.lockUserId
          && !!obj.lock?.lockSessionId
          && String(obj.lock.lockSessionId).trim() !== '',
        hasLockSessionId: !!obj.lock?.lockSessionId,
        retain: packet?.retain,
        qos: packet?.qos,
        dup: packet?.dup,
      });
    } catch {
      // Ignore debug logging parse failures. The real deserialize step still runs below.
    }
  }
}
