// domain-repository.ts
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LiveObjectService } from "../mqtt/live.object.service";
import { Diary } from "../model/diary";
import { Page } from '../model/page';
import { Marquee } from '../model/marquee';
import { Fragment } from '../model/fragment';

@Injectable({ providedIn: 'root' })
export class DomainRepository {
    constructor(
        private liveObjectService: LiveObjectService
    ) { }

    getDiaryById$(id: number): Observable<Diary> {
        const topic = `diaries/${id}`;
        return this.liveObjectService.getObjectById$<Diary>(topic, (buf: Buffer) => {
            return JSON.parse(buf.toString()) as Diary;
        });
    }

    getPageById$(id: number): Observable<Page> {
        const topic = `pages/${id}`;
        return this.liveObjectService.getObjectById$<Page>(topic, (buf: Buffer) => {
            return JSON.parse(buf.toString()) as Page;
        });
    }

    getMarqueeById$(id: number): Observable<Marquee> {
        const topic = `marquees/${id}`;
        return this.liveObjectService.getObjectById$<Marquee>(topic, (buf: Buffer) => {
            return JSON.parse(buf.toString()) as Marquee;
        });
    }

    getFragmentById$(id: number): Observable<Fragment> {
        const topic = `fragments/${id}`;
        return this.liveObjectService.getObjectById$<Fragment>(topic, (buf: Buffer) => {
            return JSON.parse(buf.toString()) as Fragment;
        });
    }

    // Add any other domain-level methods here
}
