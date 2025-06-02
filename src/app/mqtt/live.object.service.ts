
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
        console.log(`LiveObjectService: getDiaryById$(${id})`);
        const topic = `diaries/${id}`;
        return this.getObjectById$<Diary>(topic, (buf: Buffer) => {
            return JSON.parse(buf.toString()) as Diary;
        });
    }

    getPageById$(diaryId: number, pageId: number): Observable<Page> {
        console.log(`LiveObjectService: getPageById$(${diaryId}, ${pageId})`);
        const topic = `diaries/${diaryId}/${pageId}`;
        return this.getObjectById$<Page>(topic, (buf: Buffer) => {
            return JSON.parse(buf.toString()) as Page;
        })
    }

    getMarqueeById$(diaryId: number, pageId: number, marqueeId: number): Observable<Marquee> {
        console.log(`LiveObjectService: getMarqueesById$(${diaryId}, ${pageId}, ${marqueeId})`);
        const topic = `diaries/${diaryId}/${pageId}/${marqueeId}`;
        return this.getObjectById$<Marquee>(topic, (buf: Buffer) => {
            const raw = JSON.parse(buf.toString());
            const rectangle = new Rectangle(raw.x, raw.y, raw.width, raw.height);
            return new Marquee(raw.id, rectangle, raw.sequence);
        })
    }

    getFragmentById$(diaryId: number, pageId: number, fragmentId: number): Observable<Fragment> {
        console.log(`LiveObjectService: getFragmentById$(${diaryId}, ${pageId}, ${fragmentId})`);
        const topic = `diaries/${diaryId}/${pageId}/${fragmentId}`;
        return this.getObjectById$<Fragment>(topic, (buf: Buffer) => {
            return JSON.parse(buf.toString()) as Fragment;
        })
    }

    private subjects = new Map<string, ReplaySubject<any>>();

    private getObjectById$<T>(topic: string, deserialize: (buf: Buffer) => T): Observable<T> {
        if (this.subjects.has(topic)) {
          return this.subjects.get(topic)!.asObservable();
        }
      
        const subject = new ReplaySubject<T>(1);
        this.subjects.set(topic, subject);
      
        this.mqtt.getConnection().then(client => {
          const handler = (messageTopic: string, payload: Buffer) => {
            if (messageTopic !== topic) return;
            try {
              const obj = deserialize(payload);
              subject.next(obj);
            } catch (err) {
              subject.error(err);
            }
          };
      
          client.subscribe(topic, { qos: 1 }, err => {
            if (err) {
              subject.error(err);
              return;
            }
            client.on('message', handler);
          });
        });
      
        return subject.asObservable();
      }
      
}
