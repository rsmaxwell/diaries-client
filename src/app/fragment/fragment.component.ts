// fragment.component.ts
import { Component, OnInit, ViewChild, OnDestroy, ElementRef, AfterViewInit, ApplicationRef, EnvironmentInjector, createComponent, ComponentRef, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageheaderComponent } from '../headers/pageheader/pageheader.component';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { GoldenLayout, RowOrColumnItemConfig, Side, LayoutConfig } from 'golden-layout';
import { ImageViewerComponent } from './image-viewer/image-viewer.component';
import { TextPanelComponent } from './text-panel/text-panel.component';
import { ModelContext } from '../model/model-context';
import { BehaviorSubject, combineLatest, distinctUntilChanged, firstValueFrom, map, Observable, Subject, take, takeUntil } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { DayviewComponent } from '../dayview/dayview.component';
import { Page } from '../model/page';
import { FileSelection, FilesListDialogComponent } from '../files-list-dialog/files-list-dialog.component';
import { Dialog, DialogModule, DialogRef } from '@angular/cdk/dialog';
import { Rectangle } from '../utilities/rectangle';
import { Marquee } from '../model/marquee';
import { RpcService } from '../mqtt/rpc.service';
import { AlertService } from '../alerts/alert.service';
import { FragmentLockService } from './fragment-lock.service';


