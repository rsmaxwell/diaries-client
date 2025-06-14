
import { Injectable } from "@angular/core";
import { from, Observable, ReplaySubject, switchMap } from "rxjs";
import { MqttService } from "./mqtt.service";
import { Diary } from "../model/diary";
import { Page } from "../model/page";
import { Marquee } from "../model/marquee";
import { Rectangle } from "../utilities/rectangle";
import { Fragment } from "../model/fragment";

@Injectable({ providedIn: 'root' })
export class LiveObjectService {



  constructor(
    private mqtt: MqttService
  ) { }

  getDiaryById$(id: number): Observable<Diary> {
    const topic = `diaries/${id}`;
    return this.getObjectById$<Diary>(topic, (buf: Buffer) => {
      return JSON.parse(buf.toString()) as Diary;
    });
  }

  getPageById$(diaryId: number, pageId: number): Observable<Page> {
    const topic = `diaries/${diaryId}/${pageId}`;
    return this.getObjectById$<Page>(topic, (buf: Buffer) => {
      return JSON.parse(buf.toString()) as Page;
    })
  }

  getFragmentById$(fragmentId: number): Observable<Fragment> {
    const topic = `fragments/${fragmentId}`;
    return this.getObjectById$<Fragment>(topic, (buf: Buffer) => {
      return JSON.parse(buf.toString()) as Fragment;
    })
  }

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
  private getObjectById$<T>(topic: string, deserialize: (buf: Buffer) => T): Observable<T> {
    console.log(`LiveObjectService.getObjectById: topic: ${topic}`);

    if (this.subjects.has(topic)) {
      const entry = this.subjects.get(topic)!;
      entry.refCount++;
      return entry.subject.asObservable();
    }

    const subject = new ReplaySubject<T>(1);
    const entry = {
      subject,
      refCount: 1,
      handler: (messageTopic: string, payload: Buffer) => {
        if (messageTopic === topic) {
          const payloadStr = payload.toString();
          if (!payloadStr.trim()) {
            console.log(`LiveObjectService.getObjectById: Empty payload received: Object at topic: ${topic} has been deleted`);
            subject.complete(); // Object has been deleted
            return;
          }
          try {
            subject.next(deserialize(payload));
          } catch (err) {
            console.log(`LiveObjectService.getObjectById: ${payloadStr}`);
            subject.error(new Error(`LiveObjectService.getObjectById: Error: ${err}`));
          }
        }
      }
    };

    this.subjects.set(topic, entry);

    this.mqtt.getConnection().then(client => {
      client.subscribe(topic, { qos: 1 }, err => {
        if (err) {
          subject.error(err);
          return;
        }
        client.on('message', entry.handler);
      });
    });

    // Return observable with custom teardown logic
    return new Observable<T>(observer => {
      const sub = subject.subscribe(observer);
      return () => {
        sub.unsubscribe();
        entry.refCount--;
        if (entry.refCount === 0) {
          this.mqtt.getConnection().then(client => {
            client.unsubscribe(topic);
            client.removeListener('message', entry.handler);
          });
          this.subjects.delete(topic);
        }
      };
    });
  }
}
