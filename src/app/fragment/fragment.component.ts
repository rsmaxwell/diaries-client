// fragment.component.ts
import { Component, OnInit, ViewChild, OnDestroy, ElementRef, AfterViewInit, ApplicationRef, EnvironmentInjector, createComponent, ComponentRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageheaderComponent } from '../headers/pageheader/pageheader.component';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { GoldenLayout, RowOrColumnItemConfig } from 'golden-layout';
import { ImageViewerComponent } from './image-viewer/image-viewer.component';
import { TextPanelComponent } from './text-panel/text-panel.component';
import { ModelContext } from '../model/model-context';
import { map, of, Subject, switchMap, takeUntil } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { Page } from '../model/page';
import { Fragment } from '../model/fragment';


@Component({
  selector: 'app-fragment',
  standalone: true,
  imports: [
    CommonModule,
    PageheaderComponent,
    PagefooterComponent
  ],
  templateUrl: './fragment.component.html',
  styleUrls: ['./fragment.component.scss']
})
export class FragmentComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('layoutContainer', { static: true }) layoutContainer!: ElementRef<HTMLDivElement>;

  private destroy$ = new Subject<void>();
  private layout: GoldenLayout | undefined;

  title = 'Fragment';

  constructor(
    private route: ActivatedRoute,
    private appRef: ApplicationRef,
    private environmentInjector: EnvironmentInjector,
    private modelContext: ModelContext
  ) { }

  ngOnInit(): void {

    // 🚦 Listen reactively for param changes
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        map(paramMap => ({
          diaryId: paramMap.get('diaryId') ? +paramMap.get('diaryId')! : null,
          pageId: paramMap.get('pageId') ? +paramMap.get('pageId')! : null,
          marqueeId: paramMap.get('marqueeId') ? +paramMap.get('marqueeId')! : null
        }))
      )
      .subscribe(({ diaryId, pageId, marqueeId }) => {
        console.log('FragmentComponent.ngOnInit: Route changed: diaryId', diaryId, 'pageId', pageId, 'marqueeId', marqueeId);

        if (diaryId) {
          console.log(`FragmentComponent.ngOnInit: modelContext.setDiaryId: ${diaryId}`);          
          this.modelContext.setDiaryId(diaryId);
        }

        if (pageId) {
          console.log(`FragmentComponent.ngOnInit: modelContext.setPageId: ${pageId}`);           
          this.modelContext.setPageId(pageId);
        }

        if (marqueeId != null && !isNaN(marqueeId)) {
          this.modelContext.setMarqueeId(marqueeId);
        } else {
          this.modelContext.setMarqueeId(null); // Clear if not present
        }
      })
  }

  // Generic bindComponent: strongly typed and reusable
  private bindComponent<T>(container: any, component: any): void {
    const componentRef: ComponentRef<T> = createComponent<T>(component, {
      environmentInjector: this.environmentInjector,
    });

    // Store for later cleanup:
    container.componentRef = componentRef;

    this.appRef.attachView(componentRef.hostView);
    container.element!.append(componentRef.location.nativeElement);

    // Hook up destroy
    container.on('destroy', () => {
      console.log('GoldenLayout: destroying Angular component');
      this.appRef.detachView(componentRef.hostView);
      componentRef.destroy();
    });

    // ✅ Hook up the dynamic titles
    if (component === ImageViewerComponent) {
      this.modelContext.page$
        .pipe(takeUntil(this.destroy$))
        .subscribe(page => {
          const title = page ? `page.name = ${page.name}` : 'No Page';
          container.setTitle(title);
        });
    }

    // ✅ Instead of switchMap(... getFragmentById$ ...)
    if (component === TextPanelComponent) {
      this.modelContext.fragment$
        .pipe(takeUntil(this.destroy$))
        .subscribe(fragment => {
          const title = fragment ? `fragment.id = ${fragment.id}` : 'No Fragment';
          container.setTitle(title);
        });
    }
  }

  ngAfterViewInit(): void {
    const layoutConfig = {
      root: <RowOrColumnItemConfig>{
        type: 'row',
        content: [
          {
            type: 'component',
            componentType: 'ImageViewer',
            title: 'Image Viewer'
          },
          {
            type: 'component',
            componentType: 'TextPanel',
            title: 'Text Panel'
          }
        ]
      },
      settings: {
        hasHeaders: true
      }
    };

    this.layout = new GoldenLayout(this.layoutContainer.nativeElement);

    // Register your Angular components
    this.layout.registerComponentFactoryFunction('ImageViewer', (container) => {
      this.bindComponent<ImageViewerComponent>(container, ImageViewerComponent);
    });

    this.layout.registerComponentFactoryFunction('TextPanel', (container) => {
      this.bindComponent<TextPanelComponent>(container, TextPanelComponent);
    });

    this.layout.loadLayout(layoutConfig);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.layout) {
      this.layout.destroy();
      console.log('FragmentComponent: destroyed GoldenLayout');
    }
  }

  onBackPressed() {
    console.log(`FragmentComponent.onBackPressed`);
  }

  onUpPressed() {
    console.log('FragmentComponent: Up pressed');
  }

  onForwardPressed() {
    console.log('FragmentComponent: Forward pressed');
  }

  onAddButtonClick() {
    console.log(`FragmentComponent.onAddButtonClick`);
    this.modelContext.fireAddButtonClick();
  }

  onTitleChanged(title: string) {
    this.title = title;
  }
}
