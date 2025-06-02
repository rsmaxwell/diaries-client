import { Injectable } from "@angular/core";
import mqtt from "mqtt";
import { BehaviorSubject, from, Observable, switchMap } from "rxjs";
import { MqttService } from "./mqtt.service";
import { Rectangle } from "../utilities/rectangle";
import { Diary } from "../model/diary";
import { Page } from "../model/page";
import { Marquee } from "../model/marquee";

@Injectable({ providedIn: 'root' })
export class LiveObjectListService {

    private topicSubscriptionMap = new Map<string, BehaviorSubject<any[]>>();
    private topicHandlerMap = new Map<string, (topic: string, payload: Buffer) => void>();

    constructor(
        private mqtt: MqttService
    ) { }

    getDiaries$(): Observable<Diary[]> {
        return from(this.mqtt.getConnection()).pipe(
            switchMap(client =>
                this.subscribeToTopicTree$<Diary>(client, `diaries/`, (buf: Buffer) => {
                    return JSON.parse(buf.toString()) as Diary;
                })
            )
        );
    }

    getPagesForDiary$(diaryId: number): Observable<Page[]> {
        return from(this.mqtt.getConnection()).pipe(
            switchMap(client =>
                this.subscribeToTopicTree$<Page>(client, `diaries/${diaryId}/`, (buf: Buffer) => {
                    return JSON.parse(buf.toString()) as Page;
                })
            )
        );
    }

    getMarqueesForPage$(diaryId: number, pageId: number): Observable<Marquee[]> {
        const topicPrefix = `diaries/${diaryId}/${pageId}/`;

        return from(this.mqtt.getConnection()).pipe(
            switchMap(client =>
                this.subscribeToTopicTree$<Marquee>(client, topicPrefix, (buf: Buffer) => {
                    const obj = JSON.parse(buf.toString());
                    const rect = new Rectangle(obj.x, obj.y, obj.width, obj.height);
                    return new Marquee(obj.id, rect, obj.sequence);
                })
            )
        );
    }

    async unsubscribeFromDiaries$(): Promise<void> {
        await this.unsubscribeTopicTree(`diaries/`);
    }

    async unsubscribeFromgetDiaryById$(id: number): Promise<void> {
        await this.unsubscribeTopicTree(`diaries/${id}`);
    }

    async unsubscribeFromMarqueesForPage$(diaryId: number, pageId: number): Promise<void> {
        const topicPrefix = `diaries/${diaryId}/${pageId}/`;
        await this.unsubscribeTopicTree(topicPrefix);
    }


    private subscribeToTopicTree$<R extends { id: number, sequence: number }>(
        client: mqtt.MqttClient,
        topicPrefix: string,
        deserialize: (buf: Buffer) => R
    ): Observable<R[]> {
        const topic = `${topicPrefix}+`;

        if (this.topicSubscriptionMap.has(topicPrefix)) {
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
                    subject.next(current.filter(item => item.id !== id));
                }
                return;
            }

            try {
                const value = deserialize(payload);
                const id = value.id;

                const index = current.findIndex(item => item.id === id);
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

        client.subscribe(topic, { qos: 1 }, err => {
            if (err) {
                console.error(`LiveObjectListService: failed to subscribe to ${topic}`, err);
                subject.error(err);
                this.topicSubscriptionMap.delete(topicPrefix);
                return;
            }

            if (!this.topicHandlerMap.has(topicPrefix)) {
                client.on('message', handler);
                this.topicHandlerMap.set(topicPrefix, handler);
            }

            subject.subscribe({
                complete: () => {
                    client.removeListener('message', handler);
                    client.unsubscribe(topic);
                    this.topicHandlerMap.delete(topicPrefix);
                    this.topicSubscriptionMap.delete(topicPrefix);
                },
                error: (err) => {
                    console.error(`LiveObjectListService: error in stream for ${topic}`, err);
                    client.removeListener('message', handler);
                    client.unsubscribe(topic);
                    this.topicHandlerMap.delete(topicPrefix);
                    this.topicSubscriptionMap.delete(topicPrefix);
                }
            });
        });

        return subject.asObservable();
    }

    private unsubscribeTopicTree(topicPrefix: string): void {
        const subject = this.topicSubscriptionMap.get(topicPrefix);

        if (subject) {
            // This triggers the cleanup logic already attached in subscribeToTopicTree$.
            subject.complete();
            return;
        }

        const handler = this.topicHandlerMap.get(topicPrefix);
        const topic = `${topicPrefix}+`;

        if (handler) {
            this.mqtt.getConnection().then(client => {
                client.removeListener('message', handler);
                client.unsubscribe(topic);
                console.log(`LiveObjectListService: unsubscribed from ${topic}`);
            });
        }

        this.topicHandlerMap.delete(topicPrefix);
    }
}
