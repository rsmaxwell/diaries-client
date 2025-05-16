import { Injectable } from "@angular/core";
import mqtt from "mqtt";
import { BehaviorSubject, from, Observable, switchMap } from "rxjs";
import { MqttService } from "./mqtt.service";
import { Marquee } from "../model/marquee/marquee";
import { Rectangle } from "../utilities/rectangle";







@Injectable({ providedIn: 'root' })
export class SubscriptionService {

    private topicSubscriptionMap = new Map<string, BehaviorSubject<any[]>>();
    private topicHandlerMap = new Map<string, (topic: string, payload: Buffer) => void>();

    constructor(
        private mqtt: MqttService
    ) { }

    getMarqueesForPage$(diaryId: number, pageId: number): Observable<Marquee[]> {
        const topicPrefix = `diary/${diaryId}/${pageId}/`;
      
        return from(this.mqtt.getConnection()).pipe(
          switchMap(client =>
            this.subscribeToTopicTree$<Marquee>(client, topicPrefix, (buf: Buffer) => {
              const obj = JSON.parse(buf.toString());
              return new Marquee(obj.id, new Rectangle(obj.x, obj.y, obj.width, obj.height));
            })
          )
        );
      }

    unsubscribeFromMarqueesForPage$(diaryId: number, pageId: number) {
        const topicPrefix = `diary/${diaryId}/${pageId}/`;
        this.unsubscribeTopicTree(topicPrefix);
    }

    private subscribeToTopicTree$<R>(
        client: mqtt.MqttClient,
        topicPrefix: string,
        deserialize: (buf: Buffer) => R
    ): Observable<R[]> {
        const topic = `${topicPrefix}+`;

        if (this.topicSubscriptionMap.has(topicPrefix)) {
            console.log(`SubscriptionService: using cached stream for ${topicPrefix}`);
            return this.topicSubscriptionMap.get(topicPrefix)!.asObservable();
        }

        const subject = new BehaviorSubject<R[]>([]);
        this.topicSubscriptionMap.set(topicPrefix, subject);

        const handler = (messageTopic: string, payload: Buffer) => {
            if (!messageTopic.startsWith(topicPrefix)) return;

            const current = subject.getValue();

            // Handle delete (0-byte payload)
            if (payload.byteLength === 0) {
                const parts = messageTopic.split('/');
                const id = Number(parts.at(-1));
                if (!isNaN(id)) {
                    subject.next(current.filter(item => (item as any).id !== id));
                    console.log(`SubscriptionService: deleted id ${id} from ${topicPrefix}`);
                }
                return;
            }

            try {
                const value = deserialize(payload);
                const id = (value as any).id;

                const index = current.findIndex(item => (item as any).id === id);
                const updated = [...current];

                if (index !== -1) {
                    updated[index] = value;
                } else {
                    updated.push(value);
                }

                subject.next(updated);
                console.log(`SubscriptionService: updated ${id} from ${topicPrefix}`);
            } catch (err) {
                console.error(`SubscriptionService: failed to parse message on ${messageTopic}`, err);
            }
        };

        client.subscribe(topic, { qos: 1 }, err => {
            if (err) {
                console.error(`SubscriptionService: failed to subscribe to ${topic}`, err);
                subject.error(err);
                return;
            }

            client.on('message', handler);
            this.topicHandlerMap.set(topicPrefix, handler);

            subject.subscribe({
                complete: () => {
                    client.removeListener('message', handler);
                    client.unsubscribe(topic);
                    this.topicHandlerMap.delete(topicPrefix);
                    this.topicSubscriptionMap.delete(topicPrefix);
                    console.log(`SubscriptionService: unsubscribed from ${topic}`);
                },
                error: (err) => {
                    console.error(`SubscriptionService: error in stream for ${topic}`, err);
                    client.removeListener('message', handler);
                    client.unsubscribe(topic);
                    this.topicHandlerMap.delete(topicPrefix);
                    this.topicSubscriptionMap.delete(topicPrefix);
                }
            });

            console.log(`SubscriptionService: subscribed to ${topic}`);
        });

        return subject.asObservable();
    }

    private unsubscribeTopicTree(topicPrefix: string): void {
        const subject = this.topicSubscriptionMap.get(topicPrefix);
        const handler = this.topicHandlerMap.get(topicPrefix);
        const topic = `${topicPrefix}+`;

        if (subject) subject.complete();
        if (handler) {
            this.mqtt.getConnection().then(client => {
                client.removeListener('message', handler);
                client.unsubscribe(topic);
                console.log(`SubscriptionService: unsubscribed from ${topic}`);
            });
        }

        this.topicSubscriptionMap.delete(topicPrefix);
        this.topicHandlerMap.delete(topicPrefix);
    }
}
