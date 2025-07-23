
import { Injectable } from "@angular/core";
import { Observable, ReplaySubject } from "rxjs";
import { MqttService } from "./mqtt.service";

@Injectable({ providedIn: 'root' })
export class LiveObjectService {

  constructor(
    private mqtt: MqttService
  ) { }

  private subjects = new Map<string, { subject: ReplaySubject<any>, refCount: number, handler: (topic: string, payload: Buffer) => void }>();

  /**
   * Returns an observable that emits deserialized objects received on a specific MQTT topic.
   * 
   * This function ensures that:
   * - Only one subscription is created per topic, and results are shared via a ReplaySubject.
   * - Each subscriber receives the latest object from the topic.
   * - MQTT message listeners are reference-counted and automatically removed when the last subscriber unsubscribes.
   * - The MQTT topic is unsubscribed when no longer needed, preventing memory leaks and stale message handling.
   *
   * @template T - The type of the deserialized object.
   * @param topic - The MQTT topic to subscribe to.
   * @param deserialize - A function to convert the MQTT payload (Buffer) into a typed object.
   * @returns An observable stream of deserialized objects for the given topic.
   */
  getObjectById$<T>(
    topic: string,
    deserialize: (buf: Buffer) => T
  ): Observable<T> {

    // If someone’s already watching this topic, bump the refCount and reuse
    if (this.subjects.has(topic)) {
      const entry = this.subjects.get(topic)!;
      entry.refCount++;
      console.log(
        `LiveObjectService.getObjectById$: refCount for '${topic}' is now ${entry.refCount}`
      );
      return entry.subject.asObservable();
    }

    // First time, create a new ReplaySubject and handler
    const subject = new ReplaySubject<T>(1);
    const handler = (messageTopic: string, payload: Buffer) => {
      if (messageTopic === topic) {
        const payloadStr = payload.toString();
        if (!payloadStr.trim()) {
          console.log(
            `LiveObjectService.getObjectById$: Empty payload => deleted object at ${topic}`
          );
          subject.complete();
          return;
        }
        try {
          subject.next(deserialize(payload));
        } catch (err) {
          console.error(
            `LiveObjectService.getObjectById$: parse error on ${topic}:`,
            err
          );
          subject.error(err as Error);
        }
      }
    };

    // Store it so we can tear it down later
    this.subjects.set(topic, {
      subject,
      refCount: 1,
      handler
    });

    // Subscribe to the topic and attach handler
    this.mqtt.getConnection().then(client => {

      client.subscribe(topic, { qos: 1 }, err => {
        if (err) {
          subject.error(err);
          return;
        }

        console.log(
          `LiveObjectService.getObjectById$: subscribed to '${topic}', attaching handler`
        );

        client.on('message', handler);

        console.log(
          `LiveObjectService.getObjectById$: ListenerCount: after subscribeToTopicTree:`,
          client.listenerCount('message')
        );
      });
    });

    // Return an observable that tears itself down correctly
    return new Observable<T>(observer => {
      const sub = subject.subscribe(observer);

      return () => {
        // 1) Unsubscribe our local observer
        sub.unsubscribe();

        // 2) Decrement refCount and, if zero, remove listener + unsubscribe topic
        const entry = this.subjects.get(topic)!;
        entry.refCount--;
        if (entry.refCount === 0) {
          this.mqtt.getConnection().then(client => {
            client.unsubscribe(topic);
            console.log(
              `LiveObjectService.getObjectById$: unsubscribing and removing handler for '${topic}'`
            );
            client.removeListener('message', handler);

            console.log(
              `LiveObjectService.getObjectById$: ListenerCount: after unsubscribeTopicTree cleanup:`,
              client.listenerCount('message')
            );

          });
          this.subjects.delete(topic);
        }
      };
    });
  }

}
