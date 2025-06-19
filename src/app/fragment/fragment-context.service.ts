import { ElementRef, Injectable } from "@angular/core";
import { BehaviorSubject, Subject } from "rxjs";
import { Fragment } from "../model/fragment";
import { ImageViewerComponent } from "./image-viewer/image-viewer.component";

@Injectable({ providedIn: 'root' })
export class FragmentContextService {
    
    private fragmentIdSubject = new BehaviorSubject<number | null>(null);
    fragmentId$ = this.fragmentIdSubject.asObservable();

    title$ = new BehaviorSubject<string>('Fragment');

    private addButtonClickedSubject = new Subject<void>();
    addButtonClicked$ = this.addButtonClickedSubject.asObservable();


    setFragmentId(id: number) {
        this.fragmentIdSubject.next(id);
    }

    setTitle(title: string) {
        this.title$.next(title);
    }

    fireAddButtonClick(): void {
        this.addButtonClickedSubject.next();
    }
}
