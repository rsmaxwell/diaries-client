import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  OnInit,
  OnDestroy,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Marquee } from '../../model/marquee';
import { Point } from '@angular/cdk/drag-drop';
import { Rectangle } from '../../utilities/rectangle';
import { Diary } from '../../model/diary';
import { Page } from '../../model/page';
import { RpcService } from '../../mqtt/rpc.service';
import { AlertService } from '../../alerts/alert.service';
import { Router } from '@angular/router';
import { combineLatest, distinctUntilChanged, filter, from, map, Subject, switchMap, take, takeUntil } from 'rxjs';
import { Config, ConfigService, runtimeConfig } from '../../config/config.service';
import { ModelContext } from '../../model/model-context';

import { firstValueFrom } from 'rxjs';
import { Fragment } from '../../model/fragment';
import { AccessTokenService } from '../../user/token/accessTokenService';



enum ViewMode {
  WithMarquee,
  WithoutMarquee
}

@Component({
  selector: 'app-image-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-viewer.component.html',
  styleUrls: ['./image-viewer.component.scss']
})
export class ImageViewerComponent implements OnInit, AfterViewInit, OnDestroy {

  @Output() titleChanged = new EventEmitter<string>();
  @Output() marqueeMoved = new EventEmitter<Marquee>();
  @Output() marqueeSelected = new EventEmitter<Marquee>();

  @ViewChild('svgRef') svgRef!: ElementRef<SVGSVGElement>;

  constructor(
    private router: Router,
    private rpcService: RpcService,
    private alertService: AlertService,
    private configService: ConfigService,
    private modelContext: ModelContext,
    private accessTokenService: AccessTokenService
  ) {
  };

  private readonly onMouseMoveBound = this.onMouseMoveBoundInternal.bind(this);
  private readonly onMouseUpBound = this.onMouseUpBoundInternal.bind(this);
  private destroy$ = new Subject<void>();

  scale = 1;
  offsetX = 0;
  offsetY = 0;
  imageURL: string = '';
  resizeEdge?: { left: boolean; right: boolean; top: boolean; bottom: boolean; };
  marquee: Marquee | null = null;
  marquees: Marquee[] = [];
  mode: ViewMode = ViewMode.WithoutMarquee;
  cursorStyle = '';
  isPanning = false;
  isDraggingMarquee = false;
  dragStart?: DOMPoint;
  dragStartMarquee?: Point;
  originalRectangle?: Rectangle;
  diary: Diary = Diary.default;
  page: Page = Page.default;
  config: Config | null = null;
  draggingMarqueeId: number = 0
  draggingMarqueeVersion: number = 0;

  ngOnInit(): void {
    console.log('ImageViewerComponent.ngOnInit');

    // header add button
    this.modelContext.addButtonClicked$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.onAddButtonClick());

    // 1) Cache config and ensure it’s present
    const config$ = from(this.configService.getConfig()).pipe(
      filter((c): c is Config => !!c),
      take(1)
    );

    // 2) Only proceed once diary/page are *resolved* (have names)
    const diary$ = this.modelContext.selectedDiary$.pipe(
      filter((d): d is Diary => !!d && !!d.name)
    );
    const page$ = this.modelContext.selectedPage$.pipe(
      filter((p): p is Page => !!p && !!p.name && !!p.extension)
    );

    // 3) Build imageURL whenever any of these change
    combineLatest([config$, diary$, page$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([config, diary, page]) => {
        this.config = config;
        this.diary = diary;
        this.page = page;

        console.log(`ImageViewer.ngOnInit: config.baseUrl:  ${runtimeConfig.baseUrl}`);

        const base = runtimeConfig.baseUrl.replace(/\/+$/, '');
        const diariesRoot = config.diaries.replace(/^\/+|\/+$/g, '');
        this.imageURL = `${base}/${diariesRoot}/${diary.name}/${page.name}${page.extension}`;
        console.log(`ImageViewer.ngOnInit: imageURL updated to ${this.imageURL}`);
      });

    // 4) Selected marquee → mode
    this.modelContext.selectedMarquee$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged((a, b) => a?.id === b?.id)
      )
      .subscribe(m => {
        this.marquee = m;
        this.mode = m ? ViewMode.WithMarquee : ViewMode.WithoutMarquee;
      });

