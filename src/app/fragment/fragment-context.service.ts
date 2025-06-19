import { ElementRef, Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { Fragment } from "../model/fragment";
import { ImageViewerComponent } from "./image-viewer/image-viewer.component";

@Injectable({ providedIn: 'root' })
export class FragmentContextService {
    private fragmentIdSubject = new BehaviorSubject<number | null>(null);
    fragmentId$ = this.fragmentIdSubject.asObservable();
    title$ = new BehaviorSubject<string>('Fragment');
    svgRef$ = new BehaviorSubject<ElementRef<SVGSVGElement> | null>(null);
    private imageViewerComponent: ImageViewerComponent | null = null;

    setFragmentId(id: number) {
        this.fragmentIdSubject.next(id);
    }

    setTitle(title: string) {
        this.title$.next(title);
    }

    setSvgRef(svgRef: ElementRef<SVGSVGElement>) {
        this.svgRef$.next(svgRef);
    }

    setImageViewerComponent(component: ImageViewerComponent) {
        this.imageViewerComponent = component;
    }

    getImageViewerComponent(): ImageViewerComponent | null {
        return this.imageViewerComponent;
    }
}
