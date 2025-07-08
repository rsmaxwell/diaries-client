import { Injectable } from "@angular/core";
import { BehaviorSubject, combineLatest, EMPTY, from, Observable, of, ReplaySubject, Subject, switchMap } from "rxjs";
import { LiveObjectListService } from "../mqtt/live.object.list.service";
import { LiveObjectService } from "../mqtt/live.object.service";
import { Marquee } from "../model/marquee";
import { MqttService } from "../mqtt/mqtt.service";
import { Diary } from "../model/diary";
import { Page } from "../model/page";

@Injectable({ providedIn: 'root' })
export class FragmentContextService {

  private activeTopicFilters = new Set<string>();

  // Context state   
  private addButtonClickedSubject = new Subject<void>();
  private diaryIdSubject = new ReplaySubject<number>();
  private pageIdSubject = new ReplaySubject<number>();
  private marqueeIdSubject = new BehaviorSubject<number | null>(null);
  private fragmentIdSubject = new BehaviorSubject<number | null>(null);

  // Exposed observables for IDs
  readonly addButtonClicked$ = this.addButtonClickedSubject.asObservable();
  readonly title$ = new BehaviorSubject<string>('Fragment');
  readonly diaryId$ = this.diaryIdSubject.asObservable();
  readonly pageId$ = this.pageIdSubject.asObservable();
  readonly marqueeId$ = this.marqueeIdSubject.asObservable();
  readonly fragmentId$ = this.fragmentIdSubject.asObservable();

  // Live single objects
  readonly diary$ = this.diaryId$.pipe(
    switchMap(id => this.liveObjectService.getDiaryById$(id))
  );

  readonly page$ = this.pageId$.pipe(
    switchMap(id => this.liveObjectService.getPageById$(id))
  );

  readonly marquee$ = this.marqueeId$.pipe(
    switchMap(id => (id != null ? this.liveObjectService.getMarqueeById$(id) : of(null))) // Can be null
  );

  readonly fragment$ = this.fragmentId$.pipe(
    switchMap(id => (id != null ? this.liveObjectService.getFragmentById$(id) : of(null))) // Can be null
  );

  // Live collections
  readonly pages$ = this.diaryId$.pipe(
    switchMap(id => this.getPagesForDiary$(id))
  );

  readonly marquees$ = combineLatest([this.diaryId$, this.pageId$]).pipe(
    switchMap(([diaryId, pageId]) => this.getMarqueesForPage$(diaryId, pageId)
    )
  );

  constructor(
    private mqtt: MqttService,
    private liveObjectService: LiveObjectService,
    private liveObjectListService: LiveObjectListService
  ) { }

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

  getMarqueesForPage$(diaryId: number, pageId: number): Observable<Marquee[]> {
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
    this.fragmentIdSubject.next(id);
  }

  fireAddButtonClick(): void {
    this.addButtonClickedSubject.next();
  }
}
