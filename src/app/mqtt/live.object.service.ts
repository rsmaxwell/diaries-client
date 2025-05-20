
import { Injectable } from "@angular/core";
import { from, Observable, switchMap } from "rxjs";
import { MqttService } from "./mqtt.service";
import { Diary } from "../model/diary";
import { Page } from "../model/page";
import { Marquee } from "../model/marquee";
import { Rectangle } from "../utilities/rectangle";

@Injectable({ providedIn: 'root' })
export class LiveObjectService {

    constructor(
        private mqtt: MqttService
    ) { }

    getDiaryById$(id: number): Observable<Diary> {
        console.log(`LiveObjectService: getDiaryById$(${id})`);
        const topic = `diary/${id}`;
        return this.getObjectById$<Diary>(topic, (buf: Buffer) => {
            return JSON.parse(buf.toString()) as Diary;
        });
    }

    getPageById$(diaryId: number, pageId: number): Observable<Page> {
        console.log(`LiveObjectService: getPageById$(${diaryId}, ${pageId})`);
        const topic = `diary/${diaryId}/${pageId}`;
        return this.getObjectById$<Page>(topic, (buf: Buffer) => {
            return JSON.parse(buf.toString()) as Page;
        })
    }

    getMarqueeById$(diaryId: number, pageId: number, marqueeId: number): Observable<Marquee> {
        console.log(`LiveObjectService: getMarqueesById$(${diaryId}, ${pageId}, ${marqueeId})`);
        const topic = `diary/${diaryId}/${pageId}/${marqueeId}`;
        return this.getObjectById$<Marquee>(topic, (buf: Buffer) => {
            const raw = JSON.parse(buf.toString());
            const rectangle = new Rectangle(raw.x, raw.y, raw.width, raw.height);
            return new Marquee(raw.id, rectangle, raw.sequence);
        })
    }

    private getObjectById$<T extends { id: number }>(
        topic: string,
        deserialize: (buf: Buffer) => T
    ): Observable<T> {
        return from(this.mqtt.getConnection()).pipe(
            switchMap(client =>
                new Observable<T>(observer => {
                    const handler = (messageTopic: string, payload: Buffer) => {
                        if (messageTopic !== topic) return;
                        try {
                            const obj = deserialize(payload);
                            console.log(`LiveObjectService: deserialized:`, obj);
                            observer.next(obj);
                        } catch (err) {
                            observer.error(err);
                        }
                    };

                    client.subscribe(topic, { qos: 1 }, err => {
                        if (err) {
                            observer.error(err);
                            return;
                        }
                        client.on('message', handler);
                    });

                    return () => {
                        client.unsubscribe(topic);
                        client.removeListener('message', handler);
                    };
                })
            )
        );
    }
}
