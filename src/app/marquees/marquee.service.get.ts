import { Injectable } from '@angular/core';
import { Buffer } from 'buffer';
import { Marquee, MarqueeReply } from '../model/marquee/marquee';
import { MqttService } from '../mqtt/mqtt.service';
import mqtt from 'mqtt';
import { BehaviorSubject, Observable } from 'rxjs';
import { Rectangle } from '../utilities/rectangle';

@Injectable({
  providedIn: 'root'
})
export class MarqueeServiceGet {

  private marqueesMap = new Map<string, BehaviorSubject<Marquee[]>>();
  private mqttHandlers = new Map<string, (topic: string, payload: Buffer) => void>();
  private client!: mqtt.MqttClient;

  constructor(private mqttService: MqttService) { }

  getMarqueesForPage(diaryId: number, pageId: number): Observable<Marquee[]> {

    const key = `${diaryId}/${pageId}`;
    const topicPrefix = `diary/${key}/`;
    const topic = `${topicPrefix}+`;

    if (this.marqueesMap.has(key)) {
      console.log(`MarqueeServiceGet: using cached stream for ${key}`);
      return this.marqueesMap.get(key)!.asObservable();
    }

    const subject = new BehaviorSubject<Marquee[]>([]);
    this.marqueesMap.set(key, subject);

    // Ensure cleanup will be triggered even if caller forgets to subscribe
    subject.subscribe();

    this.mqttService.getConnection().then(client => {
      this.client = client;

      client.subscribe(topic, { qos: 1 }, err => {
        if (err) {
          console.error(`MarqueeServiceGet: failed to subscribe to ${topic}`, err);
          subject.error(err);
          return;
        }

        console.log(`MarqueeServiceGet: subscribed to ${topic}`);
        const handler = (messageTopic: string, payload: Buffer) => {
          if (!messageTopic.startsWith(topicPrefix)) return;

          if (payload.byteLength === 0) {
            const parts = messageTopic.split('/');
            const marqueeId = Number(parts[3]);
            if (!isNaN(marqueeId)) {
              const updated = subject.getValue().filter(f => f.id !== marqueeId);
              subject.next(updated);
              console.log(`MarqueeServiceGet: deleted marqueeId ${marqueeId}`);
            }
            return;
          }

          try {
            const reply = JSON.parse(payload.toString()) as MarqueeReply;
            const rectangle = new Rectangle(reply.x, reply.y, reply.width, reply.height);
            const marquee = new Marquee(reply.id, rectangle);

            const current = subject.getValue();
            const index = current.findIndex(f => f.id === reply.id);
            const updated = [...current];

            if (index !== -1) {
              updated[index] = marquee;
            } else {
              updated.push(marquee);
            }

            console.log(`MarqueeServiceGet: received: ${payload.toString()}`);

            subject.next(updated);
            // console.log(`MarqueeServiceGet: received/updated marqueeId ${marquee.id}`);
          } catch (err) {
            console.error(`MarqueeServiceGet: failed to parse message`, err);
            console.error(`MarqueeServiceGet: payload was: ${payload.toString()}`);
          }
        };

        this.mqttHandlers.set(key, handler);
        client.on('message', handler);

        subject.subscribe({
          complete: () => {
            console.log(`MarqueeServiceGet: stream completed for ${key}`);
            client.removeListener('message', handler);
            client.unsubscribe(topic);
          },
          error: (err) => {
            console.error(`MarqueeServiceGet: stream error for ${key}`, err);
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
      console.log(`MarqueeServiceGet: unsubscribed from topic ${topic}`);
    }

    const subject = this.marqueesMap.get(key);
    if (subject) {
      subject.complete();
      this.marqueesMap.delete(key);
      console.log(`MarqueeServiceGet: removed marquees stream for ${key}`);
    }
  }
}
