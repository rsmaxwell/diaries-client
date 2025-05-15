import { Injectable } from '@angular/core';
import { Buffer } from 'buffer';
import { Fragment } from '../model/fragment/fragment';
import { MqttService } from '../mqtt/mqtt.service';
import mqtt from 'mqtt';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FragmentServiceGet {

  private fragmentsMap = new Map<string, BehaviorSubject<Fragment[]>>();
  private mqttHandlers = new Map<string, (topic: string, payload: Buffer) => void>();
  private client!: mqtt.MqttClient;

  constructor(private mqttService: MqttService) { }

  getFragmentsForPage(diaryId: number, pageId: number): Observable<Fragment[]> {

    const key = `${diaryId}/${pageId}`;
    const topicPrefix = `diary/${key}/`;
    const topic = `${topicPrefix}+`;

    if (this.fragmentsMap.has(key)) {
      console.log(`FragmentServiceGet: using cached stream for ${key}`);
      return this.fragmentsMap.get(key)!.asObservable();
    }

    const subject = new BehaviorSubject<Fragment[]>([]);
    this.fragmentsMap.set(key, subject);

    // Ensure cleanup will be triggered even if caller forgets to subscribe
    subject.subscribe();

    this.mqttService.getConnection().then(client => {
      this.client = client;

      client.subscribe(topic, { qos: 1 }, err => {
        if (err) {
          console.error(`FragmentServiceGet: failed to subscribe to ${topic}`, err);
          subject.error(err);
          return;
        }

        console.log(`FragmentServiceGet: subscribed to ${topic}`);
        const handler = (messageTopic: string, payload: Buffer) => {
          if (!messageTopic.startsWith(topicPrefix)) return;

          if (payload.byteLength === 0) {
            const parts = messageTopic.split('/');
            const fragmentId = Number(parts[3]);
            if (!isNaN(fragmentId)) {
              const updated = subject.getValue().filter(f => f.id !== fragmentId);
              subject.next(updated);
              console.log(`FragmentServiceGet: deleted fragment id ${fragmentId}`);
            }
            return;
          }

          try {
            const fragment = JSON.parse(payload.toString()) as Fragment;
            const current = subject.getValue();
            const index = current.findIndex(f => f.id === fragment.id);
            const updated = [...current];

            if (index !== -1) {
              updated[index] = fragment;
            } else {
              updated.push(fragment);
            }

            console.log(`FragmentServiceGet: received: ${payload.toString()}`);

            subject.next(updated);
            // console.log(`FragmentServiceGet: received/updated fragment id ${fragment.id}`);
          } catch (err) {
            console.error(`FragmentServiceGet: failed to parse message`, err);
            console.error(`FragmentServiceGet: payload was: ${payload.toString()}`);
          }
        };

        this.mqttHandlers.set(key, handler);
        client.on('message', handler);

        subject.subscribe({
          complete: () => {
            console.log(`FragmentServiceGet: stream completed for ${key}`);
            client.removeListener('message', handler);
            client.unsubscribe(topic);
          },
          error: (err) => {
            console.error(`FragmentServiceGet: stream error for ${key}`, err);
            client.removeListener('message', handler);
            client.unsubscribe(topic);
          }
        });
      });
    });

    return subject.asObservable();
  }

  unsubscribe(diaryId: number, pageId: number): void {
    const key = `${diaryId}/${pageId}`;
    const topic = `diary/${key}/+`;
    const handler = this.mqttHandlers.get(key);

    if (this.client && handler) {
      this.client.removeListener('message', handler);
      this.client.unsubscribe(topic);
      this.mqttHandlers.delete(key);
      console.log(`FragmentServiceGet: unsubscribed from topic ${topic}`);
    }

    const subject = this.fragmentsMap.get(key);
    if (subject) {
      subject.complete();
      this.fragmentsMap.delete(key);
      console.log(`FragmentServiceGet: removed fragments stream for ${key}`);
    }
  }
}