@Component({
  selector: 'app-fragment',
  standalone: true,
  imports: [
    CommonModule,
    PageheaderComponent,
    PagefooterComponent,
    DialogModule
  ],
  templateUrl: './fragment.component.html',
  styleUrls: ['./fragment.component.scss']
})
export class FragmentComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('layoutContainer', { static: true }) layoutContainer!: ElementRef<HTMLDivElement>;

  private destroy$ = new Subject<void>();
  private layout: GoldenLayout | undefined;

  pages: Page[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private appRef: ApplicationRef,
    private environmentInjector: EnvironmentInjector,
    private modelContext: ModelContext,
    private dialog: Dialog,
    private rpcService: RpcService,
    private alertService: AlertService,
    private fragmentLockService: FragmentLockService
  ) { }

  // ---------------------------------------------------------------------------
  // Angular lifecycle
  // ---------------------------------------------------------------------------

  ngOnInit(): void {
    // Resolve ids from this route or any parent using the helper
    const diaryId$ = this.idFromRoute$('diaryId');
    const pageId$ = this.idFromRoute$('pageId');
    const rawFragId$ = this.idFromRoute$('fragmentId');

    // Push into ModelContext (allow null to clear; ModelContext guards handle NaN)
    diaryId$.pipe(takeUntil(this.destroy$)).subscribe(id => this.modelContext.setDiaryId(id));
    pageId$.pipe(takeUntil(this.destroy$)).subscribe(id => this.modelContext.setPageId(id));

    // Normalize fragment id (null when absent or 0)
    const fragmentIdOrNull$ = rawFragId$.pipe(
      map(id => (id != null && id > 0) ? id : null),
      distinctUntilChanged()
    );

    // Push to ModelContext; clear marquee if fragment clears
    fragmentIdOrNull$
      .pipe(takeUntil(this.destroy$))
      .subscribe(fid => {
        this.modelContext.setFragmentId(fid);
        if (fid === null) {
          this.modelContext.setMarqueeId(null);
        }
      });

    // Pages list - ordered by sequence number (unchanged)
    this.modelContext.pages$
      .pipe(
        map(pages => pages ?? []),
        map(pages => pages.slice().sort((a, b) => a.sequence - b.sequence)),
        distinctUntilChanged((a, b) => a.length === b.length && a.every((x, i) => x.id === b[i].id)),
        takeUntil(this.destroy$)
      )
      .subscribe(pages => {
        this.pages = pages;
      });
  }

  ngAfterViewInit(): void {
    const layoutConfig: LayoutConfig = {
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
              }
              ,
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
        hasHeaders: true,
        showPopoutIcon: false,
        showMaximiseIcon: false,
        showCloseIcon: false
      },
      header: {
        show: Side.top,
        close: false
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

    // ResizeObserver
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        // contentRect is universally supported
        const { width, height } = entry.contentRect;

        // call the new API
        this.layout?.setSize(width, height);
      }
    });
    ro.observe(this.layoutContainer.nativeElement);
  }

  ngOnDestroy(): void {
    console.log(`FragmentComponent.ngOnDestroy`);

    this.destroy$.next();
    this.destroy$.complete();

    if (this.layout) {
      this.layout.destroy();
      console.log('FragmentComponent: destroyed GoldenLayout');
    }
  }

  // ---------------------------------------------------------------------------
  // Header actions
  // ---------------------------------------------------------------------------

  onAddButtonClick() {
    console.log(`FragmentComponent.onAddButtonClick`);
    this.modelContext.fireAddButtonClick();
  }

  onDeleteButtonClick(): void {
    console.log(`FragmentComponent.onDeleteButtonClick`);
    this.modelContext.fireDeleteButtonClick();
  }

  openFilesDialog() {
    const path$ = new BehaviorSubject<string>('/');

    const ref: DialogRef<FileSelection, FilesListDialogComponent> =
      this.dialog.open(FilesListDialogComponent, {
        width: '980px',
        panelClass: 'files-dialog-panel',
        data: { path$, select: true }
      });

    ref.closed.pipe(take(1)).subscribe(res => {
      path$.complete();
      if (!res) return;
      const { url, name } = res;
      // …use the selected URL…
      console.log(`FragmentComponent.openFilesDialog: url: ${url}`);
    });
  }

  onEditMarqueeClick() {
    console.log(`FragmentComponent.onEditMarqueeClick`);
    this.modelContext.toggleEditMarqueeMode();
  }

  async onCreateMarqueeClick(): Promise<void> {
    console.log(`FragmentComponent.onCreateMarqueeClick`);

    const [fragment, page, diary] = await firstValueFrom(
      combineLatest([
        this.modelContext.selectedFragment$,
        this.modelContext.selectedPage$,
        this.modelContext.selectedDiary$
      ]).pipe(take(1))
    );

    if (!diary) {
      this.alertService.error('No diary is currently selected');
      return;
    }

    if (!page) {
      this.alertService.error('No page is currently selected');
      return;
    }

    if (!fragment) {
      this.alertService.error('No fragment is currently selected');
      return;
    }

    const marqueeId = fragment.marqueeId;
    if (marqueeId != null) {
      this.modelContext.setMarqueeId(marqueeId);
      this.router.navigate(['/diary', diary.id, page.id, fragment.id]);
      this.alertService.info('This fragment already has a marquee');
      return;
    }

    const rectangle = new Rectangle(
      page.width / 5,
      page.height / 5,
      (3 * page.width) / 5,
      (3 * page.height) / 5
    );

    const locked = await this.fragmentLockService.lockFragmentForEdit(fragment.id);
    if (!locked) {
      return;
    }

    this.rpcService.addMarquee$(page, fragment.id, rectangle)
      .pipe(take(1))
      .subscribe({
        next: (m: Marquee) => {
          this.alertService.info(`Marquee ${m.id} added`);

          this.modelContext.setFragmentId(fragment.id);
          this.modelContext.setMarqueeId(m.id);

          this.router.navigate([
            '/diary',
            diary.id,
            page.id,
            fragment.id
          ]);
        },

        error: err => {
          console.warn('FragmentComponent.onCreateMarqueeClick failed', err);
          this.fragmentLockService.unlockFragmentAfterFailedEdit(fragment.id);
          this.alertService.error('Could not add marquee');
        }
      });
  }

  async onDeleteMarqueeClick(): Promise<void> {
    console.log(`FragmentComponent.onDeleteMarqueeClick`);

    const [fragment, page, diary] = await firstValueFrom(
      combineLatest([
        this.modelContext.selectedFragment$,
        this.modelContext.selectedPage$,
        this.modelContext.selectedDiary$
      ]).pipe(take(1))
    );

    if (!fragment) {
      this.alertService.error('No fragment is currently selected');
      return;
    }

    if (!page || !diary) {
      this.alertService.error('No page/diary is currently selected');
      return;
    }

    if (fragment.marqueeId == null) {
      this.alertService.info('The selected fragment does not have a marquee');
      return;
    }

    const marqueeId = fragment.marqueeId;

    const locked = await this.fragmentLockService.lockFragmentForEdit(fragment.id);
    if (!locked) {
      return;
    }

    this.rpcService.deleteMarquee$(marqueeId)
      .pipe(take(1))
      .subscribe({
        next: id => {
          this.alertService.info(`Marquee ${id} deleted`);

          this.modelContext.setMarqueeId(null);
          this.modelContext.setFragmentId(fragment.id);

          this.router.navigate([
            '/diary',
            diary.id,
            page.id,
            fragment.id
          ]);
        },

        error: err => {
          console.warn('FragmentComponent.onDeleteMarqueeClick failed', err);
          this.fragmentLockService.unlockFragmentAfterFailedEdit(fragment.id);
          this.alertService.error('Could not delete marquee');
        }
      });
  }

  // ---------------------------------------------------------------------------
  // Footer navigation actions
  // ---------------------------------------------------------------------------

  onBackPressed() {
    const diaryId = +this.route.snapshot.paramMap.get('diaryId')!;
    const pageId = +this.route.snapshot.paramMap.get('pageId')!;
    const i = this.pages.findIndex(p => p.id === pageId);
    if (i >= 1) {
      const prev = this.pages[i - 1];
      console.log(`FragmentComponent.onBackPressed: diaryId: ${diaryId}, prev.id:/${prev.id}`);
      this.router.navigate(['/diary', diaryId, prev.id]);
    }
  }

  onUpPressed() {
    const diaryId = +this.route.snapshot.paramMap.get('diaryId')!;
    console.log('FragmentComponent: Up pressed');
    this.router.navigate(['/diary', diaryId]);
  }

  onForwardPressed() {
    const diaryId = +this.route.snapshot.paramMap.get('diaryId')!;
    const pageId = +this.route.snapshot.paramMap.get('pageId')!;
    const i = this.pages.findIndex(p => p.id === pageId);
    if (i >= 0 && i < this.pages.length - 1) {
      const next = this.pages[i + 1];
      console.log(`FragmentComponent.onForwardPressed: diaryId: ${diaryId}, next.id:/${next.id}`);
      this.router.navigate(['/diary', diaryId, next.id]);
    }
  }

  // ---------------------------------------------------------------------------
  // Route/model helpers
  // ---------------------------------------------------------------------------

  // Number (or null) with safe parsing
  private idFromRoute$(key: string): Observable<number | null> {
    return this.route.paramMap.pipe(
      map(pm => pm.get(key)),
      map(v => (v !== null && /^\d+$/.test(v) ? parseInt(v, 10) : null)),
      distinctUntilChanged()
    );
  }

  // ---------------------------------------------------------------------------
  // GoldenLayout helpers
  // ---------------------------------------------------------------------------

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
}