    // 5) Marquees list
    this.modelContext.marquees$
      .pipe(takeUntil(this.destroy$))
      .subscribe(ms => {
        console.log('ImageViewerComponent.<subscribe marquees>: ids=', ms.map(m => m.id));
        this.marquees = ms;
      });

    // Auto-select first marquee if URL has no fragmentId
    this.modelContext.selectedPage$
      .pipe(
        filter(p => !!p), // run once per concrete page
        switchMap(() =>
          combineLatest([
            this.modelContext.marquees$,   // marquees for the current page
            this.modelContext.fragmentId$, // current fragment (null if none in URL)
          ]).pipe(
            filter(([ms, fid]) => fid == null && Array.isArray(ms) && ms.length > 0),
            take(1) // only once per page activation
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(([ms]) => {
        const first = ms[0];

        // keep global state in sync
        this.modelContext.setMarqueeId(first.id);
        this.modelContext.setFragmentId(first.fragmentId);

        // use the already-known diary/page to canonicalise the URL
        this.router.navigate(
          ['/diary', this.diary!.id, this.page!.id, first.fragmentId],
          { replaceUrl: true }
        );
      });
  }



  get width(): number {
    return this.page?.width ?? 0;
  }

  get height(): number {
    return this.page?.height ?? 0;
  }

  get otherMarquees(): Marquee[] {
    const selectedId = this.marquee?.id;
    return this.marquees.filter(m => m.id !== selectedId);
  }

  trackById(index: number, m: Marquee) {
    return m.id;
  }

  ngOnDestroy(): void {
    console.log(`ImageViewerComponent.ngOnDestroy`);

    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);

    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {
    if (this.svgRef?.nativeElement) {
      this.svgRef.nativeElement.focus();
      console.log('ImageViewerComponent.ngAfterViewInit: svg focused');
    }
  }

  get transformStyle(): string {
    return `translate(${this.offsetX}, ${this.offsetY}) scale(${this.scale})`;
  }

  onMouseLeave(event: MouseEvent) {
    console.log(`ImageViewer.onMouseLeave:`);

    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);

    this.isPanning = false;
    this.isDraggingMarquee = false;
    this.resizeEdge = undefined;
    this.dragStart = undefined;
    this.dragStartMarquee = undefined;
    this.originalRectangle = undefined;
    this.draggingMarqueeId = 0;
    this.draggingMarqueeVersion = 0;
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();

    // This increases (scroll up) or decreases (scroll down) the scale.
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    const newScale = this.scale * factor;

    // This computes the mouse position relative to the SVG element in screen/pixel space.
    const pt = this.svgRef.nativeElement.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;

    // Transform to SVG coordinates
    const ctm = this.svgRef.nativeElement.getScreenCTM();
    if (!ctm) return;
    const svgPoint = pt.matrixTransform(ctm.inverse());

    // Get mouse position in SVG logical coordinates before zoom
    const svgXBefore = (svgPoint.x - this.offsetX) / this.scale;
    const svgYBefore = (svgPoint.y - this.offsetY) / this.scale;

    // Recalculate offset so the same point stays under the mouse
    this.offsetX = svgPoint.x - svgXBefore * newScale;
    this.offsetY = svgPoint.y - svgYBefore * newScale;
    this.scale = newScale;
  }

  onMouseDown(event: MouseEvent) {

    console.log(`ImageViewerComponent.onMouseDown`);

    if (!this.svgRef) {
      console.log(`ImageViewerComponent.onMouseDown: skipping as !svgRef`);
      return;
    }

    if (event.button !== 0) {
      console.log(`ImageViewerComponent.onMouseDown: skipping as 'wrong mouse button'`);
      return;
    }

    window.addEventListener('mousemove', this.onMouseMoveBound);
    window.addEventListener('mouseup', this.onMouseUpBound);

    const mousePosition = this.getMousePosition(event);
    const isCtrlKeyDown = event.ctrlKey;

    console.log(`ImageViewerComponent.onMouseDown: is viewMode.WithMarquee: ${this.mode === ViewMode.WithMarquee}`);
    console.log(`ImageViewerComponent.onMouseDown: this.marquee: ${JSON.stringify(this.marquee)}`);
    console.log(`ImageViewerComponent.onMouseDown: isCtrlKeyDown: ${isCtrlKeyDown}`);
    if (this.mode === ViewMode.WithMarquee && this.marquee && isCtrlKeyDown) {
      console.log(`ImageViewerComponent.onMouseDown: with marquee`);
      this.resizeEdge = this.detectResizeEdge(mousePosition);
      this.dragStart = mousePosition;
      this.originalRectangle = { ...this.marquee.rectangle };

      // Track which marquee/version this interaction started on (move OR resize)
      this.draggingMarqueeId = this.marquee.id;
      this.draggingMarqueeVersion = this.marquee.version;

      if (!this.resizeEdge || Object.values(this.resizeEdge).every(v => !v)) {
        // Ctrl + click inside marquee = move marquee
        this.isDraggingMarquee = true;
        const r = this.marquee.rectangle;
        this.dragStartMarquee = { x: r.x, y: r.y };
        this.draggingMarqueeId = this.marquee.id
        this.draggingMarqueeVersion = this.marquee.version;
      } else {
        // Ctrl + click near edge = resize
        // this.dragStart = mousePosition;
      }
    } else {
      console.log(`ImageViewerComponent.onMouseDown: global pan`);
      // fallback to global pan
      this.isPanning = true;
      this.dragStart = mousePosition;
    }
  }

  onMouseMove(event: MouseEvent) {
    if (!this.svgRef) {
      console.log(`ImageViewerComponent.onMouseMove: skipping as !svgRef`);
      return;
    }

    // console.log(`ImageViewerComponent.onMouseMove: mode=${this.mode} isDraggingGlobal=${this.isDraggingGlobal} isDraggingMarquee=${this.isDraggingMarquee}`);

    const isCtrlKeyDown = event.ctrlKey;
    let mousePosition = this.getMousePosition(event);
    this.calculateCursorStyle(mousePosition, isCtrlKeyDown)
  }

  onMouseMoveBoundInternal(event: MouseEvent) {

    if (!this.svgRef) {
      console.log(`ImageViewerComponent.onMouseMoveBoundInternal: skipping as !svgRef`);
      return;
    }

    // console.log(`ImageViewerComponent.onMouseMoveBoundInternal: mode=${this.mode} isDraggingGlobal=${this.isDraggingGlobal} isDraggingMarquee=${this.isDraggingMarquee}`);

    const isCtrlKeyDown = event.ctrlKey;
    let mousePosition = this.getMousePosition(event);
    this.calculateCursorStyle(mousePosition, isCtrlKeyDown)

    if (!this.dragStart) {
      console.log(`ImageViewerComponent.onMouseMoveBoundInternal: skipping as !dragStart`);
      return;
    }

    const dx = mousePosition.x - this.dragStart!.x;
    const dy = mousePosition.y - this.dragStart!.y;

    // ✅ PANNING works when mode is WithoutFragment:
    if (this.isPanning) {
      this.offsetX += dx;
      this.offsetY += dy;
      this.dragStart = mousePosition;
      return;
    }

    // ✅ Marquee logic works when mode is WithMarquee:
    if (this.mode !== ViewMode.WithMarquee) {
      console.log(`ImageViewerComponent.onMouseMoveBoundInternal: skipping as mode != ViewMode.WithMarquee`);
      return;
    }

    if (!this.marquee) {
      console.log(`ImageViewerComponent.onMouseMoveBoundInternal: skipping as !marquee`);
      return;
    }

    const r = this.marquee.rectangle;

    if (this.isDraggingMarquee && this.marquee && this.dragStartMarquee) {
      const dxSvg = dx / this.scale;
      const dySvg = dy / this.scale;

      r.x = this.dragStartMarquee.x + dxSvg;
      r.y = this.dragStartMarquee.y + dySvg;
    }

    if (this.isResizing() && this.originalRectangle) {
      const { left, right, top, bottom } = this.resizeEdge!;
      let { x, y, width, height } = this.originalRectangle;

      const dx = (mousePosition.x - this.dragStart!.x) / this.scale;
      const dy = (mousePosition.y - this.dragStart!.y) / this.scale;

      if (left) { x = this.originalRectangle.x + dx; width = this.originalRectangle.width - dx; }
      if (right) { width = this.originalRectangle.width + dx; }
      if (top) { y = this.originalRectangle.y + dy; height = this.originalRectangle.height - dy; }
      if (bottom) { height = this.originalRectangle.height + dy; }

      // normalize: keep width/height >= MIN and flip origin if crossed
      const MIN = 5;
      if (width < 0) { x += width; width = Math.abs(width); }
      if (height < 0) { y += height; height = Math.abs(height); }
      width = Math.max(width, MIN);
      height = Math.max(height, MIN);

      const r = this.marquee!.rectangle;
      r.x = x; r.y = y; r.width = width; r.height = height;
      return;
    }
  }

  onMouseUpBoundInternal() {
    console.log(`ImageViewerComponent.onMouseUpBoundInternal`);
    window.removeEventListener('mousemove', this.onMouseMoveBound);
    window.removeEventListener('mouseup', this.onMouseUpBound);

    const m = this.marquee;
    const canUpdate =
      this.mode === ViewMode.WithMarquee &&
      !!m &&
      !this.isPanning &&
      this.draggingMarqueeId === m.id &&
      this.draggingMarqueeVersion === m.version &&
      (this.isResizing() || this.isDraggingMarquee);

    const changed =
      this.isResizing() ||
      (this.isDraggingMarquee &&
        Math.hypot(this.marquee!.rectangle.x - this.dragStartMarquee!.x,
          this.marquee!.rectangle.y - this.dragStartMarquee!.y) > 0.5);

    if (canUpdate && changed) {
      const current = this.marquee!;
      const prevSnapshot: Marquee = { ...current, rectangle: { ...current.rectangle } }; // rollback snapshot

      // Build the server payload using the PREVIOUS version (server will bump)
      const requestPayload: Marquee = {
        ...prevSnapshot,
        // rectangle is already updated by your drag/resize logic
        version: prevSnapshot.version  // send old version to the server
      };

      // ---- OPTIMISTIC LOCAL UPDATE ----
      // 1) bump local version so UI reflects the save immediately
      current.version = (current.version ?? 0) + 1;

      // 2) (optional) update any local baselines used in guards if you have them
      //    Not strictly needed here since you reset the drag state below.

      // ---- SERVER CALL ----
      this.rpcService.updateMarquee$(requestPayload).subscribe({
        next: () => {
          // Success: nothing to do. Store will eventually emit fresh data;
          // our optimistic state already looks correct.
          console.log('ImageViewer: marquee update succeeded (optimistic).');
        },
        error: (err) => {
          console.log(`ImageViewer: marquee update failed, rolling back.`, err);
          // ---- ROLLBACK ----
          if (this.marquee && this.marquee.id === prevSnapshot.id) {
            this.marquee.version = prevSnapshot.version;
            this.marquee.rectangle = { ...prevSnapshot.rectangle };
          }
          // Also fix the list entry if the same object identity isn't shared:
          const idx = this.marquees.findIndex(m => m.id === prevSnapshot.id);
          if (idx >= 0) {
            this.marquees[idx] = { ...prevSnapshot, rectangle: { ...prevSnapshot.rectangle } };
          }

          if (!this.handleAuthError(err)) this.alertService.error(err);
        }
      });
    }

    // Always reset UI drag state
    this.isPanning = false;
    this.isDraggingMarquee = false;
    this.resizeEdge = undefined;
    this.dragStart = undefined;
    this.dragStartMarquee = undefined;
    this.originalRectangle = undefined;
    this.draggingMarqueeId = 0;
    this.draggingMarqueeVersion = 0;
  }



  private pointInRect(p: Point, r: Rectangle): boolean {
    return p.x >= r.x && p.x <= r.x + r.width &&
      p.y >= r.y && p.y <= r.y + r.height;
  }

  async onSelectMarquee(marquee: Marquee, event?: MouseEvent) {
    // If user is clicking in an overlap area, prefer keeping the current marquee selected.
    // Allow override with Shift-click.
    if (event && this.mode === ViewMode.WithMarquee && this.marquee && this.marquee.id !== marquee.id) {
      const p = this.getMousePosition(event); // already exists in your component
      const currentRect = this.marquee.rectangle;

      const insideCurrent = this.pointInRect(p, currentRect);
      const override = event.shiftKey; // optional: shift-click to select the other one

      if (insideCurrent && !override) {
        // Keep focus on the current marquee
        event.stopPropagation();
        return;
      }
    }

    console.log(`ImageViewerComponent.onSelectMarquee: marquee: ${JSON.stringify(marquee)}`);
    console.log(`ImageViewerComponent.onSelectMarquee: unlock the current fragment`);

    // critical: unlock *while still subscribed to the current fragment*
    await this.unlockCurrentFragmentIfNeeded(marquee.fragmentId);

    // now switch selection
    console.log(`ImageViewerComponent.onSelectMarquee: now switch selection: marqueeId: ${marquee.id}, fragmentId: ${marquee.fragmentId}`);
    this.modelContext.setMarqueeId(marquee.id);
    this.modelContext.setFragmentId(marquee.fragmentId);

    this.router.navigate(['/diary', this.diary.id, this.page.id, marquee.fragmentId]);
  }

  arraysEqual(a: Marquee[], b: Marquee[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((m, i) => m.id === b[i].id);
  }



  private marqueeBoundsInSvg() {
    const m = this.marquee!.rectangle;
    const x = m.x * this.scale + this.offsetX;
    const y = m.y * this.scale + this.offsetY;
    const w = m.width * this.scale;
    const h = m.height * this.scale;
    return { left: x, right: x + w, top: y, bottom: y + h, w, h };
  }




  calculateCursorStyle(mousePosition: DOMPoint, isCtrlKeyDown: boolean) {

    // console.log(`ImageViewerComponent.calculateCursorStyle: mode=${this.mode} isDraggingGlobal=${this.isDraggingGlobal} isDraggingMarquee=${this.isDraggingMarquee}`);

    let cursor = 'default';

    if (!this.marquee) {
      // console.log(`ImageViewerComponent.calculateCursorStyle: no marquee --> default cursor style`);
      this.cursorStyle = cursor;
      return;
    }

    if (!isCtrlKeyDown) {
      // console.log(`ImageViewerComponent.calculateCursorStyle: ctrl key not down --> default cursor style`);
      this.cursorStyle = cursor;
      return;
    }

    // console.log(`ImageViewerComponent.calculateCursorStyle - with marquee && ctrl key down`);

    const m = this.marquee.rectangle;

    // Apply the <g> transform to get the position of the marquee in SVG logical space
    const bounds = this.marqueeBoundsInSvg();

    // The mouse position is already in SVG logical space

    // Now hit-test against the transformed marquee
    const margin = 40;
    const nearLeft = Math.abs(mousePosition.x - bounds.left) < margin;
    const nearRight = Math.abs(mousePosition.x - bounds.right) < margin;
    const nearTop = Math.abs(mousePosition.y - bounds.top) < margin;
    const nearBottom = Math.abs(mousePosition.y - bounds.bottom) < margin;

    const insideHoriz = (mousePosition.x + margin >= bounds.left) && (mousePosition.x - margin <= bounds.right);
    const insideVert = (mousePosition.y + margin >= bounds.top) && (mousePosition.y - margin <= bounds.bottom);

    if (insideHoriz && insideVert) {

      if ((nearLeft && nearTop) || (nearRight && nearBottom)) {
        cursor = 'corner-1-resize';
      } else if ((nearLeft && nearBottom) || (nearRight && nearTop)) {
        cursor = 'corner-2-resize';
      } else if (nearLeft || nearRight) {
        cursor = 'horizontal-resize';
      } else if (nearTop || nearBottom) {
        cursor = 'vertical-resize';
      } else {
        cursor = 'move';
      }
    }

    this.cursorStyle = cursor;
  }

  detectResizeEdge(mousePosition: DOMPoint): { left: boolean, right: boolean, top: boolean, bottom: boolean } {
    const edges = { left: false, right: false, top: false, bottom: false };
    if (this.mode !== ViewMode.WithMarquee) return edges;
    if (!this.marquee) return edges;

    const m = this.marquee.rectangle;
    const margin = 40;

    // Apply the <g> transform to get the position of the marquee in SVG logical space
    const bounds = this.marqueeBoundsInSvg();

    // The mouse position is already in SVG logical space
    // Now hit-test against the transformed marquee
    const insideHoriz = (mousePosition.x + margin >= bounds.left) && (mousePosition.x - margin <= bounds.right);
    const insideVert = (mousePosition.y + margin >= bounds.top) && (mousePosition.y - margin <= bounds.bottom);

    if (insideHoriz && insideVert) {
      edges.left = Math.abs(mousePosition.x - bounds.left) < margin;
      edges.right = Math.abs(mousePosition.x - bounds.right) < margin;
      edges.top = Math.abs(mousePosition.y - bounds.top) < margin;
      edges.bottom = Math.abs(mousePosition.y - bounds.bottom) < margin;
    }

    return edges;
  }

  // Get the mouse position relative to the SVG element in screen/pixel space.
  getMousePosition(event: MouseEvent): DOMPoint {

    if (!this.svgRef?.nativeElement) {
      console.warn('ImageViewerComponent.getMousePosition: svgRef is not yet available');
      return new DOMPoint(0, 0);
    }

    const svg = this.svgRef.nativeElement;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;

    // Transform to SVG coordinates
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return pt; // Assume identity transform
    }

    return pt.matrixTransform(ctm.inverse());
  }

  private isResizing(): boolean {
    const e = this.resizeEdge;
    return !!e && (e.left || e.right || e.top || e.bottom);
  }

  private isDragging(): boolean {
    return this.dragStart != undefined;
  }


  onKeyDown(event: KeyboardEvent) {
    if (this.mode !== ViewMode.WithMarquee) return;
    if (!this.marquee) return;

    if (event.key === 'Delete' && event.ctrlKey) {
      console.log('ImageViewerComponent.onKeyDown: Control + Delete pressed');

      console.log(`ImageViewerComponent.onKeyDown: deleting marquee id: ${this.marquee.id}`);
      this.rpcService.deleteMarquee$(this.marquee.id).subscribe({
        next: (id: number) => {
          console.log(`ImageViewerComponent.onKeyDown: delete succeeded: id: ${id}`);
        },
        error: (err) => {
          if (!this.handleAuthError(err)) {
            this.alertService.error(err);
          }
        }

      });

      this.router.navigate(['/diary', this.diary.id, this.page.id]);
    }
  }

  onRightClick(e: MouseEvent) {
  }

  onAddButtonClick() {
    const rectangle = new Rectangle(this.width / 5, this.height / 5, (3 * this.width) / 5, (3 * this.height) / 5);
    const sequence = 123;

    this.rpcService.addMarquee$(this.page, rectangle, sequence).pipe(
      switchMap((newId: number) =>
        this.modelContext.marquees$.pipe(
          map(ms => ms.find(m => m.id === newId) ?? null),
          filter((m): m is Marquee => !!m && m.fragmentId > 0),
          take(1)
        )
      )
    ).subscribe({
      next: (m) => {
        this.alertService.info(`marquee: id: ${m.id} added`);
        this.modelContext.setMarqueeId(m.id);
        this.modelContext.setFragmentId(m.fragmentId);
        this.router.navigate(['/diary', this.diary.id, this.page.id, m.fragmentId]);
      },
      error: (err) => {
        if (!this.handleAuthError(err)) this.alertService.error(err);
      }
    });
  }

  private handleAuthError(err: any): boolean {
    if (err?.status === 401) {
      const returnUrl = this.router.url;
      this.router.navigate(['/signin'], { queryParams: { returnUrl } });
      return true;
    }
    return false;
  }


  private isLockHeldByThisSession(fragment: Fragment | null): fragment is Fragment {
    const lock = fragment?.lock as any;
    const myUserId = this.accessTokenService.userId;
    const mySessionId = this.accessTokenService.sessionId;

    return !!fragment
      && !!lock?.locked
      && lock.lockUserId != null
      && lock.lockSessionId != null
      && myUserId != null
      && mySessionId != null
      && lock.lockUserId === myUserId
      && lock.lockSessionId === mySessionId;
  }

  private async unlockCurrentFragmentIfNeeded(nextFragmentId: number): Promise<void> {
    // Get the fragment currently selected (the one we're about to leave)
    const current = await firstValueFrom(this.modelContext.selectedFragment$.pipe(take(1)));

    // No current fragment, or clicking the same fragment -> nothing to do
    if (!current?.id || current.id === nextFragmentId) return;

    // Only unlock if THIS session holds the lock
    if (!this.isLockHeldByThisSession(current)) return;

    try {
      await firstValueFrom(this.rpcService.unlockFragment$(current.id).pipe(take(1)));
      console.log(`ImageViewer: unlocked fragment ${current.id} before switching`);
    } catch (err) {
      // Don’t block navigation; just log.
      console.warn(`ImageViewer: unlock before switching failed`, err);
    }
  }
}
