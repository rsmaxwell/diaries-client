// fragment.component.ts
import { Component, OnInit, ViewChild, OnDestroy, ElementRef, AfterViewInit, ApplicationRef, EnvironmentInjector, createComponent, ComponentRef, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageheaderComponent } from '../headers/pageheader/pageheader.component';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { GoldenLayout, RowOrColumnItemConfig, Side, LayoutConfig } from 'golden-layout';
import { ImageViewerComponent } from './image-viewer/image-viewer.component';
import { TextPanelComponent } from './text-panel/text-panel.component';
import { ModelContext } from '../model/model-context';
import { BehaviorSubject, combineLatest, distinctUntilChanged, filter, firstValueFrom, map, Observable, Subject, switchMap, take, takeUntil, timeout } from 'rxjs';
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
import { AddImageFragmentRequest, Fragment, hasAuthoritativePage, ImageFragment, isImageFragment, isMarqueeFragment } from '../model/fragment';
import { canAddImageFragment, nextFragmentSequence } from './image-fragment-authoring';
import { ImageFragmentReferenceComponent } from './image-fragment-reference.component';
import { ClearImageConfirmationComponent } from './clear-image-confirmation.component';
import { ImageFragmentActionStateService } from './image-fragment-action-state.service';
import { imageFragmentAuthoringErrorMessage } from './image-fragment-authoring-errors';


