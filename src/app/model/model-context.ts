import { Injectable } from "@angular/core";
import { BehaviorSubject, combineLatest, filter, from, Observable, of, shareReplay, Subject, switchMap } from "rxjs";
import { LiveObjectListService } from "../mqtt/live.object.list.service";
import { Marquee } from "./marquee";
import { MqttService } from "../mqtt/mqtt.service";
import { Diary } from "./diary";
import { Page } from "./page";
import { Fragment } from "./fragment";
import { LiveObjectService } from "../mqtt/live.object.service";

@Injectable({ providedIn: 'root' })
export class ModelContext {

  private activeTopicFilters = new Set<string>();



  // Context state   
  addButtonClickedSubject = new Subject<void>();
  diaryIdSubject = new BehaviorSubject<number | null>(null);
  pageIdSubject = new BehaviorSubject<number | null>(null);
  marqueeIdSubject = new BehaviorSubject<number | null>(null);
  fragmentIdSubject = new BehaviorSubject<number | null>(null);

  // Exposed observables for IDs
  readonly addButtonClicked$ = this.addButtonClickedSubject.asObservable();
  readonly title$ = new BehaviorSubject<string>('Fragment');
  readonly diaryId$ = this.diaryIdSubject.asObservable();
  readonly pageId$ = this.pageIdSubject.asObservable();
  readonly marqueeId$ = this.marqueeIdSubject.asObservable();
  readonly fragmentId$ = this.fragmentIdSubject.asObservable();





  constructor(
    private mqtt: MqttService,
    private liveObjectListService: LiveObjectListService,
    private liveObjectService: LiveObjectService
  ) { }

  // Live single objects

  // A single shareReplay per stream. No other caching layer.
  readonly diary$ = this.diaryId$.pipe(
    filter(id => id != null),
    switchMap(id =>
      this.liveObjectService.getObjectById$<Diary>(
        `diaries/${id}`, buf => JSON.parse(buf.toString()) as Diary
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly page$ = this.pageId$.pipe(
    filter(id => id != null),
    switchMap(id =>
      this.liveObjectService.getObjectById$<Page>(
        `pages/${id}`, buf => JSON.parse(buf.toString()) as Page
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );


  readonly marquee$ = this.marqueeId$.pipe(
    filter(id => id != null),
    switchMap(id =>
      this.liveObjectService.getObjectById$<Marquee>(
        `marquees/${id}`, buf => JSON.parse(buf.toString()) as Marquee
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );


  readonly fragment$ = this.fragmentId$.pipe(
    switchMap(id =>
      id != null
        ? this.liveObjectService.getObjectById$<Fragment>(
          `fragments/${id}`, buf => JSON.parse(buf.toString()) as Fragment
        )
        : of(null)
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // Live collections
  readonly pages$ = this.diaryId$.pipe(
    switchMap(id => (id == null) ? of(null) : this.getPagesForDiary$(id))
  );

  readonly marquees$ = combineLatest([this.diaryId$, this.pageId$]).pipe(
    filter(([diaryId, pageId]) => diaryId != null && pageId != null),
    switchMap(([diaryId, pageId]) => this.getMarqueesForPage$(diaryId, pageId)
    )
  );

  getDiaries$(): Observable<Diary[]> {
    const topicFilters = [`diaries/+`];
    topicFilters.forEach(filter => this.activeTopicFilters.add(filter));

    return from(this.mqtt.getConnection()).pipe(
      switchMap(client =>
        this.liveObjectListService.subscribeToTopicTree$<Diary>(client, topicFilters, (buf: Buffer) => {
          return JSON.parse(buf.toString()) as Diary;
        })
      )
    );
  }

  getPagesForDiary$(diaryId: number): Observable<Page[]> {
    const topicFilters = [`diaries/${diaryId}/+`];
    topicFilters.forEach(filter => this.activeTopicFilters.add(filter));

    return from(this.mqtt.getConnection()).pipe(
      switchMap(client =>
        this.liveObjectListService.subscribeToTopicTree$<Page>(client, topicFilters, (buf: Buffer) => {
          return JSON.parse(buf.toString()) as Page;
        })
      )
    );
  }

  getMarqueesForPage$(diaryId: number | null, pageId: number | null): Observable<Marquee[]> {
    const topicFilters = [`diaries/${diaryId}/${pageId}/+`];
    topicFilters.forEach(filter => this.activeTopicFilters.add(filter));

    return from(this.mqtt.getConnection()).pipe(
      switchMap(client =>
        this.liveObjectListService.subscribeToTopicTree$<Marquee>(client, topicFilters, (buf: Buffer) => {
          return JSON.parse(buf.toString()) as Marquee;
        })
      )
    );
  }

  cleanupTopicTree(): void {
    console.log(`ModelContext.cleanupTopicTree`);
    this.activeTopicFilters.forEach(filter => {
      this.liveObjectListService.unsubscribeTopicTree([filter]);
    });
    this.activeTopicFilters.clear();
  }

  // State setters
  setTitle(title: string) {
    this.title$.next(title);
  }

  setDiaryId(id: number) {
    this.diaryIdSubject.next(id);
  }

  setPageId(id: number) {
    this.pageIdSubject.next(id);
  }

  setMarqueeId(id: number | null) {
    this.marqueeIdSubject.next(id);
  }

  setFragmentId(id: number | null) {
    if (this.fragmentIdSubject.value !== id) {
      console.log(`ModelContext.setFragmentId: changed from ${this.fragmentIdSubject.value} to ${id}`);
      this.fragmentIdSubject.next(id);
    } else {
      // console.log(`ModelContext.setFragmentId: ignored duplicate ${id}`);
    }
  }

  fireAddButtonClick(): void {
    this.addButtonClickedSubject.next();
  }
}
