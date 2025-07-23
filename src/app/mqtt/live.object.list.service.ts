import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable } from "rxjs";
import { MqttService } from "./mqtt.service";
import mqtt from "mqtt";

@Injectable({ providedIn: 'root' })
export class LiveObjectListService {

  private topicSubscriptionMap = new Map<string, BehaviorSubject<any[]>>();
  private topicHandlerMap = new Map<string, (topic: string, payload: Buffer) => void>();

  constructor(
    private mqtt: MqttService
  ) { }

  subscribeToTopicTree$<R extends { id: number; sequence: number }>(
    client: mqtt.MqttClient,
    topicFilters: string[],
    deserialize: (buf: Buffer) => R
  ): Observable<R[]> {

    const mapKey = topicFilters.join(',');

    if (this.topicSubscriptionMap.has(mapKey)) {
      return this.topicSubscriptionMap.get(mapKey)!.asObservable();
    }

    const subject = new BehaviorSubject<R[]>([]);
    this.topicSubscriptionMap.set(mapKey, subject);

    const handler = (messageTopic: string, payload: Buffer) => {
      if (!this.topicMatchesFilters(messageTopic, topicFilters)) {
        return;
      }

      const current = subject.getValue();

      // Handle delete (0-byte payload)
      if (payload.byteLength === 0) {
        const parts = messageTopic.split('/');
        const id = Number(parts.at(-1));
        if (!isNaN(id)) {
          console.log(`LiveObjectListService.subscribeToTopicTree: Handle delete for: ${messageTopic}`);
          subject.next(current.filter(item => item.id !== id));
        }
        return;
      }

      try {
        const value = deserialize(payload);
        const index = current.findIndex(item => item.id === value.id);
        const updated = [...current];

        if (index !== -1) {
          updated[index] = value;
        } else {
          updated.push(value);
        }

        updated.sort((a, b) => a.sequence - b.sequence);
        subject.next(updated);

      } catch (err) {
        console.error(`LiveObjectListService: failed to parse message on ${messageTopic}`, err);
      }
    };

    topicFilters.forEach(topicFilter => {
      client.subscribe(topicFilter, { qos: 1 }, err => {
        if (err) {
          console.error(`LiveObjectListService: failed to subscribe to ${topicFilter}`, err);
          subject.error(err);
          this.topicSubscriptionMap.delete(mapKey);
        } else {
          if (!this.topicHandlerMap.has(mapKey)) {

            console.log(
              `LiveObjectListService.subscribeToTopicTree$: subscribed to '${topicFilter}', attaching handler`
            );

            client.on('message', handler);

            console.log(
              `LiveObjectListService.subscribeToTopicTree$: ListenerCount: after subscribeToTopicTree:`,
              client.listenerCount('message')
            );

            this.topicHandlerMap.set(mapKey, handler);
          }
        }
      });
    });

    subject.subscribe({
      complete: () => {

        console.log(
          `LiveObjectListService.subscribeToTopicTree$: unsubscribing and removing handler}'`
        );

        client.removeListener('message', handler);

        console.log(
          `LiveObjectListService.subscribeToTopicTree$: ListenerCount: after unsubscribeTopicTree cleanup:`,
          client.listenerCount('message')
        );


        topicFilters.forEach(filter => client.unsubscribe(filter));
        this.topicHandlerMap.delete(mapKey);
        this.topicSubscriptionMap.delete(mapKey);
      },
      error: err => {
        console.error(`LiveObjectListService.subscribeToTopicTree$: error in stream for ${mapKey}`, err);

        console.log(
          `LiveObjectListService.subscribeToTopicTree$: ListenerCount: after unsubscribeTopicTree cleanup:`,
          client.listenerCount('message')
        );

        client.removeListener('message', handler);
        topicFilters.forEach(filter => client.unsubscribe(filter));
        this.topicHandlerMap.delete(mapKey);
        this.topicSubscriptionMap.delete(mapKey);
      }
    });

    return subject.asObservable();
  }

  private topicMatchesFilters(topic: string, filters: string[]): boolean {
    return filters.some(filter => this.topicMatchesFilter(topic, filter));
  }

  /** Robust MQTT topic filter matching **/
  private topicMatchesFilter(topic: string, filter: string): boolean {
    const topicLevels = topic.split('/');
    const filterLevels = filter.split('/');

    for (let i = 0; i < filterLevels.length; i++) {
      const f = filterLevels[i];
      const t = topicLevels[i];

      if (f === '#') {
        return true; // Multi-level wildcard
      }
      if (f === '+') {
        continue; // Single-level wildcard
      }
      if (t === undefined || f !== t) {
        return false;
      }
    }

    // Handles edge case: topic is longer than filter without trailing '#'
    return topicLevels.length === filterLevels.length;
  }

  unsubscribeTopicTree(topicFilters: string[]): void {

    console.log(`LiveObjectListService.unsubscribeTopicTree: topicFilters: ${topicFilters}`);

    const mapKey = topicFilters.join(',');

    this.mqtt.getConnection().then(client => {
      const subject = this.topicSubscriptionMap.get(mapKey);
      if (subject) {
        subject.complete(); // downstream handles cleanup in `complete` handler
        this.topicSubscriptionMap.delete(mapKey);
      }
    });
  }
}
