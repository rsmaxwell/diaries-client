// fragment.component.ts
import { Component, OnInit, ViewChild, OnDestroy, ElementRef, AfterViewInit, ApplicationRef, EnvironmentInjector, createComponent } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageheaderComponent } from '../headers/pageheader/pageheader.component';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
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
        console.log('🔄 Route changed: diaryId', diaryId, 'pageId', pageId, 'marqueeId', marqueeId);

        if (diaryId) {
          this.modelContext.setDiaryId(diaryId);
        }

        if (pageId) {
          this.modelContext.setPageId(pageId);
        }

        if (marqueeId != null && !isNaN(marqueeId)) {
          this.modelContext.setMarqueeId(marqueeId);
        } else {
          this.modelContext.setMarqueeId(null); // Clear if not present
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

    this.layout = new GoldenLayout(this.layoutContainer.nativeElement);

    // Register your Angular components
    this.layout.registerComponentFactoryFunction('ImageViewer', (container) => {
      this.bindComponent(container, ImageViewerComponent);
    });

    this.layout.registerComponentFactoryFunction('TextPanel', (container) => {
      this.bindComponent(container, TextPanelComponent);
    });

    this.layout.loadLayout(layoutConfig);
  }

  private bindComponent(container: any, component: any): void {
    const componentRef = createComponent(component, {
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.layout) {
      this.layout.destroy(); // 🗑️ Clean up panels & event handlers
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
