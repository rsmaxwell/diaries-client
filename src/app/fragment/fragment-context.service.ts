import { Injectable } from "@angular/core";
import { BehaviorSubject, combineLatest, EMPTY, Subject, switchMap } from "rxjs";
import { LiveObjectListService } from "../mqtt/live.object.list.service";
import { LiveObjectService } from "../mqtt/live.object.service";

@Injectable({ providedIn: 'root' })
export class FragmentContextService {

    // Context state   
    private addButtonClickedSubject = new Subject<void>();
    private diaryIdSubject = new BehaviorSubject<number | null>(null);
    private pageIdSubject = new BehaviorSubject<number | null>(null);
    private fragmentIdSubject = new BehaviorSubject<number | null>(null);

    // Exposed observables for IDs
    readonly addButtonClicked$ = this.addButtonClickedSubject.asObservable();    
    readonly title$ = new BehaviorSubject<string>('Fragment'); 
    readonly diaryId$ = this.diaryIdSubject.asObservable();
    readonly pageId$ = this.pageIdSubject.asObservable();
    readonly fragmentId$ = this.fragmentIdSubject.asObservable();

    // Live single objects
    readonly diary$ = this.diaryId$.pipe(
        switchMap(id => (id != null ? this.liveObjectService.getDiaryById$(id) : EMPTY))
    );

    readonly page$ = this.pageId$.pipe(
        switchMap(id => (id != null ? this.liveObjectService.getPageById$(id) : EMPTY))
    );

    readonly fragment$ = this.fragmentId$.pipe(
        switchMap(id => (id != null ? this.liveObjectService.getFragmentById$(id) : EMPTY))
    );

    // Live collections
    readonly pages$ = this.diaryId$.pipe(
        switchMap(id => (id != null ? this.liveObjectListService.getPagesForDiary$(id) : EMPTY))
    );

    readonly marquees$ = combineLatest([this.diaryId$, this.pageId$]).pipe(
        switchMap(([diaryId, pageId]) =>
            diaryId != null && pageId != null
                ? this.liveObjectListService.getMarqueesForPage$(diaryId, pageId)
                : EMPTY
        )
    );

    constructor(
        private liveObjectService: LiveObjectService,
        private liveObjectListService: LiveObjectListService
    ) { }


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

    setFragmentId(id: number | null) {
        this.fragmentIdSubject.next(id);
    }

    clearContext() {
        this.diaryIdSubject.next(null);
        this.pageIdSubject.next(null);
        this.fragmentIdSubject.next(null);
    }

    fireAddButtonClick(): void {
        this.addButtonClickedSubject.next();
    }
}
