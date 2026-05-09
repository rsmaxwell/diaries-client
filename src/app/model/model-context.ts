import { Injectable } from "@angular/core";
import { BehaviorSubject, combineLatest, distinctUntilChanged, filter, from, map, Observable, of, shareReplay, Subject, switchMap, takeUntil } from "rxjs";
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
  private editMarqueeModeSubject = new BehaviorSubject<boolean>(false);
  private hasSelectedMarqueeSubject = new BehaviorSubject<boolean>(false);
  private addButtonClickedSubject = new Subject<void>();
  private diaryIdSubject = new BehaviorSubject<number | null>(null);
  private pageIdSubject = new BehaviorSubject<number | null>(null);
  private fragmentIdSubject = new BehaviorSubject<number | null>(null);
  private marqueeIdSubject = new BehaviorSubject<number | null>(null);  // Can be null

  // Exposed observables for IDs
  readonly editMarqueeMode$ = this.editMarqueeModeSubject.asObservable();
  readonly hasSelectedMarquee$ = this.hasSelectedMarqueeSubject.asObservable();
  readonly addButtonClicked$ = this.addButtonClickedSubject.asObservable();
  readonly title$ = new BehaviorSubject<string>('Fragment');
  readonly diaryId$ = this.diaryIdSubject.asObservable();
  readonly pageId$ = this.pageIdSubject.asObservable();
  readonly fragmentId$ = this.fragmentIdSubject.asObservable();
  readonly marqueeId$ = this.marqueeIdSubject.asObservable();

  private destroy$ = new Subject<void>();

  private liveMarquees = new Map<number, Observable<Marquee | null>>();
  private liveFragments = new Map<number, Observable<Fragment | null>>();
  private livePages = new Map<number, Observable<Page>>();
  private liveDiaries = new Map<number, Observable<Diary>>();

  private pageCache = new Map<number, Page>();
  private marqueeCache = new Map<number, Marquee>(); // not a global mqrquee cache, but a current-page marquee cache

  selectedMarquee$: Observable<Marquee | null>;
  selectedFragment$: Observable<Fragment | null>;
  selectedPage$: Observable<Page>;
  selectedDiary$: Observable<Diary>;

  pages$: Observable<Page[]>;
  marquees$: Observable<Marquee[]>;
  fragments$: Observable<Fragment[]>;
  selectFragmentsForDate$: Observable<Fragment[]>;

  constructor(
    private mqtt: MqttService,
    private liveObjectListService: LiveObjectListService,
    private liveObjectService: LiveObjectService
  ) {

    this.selectedMarquee$ = this.marqueeId$.pipe(
      switchMap(id =>
        Number.isFinite(id) ? this.getLiveMarquee$(id as number) : of(null)
      )
    );

    this.selectedFragment$ = this.fragmentId$.pipe(
      switchMap(id =>
        Number.isFinite(id) ? this.getLiveFragment$(id as number) : of(null)
      )
    );

    this.selectedPage$ = this.pageId$.pipe(
      filter((id): id is number => Number.isFinite(id)),
      switchMap(id => this.getLivePage$(id))
    );

    this.selectedDiary$ = this.diaryId$.pipe(
      filter((id): id is number => Number.isFinite(id)),
      switchMap(id => this.getLiveDiary$(id))
    );

    this.pages$ = this.diaryId$.pipe(
      filter((id): id is number => Number.isFinite(id)),
      switchMap(id => {
        const topicFilters = [`diaries/diaries/${id}/+`];
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
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.marquees$ = combineLatest([this.diaryId$, this.pageId$]).pipe(
      filter(
        (ids): ids is [number, number] =>
          Number.isFinite(ids[0] as number) && Number.isFinite(ids[1] as number)
      ),
      switchMap(([diaryId, pageId]) => this.getMarqueesForPage$(diaryId, pageId))
    );


    combineLatest([this.fragmentId$, this.marquees$])
      .pipe(
        map(([fragmentId, marquees]) => {
          if (!Number.isFinite(fragmentId)) return null;
          const m = marquees.find(x => x.fragmentId === fragmentId);
          return m ? m.id : null;
        }),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe((marqueeId) => this.setMarqueeId(marqueeId));


    // selectedFragment$ should emit Fragment | null
    this.selectedFragment$ = this.fragmentId$.pipe(
      switchMap(id => Number.isFinite(id) ? this.getLiveFragment$(id as number) : of(null))
    );

    // Build the Dayview list for the selected date
    this.fragments$ = this.selectedFragment$.pipe(
      switchMap(selected => {
        if (!selected) return of([] as Fragment[]); // nothing selected → clear list

        const { year: y, month: m, day: d } = selected;
        const topicFilters = [`diaries/dates/${y}/${m}/${d}/+`];
        topicFilters.forEach(f => this.activeTopicFilters.add(f));

        return from(this.mqtt.getConnection()).pipe(
          switchMap(client =>
            this.liveObjectListService.subscribeToTopicTree$<Fragment>(
              client, topicFilters, buf => JSON.parse(buf.toString()) as Fragment
            )
          )
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );


    this.selectFragmentsForDate$ = combineLatest([
      this.selectedFragment$,
      this.fragments$
    ]).pipe(
      map(([selected, all]) =>
        selected ? all.filter(f =>
          f.year === selected.year &&
          f.month === selected.month &&
          f.day === selected.day
        ) : []
      )
    );

    // Clear caches when context pivots
    this.diaryId$.subscribe(() => {
      this.pageCache.clear();
      this.marqueeCache.clear();
    });
    this.pageId$.subscribe(() => {
      this.marqueeCache.clear();
    });

    // Populate caches from your existing streams
    this.pages$.subscribe(pages => {
      for (const p of pages) this.pageCache.set(p.id, p);
    });

    this.marquees$.subscribe(marquees => {
      for (const m of marquees) this.marqueeCache.set(m.id, m);
    });
  }






  getLiveMarquee$(id: number): Observable<Marquee | null> {
    if (!this.liveMarquees.has(id)) {
      const topic = `diaries/marquees/${id}`;
      const observable$ = this.liveObjectService.getObjectById$<Marquee>(topic, buf => JSON.parse(buf.toString()) as Marquee)
        .pipe(
          shareReplay({ bufferSize: 1, refCount: true })
        );

      this.liveMarquees.set(id, observable$);
    }

    return this.liveMarquees.get(id)!;
  }

  /*
   * When we know the id of a marquee we want to explicitly stop listening to.
   */
  unsubscribeMarquee(id: number): void {
    const topic = `diaries/marquees/${id}`;

    if (this.liveMarquees.has(id)) {
      console.log(`ModelContext.unsubscribeMarquee: unsubscribing from ${topic}`);
      this.liveMarquees.delete(id);
      this.liveObjectService.unsubscribeTopic(topic);
    }
  }

  /* 
   * Unsubscribe from all active marquee topics and clear the entire liveMarquee map.
   * To be when we know we're done with a particular marquee.
   */
  releaseLiveMarquee(): void {
    this.liveMarquees.forEach((_obs, id) => {
      const topic = `diaries/marquees/${id}`;
      console.log(`ModelContext.releaseLiveMarquee: unsubscribing from ${topic}`);
      this.liveObjectService.unsubscribeTopic(topic);
    });

    this.liveMarquees.clear();
  }






  getLiveFragment$(id: number): Observable<Fragment | null> {
    if (!this.liveFragments.has(id)) {
      const topic = `diaries/fragments/${id}`;
      const observable$ = this.liveObjectService.getObjectById$<Fragment>(topic, buf => JSON.parse(buf.toString()) as Fragment)
        .pipe(
          shareReplay({ bufferSize: 1, refCount: true })
        );

      this.liveFragments.set(id, observable$);
    }

    return this.liveFragments.get(id)!;
  }

  /*
   * When we know the id of a fragment we want to explicitly stop listening to.
   */
  unsubscribeFragment(id: number): void {
    const topic = `diaries/fragments/${id}`;

    if (this.liveFragments.has(id)) {
      console.log(`ModelContext.unsubscribeFragment: unsubscribing from ${topic}`);
      this.liveFragments.delete(id);
      this.liveObjectService.unsubscribeTopic(topic);
    }
  }

  /* 
   * Unsubscribe from all active fragment topics and clear the entire liveFragments map.
   * To be when we know we're done with a particular fragment.
   */
  releaseLiveFragment(): void {
    this.liveFragments.forEach((_obs, id) => {
      const topic = `diaries/fragments/${id}`;
      console.log(`ModelContext.releaseLiveFragment: unsubscribing from ${topic}`);
      this.liveObjectService.unsubscribeTopic(topic);
    });

    this.liveFragments.clear();
  }







  getLivePage$(id: number): Observable<Page> {
    const cached = this.livePages.get(id);
    if (cached) return cached;

    const topic = `diaries/pages/${id}`;

    const observable$ = this.liveObjectService
      .getObjectById$<Page>(topic, buf => JSON.parse(buf.toString()) as Page) // emits Page | null
      .pipe(
        // Narrow to Page (drops nulls) so the type becomes Observable<Page>
        filter((p): p is Page => p !== null),
        shareReplay({ bufferSize: 1, refCount: true })
      );

    this.livePages.set(id, observable$);   // ✅ types now match
    return observable$;
  }

  /*
   * When we know the id of a page we want to explicitly stop listening to.
   */
  unsubscribePage(id: number): void {
    const topic = `diaries/pages/${id}`;

    if (this.livePages.has(id)) {
      console.log(`ModelContext.unsubscribePage: unsubscribing from ${topic}`);
      this.livePages.delete(id);
      this.liveObjectService.unsubscribeTopic(topic);
    }
  }

  /* 
   * Unsubscribe from all active page topics and clear the entire livePages map.
   * To be when we know we're done with a particular page.
   */
  releaseLivePage(): void {
    this.livePages.forEach((_obs, id) => {
      const topic = `diaries/pages/${id}`;
      console.log(`ModelContext.releaseLivePage: unsubscribing from ${topic}`);
      this.liveObjectService.unsubscribeTopic(topic);
    });

    this.livePages.clear();
  }







  getLiveDiary$(id: number): Observable<Diary> {
    const cached = this.liveDiaries.get(id);
    if (cached) return cached;

    const topic = `diaries/diaries/${id}`;
    const observable$ = this.liveObjectService
      .getObjectById$<Diary>(topic, buf => JSON.parse(buf.toString()) as Diary)
      .pipe(
        filter((d): d is Diary => d !== null),
        shareReplay({ bufferSize: 1, refCount: true })
      );

    this.liveDiaries.set(id, observable$);
    return observable$;
  }

  /*
   * When we know the id of a diary we want to explicitly stop listening to.
   */
  unsubscribeDiary(id: number): void {
    const topic = `diaries/diaries/${id}`;

    if (this.liveDiaries.has(id)) {
      console.log(`ModelContext.unsubscribeDiary: unsubscribing from ${topic}`);
      this.liveDiaries.delete(id);
      this.liveObjectService.unsubscribeTopic(topic);
    }
  }

  /* 
   * Unsubscribe from all active diary topics and clear the entire liveDiaries map.
   * To be used when we know we're done with a particular diary.
   */
  releaseLiveDiary(): void {
    this.liveDiaries.forEach((_obs, id) => {
      const topic = `diaries/diaries/${id}`;
      console.log(`ModelContext.releaseLiveDiary: unsubscribing from ${topic}`);
      this.liveObjectService.unsubscribeTopic(topic);
    });

    this.liveDiaries.clear();
  }

  getDiaries$(): Observable<Diary[]> {
    const topicFilters = [`diaries/diaries/+`];
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
    const topicFilters = [`diaries/diaries/${diaryId}/${pageId}/+`];
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

    this.pageCache.clear();
    this.marqueeCache.clear();
  }

  // State setters
  setTitle(title: string) {
    this.title$.next(title);
  }

  setDiaryId(id: number | null) {
    if (id === null) { this.diaryIdSubject.next(null); return; }
    if (!Number.isFinite(id)) { console.warn('setDiaryId ignored non-finite value:', id); return; }
    this.diaryIdSubject.next(id);
  }

  setPageId(id: number | null) {
    if (id === null) { this.pageIdSubject.next(null); return; }
    if (!Number.isFinite(id)) { console.warn('setPageId ignored non-finite value:', id); return; }
    this.pageIdSubject.next(id);
  }

  setFragmentId(id: number | null) {
    if (id === null) { this.fragmentIdSubject.next(null); return; }
    if (!Number.isFinite(id)) { console.warn('setFragmentId ignored non-finite value:', id); return; }
    this.fragmentIdSubject.next(id);
  }

  setMarqueeId(id: number | null) {
    if (id === null) { this.marqueeIdSubject.next(null); return; }
    if (!Number.isFinite(id)) { console.warn('setMarqueeId ignored non-finite value:', id); return; }
    this.marqueeIdSubject.next(id);
  }

  fireAddButtonClick(): void {
    this.addButtonClickedSubject.next();
  }

  toggleEditMarqueeMode(): void {
    this.editMarqueeModeSubject.next(!this.editMarqueeModeSubject.value);
  }

  setEditMarqueeMode(value: boolean): void {
    this.editMarqueeModeSubject.next(value);
  }

  getEditMarqueeMode(): boolean {
    return this.editMarqueeModeSubject.value;
  }

  setHasSelectedMarquee(value: boolean): void {
    this.hasSelectedMarqueeSubject.next(value);

    // Optional: if no marquee is selected, force edit mode off.
    if (!value) {
      this.setEditMarqueeMode(false);
    }
  }

  // PUBLIC SYNC GETTERS (used by DayviewComponent.goToFragment)
  getPageById(id: number): Page | undefined {
    return this.pageCache.get(id);
  }

  getMarqueeById(id: number): Marquee | undefined {
    return this.marqueeCache.get(id);
  }

}

