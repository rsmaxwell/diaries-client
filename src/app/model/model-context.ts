import { Injectable } from "@angular/core";
import { BehaviorSubject, combineLatest, filter, from, map, Observable, of, shareReplay, Subject, switchMap, takeUntil } from "rxjs";
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
  fragmentIdSubject = new BehaviorSubject<number | null>(null);
  marqueeIdSubject = new BehaviorSubject<number | null>(null);  // Can be null

  // Exposed observables for IDs
  readonly addButtonClicked$ = this.addButtonClickedSubject.asObservable();
  readonly title$ = new BehaviorSubject<string>('Fragment');
  readonly diaryId$ = this.diaryIdSubject.asObservable();
  readonly pageId$ = this.pageIdSubject.asObservable();
  readonly fragmentId$ = this.fragmentIdSubject.asObservable();
  readonly marqueeId$ = this.marqueeIdSubject.asObservable();

  private destroy$ = new Subject<void>();

  constructor(
    private mqtt: MqttService,
    private liveObjectListService: LiveObjectListService,
    private liveObjectService: LiveObjectService
  ) { }

  // Live single objects

  // A single shareReplay per stream. No other caching layer.
  readonly diary$ = this.diaryId$.pipe(
    switchMap(id =>
      this.liveObjectService.getObjectById$<Diary>(
        `diaries/${id}`, buf => JSON.parse(buf.toString()) as Diary
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly page$ = this.pageId$.pipe(
    switchMap(id =>
      this.liveObjectService.getObjectById$<Page>(
        `pages/${id}`, buf => JSON.parse(buf.toString()) as Page
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly fragment$ = this.fragmentId$.pipe(
    switchMap(id =>
      this.liveObjectService.getObjectById$<Fragment>(
        `fragments/${id}`, buf => JSON.parse(buf.toString()) as Fragment
      )
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly marquee$ = this.marqueeId$.pipe(
    switchMap(id =>
      id != null
        ? this.liveObjectService.getObjectById$<Marquee>(
          `marquees/${id}`, buf => JSON.parse(buf.toString()) as Marquee
        )
        : of(null)
    ),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // Live collections

  /** the currently selected diary’s pages, kept up to date whenever diaryId$ emits */
  readonly pages$: Observable<Page[]> = this.diaryId$.pipe(
    // skip any “null” or uninitialized id
    filter((id): id is number => id != null),
    // whenever the diaryId changes, tear down the old subscription and open a new one
    switchMap(id => {
      const topicFilters = [`diaries/${id}/+`];
      // keep track so you can unsubscribe later if you like
      topicFilters.forEach(f => this.activeTopicFilters.add(f));

      return from(this.mqtt.getConnection()).pipe(
        switchMap(client =>
          this.liveObjectListService.subscribeToTopicTree$<Page>(
            client,
            topicFilters,
            buf => JSON.parse(buf.toString()) as Page
          )
        )
      );
    }),
    // share the same hot stream with anyone who subscribes
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly marquees$ = combineLatest([this.diaryId$, this.pageId$]).pipe(
    // now tells TS “after this point, diaryId & pageId are definitely number”
    filter(
      (ids): ids is [number, number] =>
        ids[0] != null && ids[1] != null
    ),
    switchMap(([diaryId, pageId]) =>
      this.getMarqueesForPage$(diaryId, pageId)
    )
  );

  get fragments$(): Observable<Fragment[]> {
    return from(this.mqtt.getConnection()).pipe(
      switchMap(client =>
        this.liveObjectListService.subscribeToTopicTree$<Fragment>(
          client,
          ['fragments/+'],
          buf => JSON.parse(buf.toString()) as Fragment
        )
      ),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  get fragmentsForSelectedDate$(): Observable<Fragment[]> {
    return combineLatest([
      this.fragment$.pipe(filter(f => f != null)),
      this.fragments$
    ]).pipe(
      map(([selected, all]) =>
        all.filter(f =>
          f.year === selected!.year &&
          f.month === selected!.month &&
          f.day === selected!.day
        )
      )
    );
  }

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

  getMarqueesForPage$(diaryId: number, pageId: number) {
    const topicFilters = [`diaries/${diaryId}/${pageId}/+`];
    topicFilters.forEach(f => this.activeTopicFilters.add(f));

    return from(this.mqtt.getConnection()).pipe(
      switchMap(client =>
        new Observable<Marquee[]>(observer => {
          const sub = this.liveObjectListService
            .subscribeToTopicTree$<Marquee>(client, topicFilters, buf => JSON.parse(buf.toString()))
            .subscribe(observer);

          return () => {
            sub.unsubscribe();
            this.liveObjectListService.unsubscribeTopicTree(topicFilters);
          };
        })
      ),
      // *** HOT + cache it so teardown only happens when everyone really goes away ***
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  cleanupTopicTree(): void {
    console.log(`ModelContext.cleanupTopicTree`);

    this.destroy$.next();
    this.destroy$.complete();

    this.activeTopicFilters.forEach(filter => {
      this.liveObjectListService.unsubscribeTopicTree([filter]);
    });
    this.activeTopicFilters.clear();
  }

  // State setters
  setTitle(title: string) {
    this.title$.next(title);
  }

  setDiaryId(id: number | null) {
    this.diaryIdSubject.next(id);
  }

  setPageId(id: number | null) {
    this.pageIdSubject.next(id);
  }

  setFragmentId(id: number | null) {
    console.log(`ModelContext.setFragmentId: ${id}`);    
    this.fragmentIdSubject.next(id);
  }

  setMarqueeId(id: number | null) {
    this.marqueeIdSubject.next(id);
  }

  fireAddButtonClick(): void {
    this.addButtonClickedSubject.next();
  }
}
