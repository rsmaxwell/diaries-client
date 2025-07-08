// fragment.component.ts
import { Component, OnInit, ViewChild, OnDestroy, ElementRef, AfterViewInit, ApplicationRef, EnvironmentInjector, createComponent } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageheaderComponent } from '../headers/pageheader/pageheader.component';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { Fragment } from '../model/fragment';
import { GoldenLayout, RowOrColumnItemConfig } from 'golden-layout';
import { ImageViewerComponent } from './image-viewer/image-viewer.component';
import { TextPanelComponent } from './text-panel/text-panel.component';
import { ModelContext } from '../model/model-context';
import { map, Subject, takeUntil } from 'rxjs';
import { ActivatedRoute } from '@angular/router';


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

  title = 'Fragment';

  constructor(
    private route: ActivatedRoute,
    private appRef: ApplicationRef,
    private environmentInjector: EnvironmentInjector,
    private fragmentContext: ModelContext
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
        console.log('🔄 Route changed: diaryId', diaryId, 'pageId', pageId, 'marqueeId', marqueeId);

        if (diaryId) {
          this.fragmentContext.setDiaryId(diaryId);
        }

        if (pageId) {
          this.fragmentContext.setPageId(pageId);
        }

        if (marqueeId != null && !isNaN(marqueeId)) {
          this.fragmentContext.setMarqueeId(marqueeId);
        } else {
          this.fragmentContext.setMarqueeId(null); // Clear if not present
        }
      });

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

    const layout = new GoldenLayout(this.layoutContainer.nativeElement);

    // Register your Angular components
    layout.registerComponentFactoryFunction('ImageViewer', (container) => {
      this.attachComponentToContainer(container, ImageViewerComponent);
    });

    layout.registerComponentFactoryFunction('TextPanel', (container) => {
      this.attachComponentToContainer(container, TextPanelComponent);
    });

    layout.loadLayout(layoutConfig);
  }

  private attachComponentToContainer(componentContainer: any, component: any): void {
    const componentRef = createComponent(component, {
      environmentInjector: this.environmentInjector,
    });
    this.appRef.attachView(componentRef.hostView);
    componentContainer.element!.append(componentRef.location.nativeElement);
    componentContainer.on('destroy', () => {
      this.appRef.detachView(componentRef.hostView);
      componentRef.destroy();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
    this.fragmentContext.fireAddButtonClick();
  }

  onTitleChanged(title: string) {
    this.title = title;
  }
}