@Component({
  selector: 'app-fragment',
  standalone: true,
  imports: [
    CommonModule,
    PageheaderComponent,
    PagefooterComponent,
    ImageFragmentReferenceComponent,
    DialogModule
  ],
  templateUrl: './fragment.component.html',
  styleUrls: ['./fragment.component.scss'],
  providers: [ImageFragmentActionStateService]
})
export class FragmentComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('layoutContainer', { static: true }) layoutContainer!: ElementRef<HTMLDivElement>;

  private destroy$ = new Subject<void>();
  private layout: GoldenLayout | undefined;
  private resizeObserver?: ResizeObserver;
  private editorBreakpoint?: MediaQueryList;
  private layoutMode?: 'wide' | 'narrow';
  private readonly onEditorBreakpointChange = (): void => this.loadResponsiveLayout();

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
    private fragmentLockService: FragmentLockService,
    private imageFragmentActionState: ImageFragmentActionStateService
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

    // A Fragment's retained pageId is authoritative. Correct a stale/mistyped
    // route only after the retained Fragment for that same route ID has arrived.
    combineLatest([
      this.modelContext.selectedFragment$,
      pageId$,
      fragmentIdOrNull$
    ]).pipe(
      filter(([fragment, routePageId, routeFragmentId]) =>
        hasAuthoritativePage(fragment) &&
        fragment.id === routeFragmentId &&
        fragment.pageId !== routePageId
      ),
      switchMap(([fragment]) =>
        this.modelContext.getLivePage$(fragment!.pageId as number).pipe(
          take(1),
          map(page => ({ fragment: fragment!, page }))
        )
      ),
      takeUntil(this.destroy$)
    ).subscribe(({ fragment, page }) => {
      this.router.navigate(
        ['/diary', page.diaryId, fragment.pageId, fragment.id],
        { replaceUrl: true }
      );
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
    this.layout = new GoldenLayout(this.layoutContainer.nativeElement);

    // Register Angular components once; crossing the responsive breakpoint only
    // reloads their Golden Layout arrangement.
    this.layout.registerComponentFactoryFunction('ImageViewer', (container) => {
      this.bindComponent<ImageViewerComponent>(container, ImageViewerComponent);
    });

    this.layout.registerComponentFactoryFunction('TextPanel', (container) => {
      this.bindComponent<TextPanelComponent>(container, TextPanelComponent);
    });

    this.layout.registerComponentFactoryFunction('Dayview', (container) => {
      this.bindComponent<DayviewComponent>(container, DayviewComponent);
    });

    this.editorBreakpoint = window.matchMedia('(max-width: 56rem)');
    this.editorBreakpoint.addEventListener('change', this.onEditorBreakpointChange);
    this.loadResponsiveLayout();

    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.layout?.setSize(width, height);
      }
    });
    this.resizeObserver.observe(this.layoutContainer.nativeElement);
  }

  private createLayoutConfig(narrow: boolean): LayoutConfig {
    return {
      root: <RowOrColumnItemConfig>{
        type: narrow ? 'column' : 'row',
        content: [
          {
            type: 'component',
            componentType: 'ImageViewer',
            title: 'Source page',
            width: 50,
            height: narrow ? 45 : undefined
          },
          {
            type: 'stack',
            width: 50,
            height: narrow ? 55 : undefined,
            content: [
              {
                type: 'component',
                componentType: 'TextPanel',
                title: 'Transcription'
              }
              ,
              {
                type: 'component',
                componentType: 'Dayview',
                title: 'Day reader'
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
  }

  private loadResponsiveLayout(): void {
    if (!this.layout || !this.editorBreakpoint) return;

    const nextMode = this.editorBreakpoint.matches ? 'narrow' : 'wide';
    if (this.layoutMode === nextMode) return;

    this.layoutMode = nextMode;
    this.layout.loadLayout(this.createLayoutConfig(nextMode === 'narrow'));
  }

  ngOnDestroy(): void {
    console.log(`FragmentComponent.ngOnDestroy`);

    this.destroy$.next();
    this.destroy$.complete();

    this.resizeObserver?.disconnect();
    this.editorBreakpoint?.removeEventListener('change', this.onEditorBreakpointChange);

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

  async onAddImageFragmentClick(): Promise<void> {
    console.log('FragmentComponent.onAddImageFragmentClick');

    if (!this.imageFragmentActionState.tryBeginAddImageFragment()) {
      return;
    }

    try {
      const [sourceFragment, sourcePage, sourceDiary] = await firstValueFrom(
        combineLatest([
          this.modelContext.selectedFragment$,
          this.modelContext.selectedPage$,
          this.modelContext.selectedDiary$
        ]).pipe(take(1))
      );

      if (!canAddImageFragment(sourceDiary, sourcePage, sourceFragment)) {
        this.alertService.warning('Select a fragment with a valid diary, page and day before adding an Image Fragment.');
        return;
      }

      const sourceFragmentId = sourceFragment!.id;
      const sourcePageId = sourcePage!.id;
      const sourceDiaryId = sourceDiary!.id;
      const sourceYear = sourceFragment!.year;
      const sourceMonth = sourceFragment!.month;
      const sourceDay = sourceFragment!.day;
      const path$ = new BehaviorSubject<string>(`/${sourceDiary!.name}/images`);

      const ref: DialogRef<FileSelection, FilesListDialogComponent> =
        this.dialog.open(FilesListDialogComponent, {
          width: '80vw',
          height: '70vh',
          minWidth: 'min(560px, 96vw)',
          minHeight: 'min(380px, 92vh)',
          maxWidth: '96vw',
          maxHeight: '92vh',
          panelClass: 'files-dialog-panel',
          ariaLabel: 'Choose a catalogued Image for the new Image Fragment',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
          data: {
            path$,
            select: true,
            selectionMode: 'catalogue-image'
          }
        });

      let selection: FileSelection | undefined;
      try {
        selection = await firstValueFrom(ref.closed.pipe(take(1)));
      } finally {
        path$.complete();
      }

      if (!selection) {
        return;
      }

      if (!Number.isInteger(selection.imageId) || (selection.imageId as number) <= 0) {
        this.alertService.error('The selected file is not a catalogued Image.');
        return;
      }

      // The chooser can remain open while navigation or retained state changes.
      // Re-read the live context and abort rather than creating against a new day/page.
      const [fragment, page, diary, fragments] = await firstValueFrom(
        combineLatest([
          this.modelContext.selectedFragment$,
          this.modelContext.selectedPage$,
          this.modelContext.selectedDiary$,
          this.modelContext.fragments$
        ]).pipe(take(1))
      );

      const contextUnchanged =
        canAddImageFragment(diary, page, fragment) &&
        fragment!.id === sourceFragmentId &&
        page!.id === sourcePageId &&
        diary!.id === sourceDiaryId &&
        fragment!.year === sourceYear &&
        fragment!.month === sourceMonth &&
        fragment!.day === sourceDay;

      if (!contextUnchanged) {
        this.alertService.warning('The active fragment or page changed while choosing the image. No Image Fragment was created.');
        return;
      }

      const request = new AddImageFragmentRequest(
        page!.id,
        fragment!.year,
        fragment!.month,
        fragment!.day,
        nextFragmentSequence(fragments, fragment!.sequence),
        '',
        selection.imageId as number
      );

      try {
        // addImageFragment is not idempotent. Deliberately make exactly one RPC
        // attempt and require the user to reconcile/refresh an ambiguous failure.
        const created = await firstValueFrom(this.rpcService.addImageFragment$(request).pipe(take(1)));

        if (created.type !== 'IMAGE' || created.marqueeId !== null || !hasAuthoritativePage(created)) {
          this.alertService.error(
            'The Image Fragment may have been created, but the reply was incomplete. Refresh before attempting another creation.'
          );
          return;
        }

        this.modelContext.setPageId(created.pageId);
        this.modelContext.setFragmentId(created.id);
        this.modelContext.setMarqueeId(null);

        await this.router.navigate([
          '/diary',
          diary!.id,
          created.pageId,
          created.id
        ]);

        this.alertService.info(`Image Fragment ${created.id} added`);
      } catch (err: any) {
        console.warn('FragmentComponent.onAddImageFragmentClick failed', err);
        this.alertService.error(imageFragmentAuthoringErrorMessage(err, 'create'));
      }
    } finally {
      this.imageFragmentActionState.endAddImageFragment();
    }
  }

  async onSelectImageForFragmentClick(): Promise<void> {
    console.log('FragmentComponent.onSelectImageForFragmentClick');

    if (!this.imageFragmentActionState.tryBeginImageMutation()) {
      return;
    }

    try {
      const [sourceFragment, sourcePage, sourceDiary] = await firstValueFrom(
        combineLatest([
          this.modelContext.selectedFragment$,
          this.modelContext.selectedPage$,
          this.modelContext.selectedDiary$
        ]).pipe(take(1))
      );

      if (!isImageFragment(sourceFragment) || !hasAuthoritativePage(sourceFragment) ||
          sourcePage?.id !== sourceFragment.pageId || sourceDiary?.id !== sourcePage.diaryId ||
          !sourceDiary.name?.trim()) {
        this.alertService.warning('Select an IMAGE Fragment with a valid diary and page before choosing an Image.');
        return;
      }

      const sourceFragmentId = sourceFragment.id;
      const sourcePageId = sourcePage.id;
      const sourceDiaryId = sourceDiary.id;
      const path$ = new BehaviorSubject<string>(`/${sourceDiary.name}/images`);

      const ref: DialogRef<FileSelection, FilesListDialogComponent> =
        this.dialog.open(FilesListDialogComponent, {
          width: '80vw',
          height: '70vh',
          minWidth: 'min(560px, 96vw)',
          minHeight: 'min(380px, 92vh)',
          maxWidth: '96vw',
          maxHeight: '92vh',
          panelClass: 'files-dialog-panel',
          ariaLabel: 'Choose a catalogued Image for the selected Image Fragment',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
          data: {
            path$,
            select: true,
            selectionMode: 'catalogue-image'
          }
        });

      let selection: FileSelection | undefined;
      try {
        selection = await firstValueFrom(ref.closed.pipe(take(1)));
      } finally {
        path$.complete();
      }

      if (!selection) {
        return;
      }

      const selectedImageId = selection.imageId;
      if (!Number.isInteger(selectedImageId) || (selectedImageId as number) <= 0) {
        this.alertService.error('The selected file is not a catalogued Image.');
        return;
      }

      const [currentFragment, currentPage, currentDiary] = await firstValueFrom(
        combineLatest([
          this.modelContext.selectedFragment$,
          this.modelContext.selectedPage$,
          this.modelContext.selectedDiary$
        ]).pipe(take(1))
      );

      if (!isImageFragment(currentFragment) || currentFragment.id !== sourceFragmentId ||
          !hasAuthoritativePage(currentFragment) || currentFragment.pageId !== sourcePageId ||
          currentPage?.id !== sourcePageId || currentDiary?.id !== sourceDiaryId) {
        this.alertService.warning('The active IMAGE Fragment or page changed while choosing the image. No change was made.');
        return;
      }

      if (currentFragment.imageId === selectedImageId) {
        return;
      }

      await this.mutateImageReference(currentFragment, selectedImageId as number);
    } finally {
      this.imageFragmentActionState.endImageMutation();
    }
  }

  async onClearImageForFragmentClick(): Promise<void> {
    console.log('FragmentComponent.onClearImageForFragmentClick');

    if (!this.imageFragmentActionState.tryBeginImageMutation()) {
      return;
    }

    try {
      const sourceFragment = await firstValueFrom(this.modelContext.selectedFragment$.pipe(take(1)));
      if (!isImageFragment(sourceFragment) || !Number.isInteger(sourceFragment.imageId) ||
          (sourceFragment.imageId as number) <= 0) {
        this.alertService.warning('The selected IMAGE Fragment does not currently reference an Image.');
        return;
      }

      const sourceImageId = sourceFragment.imageId as number;
      const confirmation = this.dialog.open<boolean>(ClearImageConfirmationComponent, {
        data: { fragmentId: sourceFragment.id, imageId: sourceImageId },
        ariaLabelledBy: 'clear-image-title',
        autoFocus: 'first-tabbable',
        restoreFocus: true,
        width: '440px',
        maxWidth: '90vw'
      });

      const confirmed = await firstValueFrom(confirmation.closed.pipe(take(1)));
      if (confirmed !== true) {
        return;
      }

      const currentFragment = await firstValueFrom(this.modelContext.selectedFragment$.pipe(take(1)));
      if (!isImageFragment(currentFragment) || currentFragment.id !== sourceFragment.id ||
          currentFragment.imageId !== sourceImageId) {
        this.alertService.warning('The active IMAGE Fragment or Image reference changed while confirming. No change was made.');
        return;
      }

      await this.mutateImageReference(currentFragment, null);
    } finally {
      this.imageFragmentActionState.endImageMutation();
    }
  }

  private async mutateImageReference(fragment: ImageFragment, imageId: number | null): Promise<void> {
    const locked = await this.fragmentLockService.lockFragmentForEdit(fragment.id);
    if (!locked) {
      return;
    }

    try {
      // LockFragment publishes the locked Fragment before replying. Resolve the
      // retained object again after the lock so the update carries the latest
      // authoritative version and fields rather than the pre-dialog snapshot.
      const priorLockTimestamp = fragment.lock?.lockTimeStamp ?? null;
      const latest = await firstValueFrom(
        this.modelContext.getLiveFragment$(fragment.id).pipe(
          filter(candidate =>
            isImageFragment(candidate) &&
            candidate.id === fragment.id &&
            candidate.lock?.lockTimeStamp != null &&
            candidate.lock.lockTimeStamp !== priorLockTimestamp
          ),
          take(1),
          timeout({ first: 5000 })
        )
      );
      const selected = await firstValueFrom(this.modelContext.selectedFragment$.pipe(take(1)));

      if (!isImageFragment(latest) || !isImageFragment(selected) || selected.id !== fragment.id ||
          latest.id !== fragment.id || !hasAuthoritativePage(latest)) {
        await this.fragmentLockService.unlockFragmentAfterFailedEdit(fragment.id);
        this.alertService.warning('The active IMAGE Fragment changed before the Image update. No change was made.');
        return;
      }

      if (latest.imageId === imageId) {
        // We acquired the lock, but retained state already has the requested
        // value (for example another completed edit became visible). No update
        // is needed, so explicitly release the otherwise-unused lock.
        await this.fragmentLockService.unlockFragment(fragment.id, 'Image reference already current');
        return;
      }

      await firstValueFrom(
        this.rpcService.updateImageFragment$(latest, imageId).pipe(take(1))
      );

      // Successful updateFragment clears the lock on the responder. Do not
      // issue an additional unlock and do not optimistically patch local state;
      // retained Fragment/Image topics remain authoritative.
      this.alertService.info(
        imageId === null
          ? `Image cleared from Fragment ${fragment.id}`
          : `Image ${imageId} selected for Fragment ${fragment.id}`
      );

    } catch (err: any) {
      console.warn('FragmentComponent.mutateImageReference failed', err);
      await this.fragmentLockService.unlockFragmentAfterFailedEdit(fragment.id);

      this.alertService.error(imageFragmentAuthoringErrorMessage(err, 'image-reference'));

    }
  }

  openFilesDialog() {
    const path$ = new BehaviorSubject<string>('/');

    const ref: DialogRef<FileSelection, FilesListDialogComponent> =
      this.dialog.open(FilesListDialogComponent, {
        width: '80vw',
        height: '70vh',
        minWidth: 'min(560px, 96vw)',
        minHeight: 'min(380px, 92vh)',
        maxWidth: '96vw',
        maxHeight: '92vh',
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

  async onEditMarqueeClick(): Promise<void> {
    console.log(`FragmentComponent.onEditMarqueeClick`);

    const [fragment, page, marquee] = await firstValueFrom(combineLatest([
      this.modelContext.selectedFragment$,
      this.modelContext.selectedPage$,
      this.modelContext.selectedMarquee$
    ]).pipe(take(1)));

    if (!this.isConsistentMarquee(fragment, page, marquee)) {
      this.alertService.error('The selected fragment does not have an editable marquee on this page');
      return;
    }
    this.modelContext.toggleEditMarqueeMode();
  }

  async onCreateMarqueeClick(): Promise<void> {
    console.log(`FragmentComponent.onCreateMarqueeClick`);

    const [fragment, page, diary, marquee] = await firstValueFrom(
      combineLatest([
        this.modelContext.selectedFragment$,
        this.modelContext.selectedPage$,
        this.modelContext.selectedDiary$,
        this.modelContext.selectedMarquee$
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

    if (!isMarqueeFragment(fragment)) {
      this.alertService.error('Marquees can only be added to MARQUEE fragments');
      return;
    }

    if (!hasAuthoritativePage(fragment) || fragment.pageId !== page.id) {
      this.alertService.error('The selected fragment does not belong to this source page');
      return;
    }

    if (this.isConsistentMarquee(fragment, page, marquee)) {
      this.modelContext.setMarqueeId(marquee!.id);
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

    const [fragment, page, diary, marquee] = await firstValueFrom(
      combineLatest([
        this.modelContext.selectedFragment$,
        this.modelContext.selectedPage$,
        this.modelContext.selectedDiary$,
        this.modelContext.selectedMarquee$
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

    if (!isMarqueeFragment(fragment)) {
      this.alertService.error('IMAGE fragments do not have editable marquees');
      return;
    }

    if (!this.isConsistentMarquee(fragment, page, marquee)) {
      this.alertService.info('The selected fragment does not have a marquee');
      return;
    }

    const marqueeId = marquee!.id;

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

  private isConsistentMarquee(
    fragment: Fragment | null,
    page: Page | null,
    marquee: Marquee | null
  ): boolean {
    return isMarqueeFragment(fragment) &&
      hasAuthoritativePage(fragment) &&
      !!page &&
      !!marquee &&
      fragment.pageId === page.id &&
      marquee.pageId === fragment.pageId &&
      marquee.fragmentId === fragment.id;
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
