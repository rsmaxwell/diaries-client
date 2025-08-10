
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

    // If already subscribed, increment refCount
    if (this.subjects.has(topic)) {
      const entry = this.subjects.get(topic)!;
      entry.refCount++;
      console.log(`LiveObjectService.getObjectById$: SUBSCRIBE '${topic}', refCount incremented to ${entry.refCount}`);
      return entry.subject.asObservable();
    }

    // First time: create ReplaySubject and message handler
    const subject = new ReplaySubject<T>(1);
    const handler = (messageTopic: string, payload: Buffer) => {
      if (messageTopic === topic) {
        const payloadStr = payload.toString();
        if (!payloadStr.trim()) {
          console.log(`LiveObjectService.getObjectById$: Empty payload => deleted object at ${topic}`);
          subject.complete();
          return;
        }
        try {
          subject.next(deserialize(payload));
        } catch (err) {
          console.error(`LiveObjectService.getObjectById$: parse error on ${topic}:`, err);
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

        console.log(`LiveObjectService.getObjectById$: SUBSCRIBED to '${topic}'`);

        client.on('message', handler);

        console.log(`LiveObjectService.getObjectById$: ListenerCount after SUBSCRIBE '${topic}': ${client.listenerCount('message')}`);
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
        if (!entry) return;

        entry.refCount--;
        console.log(`LiveObjectService.getObjectById$: UNSUBSCRIBE '${topic}', refCount decremented to ${entry.refCount}`);

        if (entry.refCount === 0) {
          console.log(`LiveObjectService.getObjectById$: preparing to unsubscribe '${topic}'`);
          this.mqtt.getConnection().then(client => {
            console.log(`LiveObjectService.getObjectById$: got connection for '${topic}'`);
            client.unsubscribe(topic);
            client.removeListener('message', entry.handler);
            console.log(`LiveObjectService.getObjectById$: unsubscribing and removing handler for '${topic}'`);
            console.log(`LiveObjectService.getObjectById$: ListenerCount after UNSUBSCRIBE '${topic}': ${client.listenerCount('message')}`);
            this.subjects.delete(topic);
          });
        }
      };
    });
  }

  /**
   * Explicitly unsubscribe from a topic and remove the handler,
   * regardless of whether it's still in use.
   * This should be used with caution.
   */
  unsubscribeTopic(topic: string): void {
    const entry = this.subjects.get(topic);
    if (!entry) {
      console.warn(`LiveObjectService.unsubscribeTopic: topic '${topic}' not found`);
      return;
    }

    entry.refCount--;
    console.log(`LiveObjectService.unsubscribeTopic: '${topic}' refCount decremented to ${entry.refCount}`);

    if (entry.refCount <= 0) {
      console.log(`LiveObjectService.unsubscribeTopic: unsubscribing '${topic}'`);
      this.mqtt.getConnection().then(client => {
        client.unsubscribe(topic);
        client.removeListener('message', entry.handler);
        console.log(`LiveObjectService.unsubscribeTopic: unsubscribed and removed handler for '${topic}'`);
        console.log(`LiveObjectService.unsubscribeTopic: ListenerCount after UNSUBSCRIBE '${topic}': ${client.listenerCount('message')}`);
        this.subjects.delete(topic);
      });
    }
  }

}
