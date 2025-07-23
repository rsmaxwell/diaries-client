// fragment.component.ts
import { Component, OnInit, ViewChild, OnDestroy, ElementRef, AfterViewInit, ApplicationRef, EnvironmentInjector, createComponent, ComponentRef, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageheaderComponent } from '../headers/pageheader/pageheader.component';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { GoldenLayout, RowOrColumnItemConfig } from 'golden-layout';
import { ImageViewerComponent } from './image-viewer/image-viewer.component';
import { TextPanelComponent } from './text-panel/text-panel.component';
import { ModelContext } from '../model/model-context';
import { filter, map, of, Subject, switchMap, takeUntil } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { Page } from '../model/page';
import { Fragment } from '../model/fragment';
import { DayviewComponent } from '../dayview/dayview.component';


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

  constructor(
    private route: ActivatedRoute,
    private appRef: ApplicationRef,
    private environmentInjector: EnvironmentInjector,
    private modelContext: ModelContext
  ) { }

  ngOnInit(): void {

    // 🚦 Listen reactively for param changes
    const params$ = this.route.paramMap.pipe(
      takeUntil(this.destroy$),
      map(pm => ({
        diaryId: +pm.get('diaryId')!,
        pageId: +pm.get('pageId')!,
        fragmentIdStr: pm.get('fragmentId')
      }))
    );

    // Always push diaryId and pageId
    params$.subscribe(({ diaryId, pageId }) => {
      this.modelContext.setDiaryId(diaryId);
      this.modelContext.setPageId(pageId);
    });

    // Only push fragmentId when it exists and is > 0
    params$
      .pipe(
        filter(({ fragmentIdStr }) => fragmentIdStr !== null),      // skip when there's no param
        map(({ fragmentIdStr }) => +fragmentIdStr!),               // convert to number
        filter(fragmentId => fragmentId > 0)                       // skip the 0 case
      )
      .subscribe(fragmentId => {
        console.log(`FragmentComponent.ngOninit: pushing fragmentId ${fragmentId} to the ModelContext`);
        this.modelContext.setFragmentId(fragmentId);
      });
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
  }

ngAfterViewInit(): void {
  const layoutConfig = {
    root: <RowOrColumnItemConfig>{
      type: 'row',
      content: [
        // Left side: ImageViewer alone
        {
          type: 'component',
          componentType: 'ImageViewer',
          title: 'Page',
          width: 50      // give it ~30% of the width (tweak as you like)
        },
        // Right side: stack/tabs with TextPanel and Dayview
        {
          type: 'stack',
          content: [
            {
              type: 'component',
              componentType: 'TextPanel',
              title: 'Editor'
            },
            {
              type: 'component',
              componentType: 'Dayview',
              title: 'List'
            }
          ]
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

  this.layout.registerComponentFactoryFunction('Dayview', (container) => {
    this.bindComponent<DayviewComponent>(container, DayviewComponent);
  });

  this.layout.loadLayout(layoutConfig);
}

ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();

  if(this.layout) {
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
}
