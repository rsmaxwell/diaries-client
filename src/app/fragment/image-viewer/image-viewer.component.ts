import {
  Component,
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
import { Config, ConfigService, RuntimeConfig } from '../../config/config.service';
import { ModelContext } from '../../model/model-context';

import { firstValueFrom } from 'rxjs';
import { AddFragmentRequest, Fragment } from '../../model/fragment';
import { AccessTokenService } from '../../user/token/accessTokenService';
import { FragmentLockService } from '../fragment-lock.service';


interface ResizeEdge {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

type InteractionMode =
  | 'idle'
  | 'panning'
  | 'moving-marquee'
  | 'resizing-marquee'
  | 'pinching';

interface PointerInteraction {
  mode: InteractionMode;
  activePointers: Map<number, PointerEvent>;
  startPoint?: DOMPoint;
  lastPoint?: DOMPoint;
}

interface MarqueeInteraction {
  marqueeId?: number;
  marqueeVersion?: number;
  startRect?: Rectangle;
  startMarqueePoint?: Point;
  resizeEdge?: ResizeEdge;

  lockedFragmentId?: number;
  lockAcquired?: boolean;
}

interface PinchInteraction {
  startDistance?: number;
  startScale?: number;
  startCenter?: DOMPoint;
  startOffsetX?: number;
  startOffsetY?: number;
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

  private readonly onPointerMoveBound = this.onPointerMoveBoundInternal.bind(this);
  private readonly onPointerUpBound = this.onPointerUpBoundInternal.bind(this);
  private destroy$ = new Subject<void>();

  private pointerInteraction: PointerInteraction = {
    mode: 'idle',
    activePointers: new Map<number, PointerEvent>()
  };
  private marqueeInteraction: MarqueeInteraction = {};
  private pinchInteraction: PinchInteraction = {};

  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private marquees: Marquee[] = [];
  private diary: Diary = Diary.default;
  private page: Page = Page.default;
  private editMarqueeMode = false;
  private marqueeUpdateInFlight = false;

  imageURL: string = '';
  marquee: Marquee | null = null;
  cursorStyle = '';
  hasSelectedFragment = false;

  constructor(
    private router: Router,
    private rpcService: RpcService,
    private alertService: AlertService,
    private configService: ConfigService,
    private modelContext: ModelContext,
    private accessTokenService: AccessTokenService,
    private fragmentLockService: FragmentLockService
  ) {
  };

  ngOnInit(): void {
    console.log('ImageViewerComponent.ngOnInit');

    // header add button
    this.modelContext.addButtonClicked$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.onAddButtonClick());

    // 1) Cache config and ensure it’s present
    const config$ = from(this.configService.getConfig()).pipe(
      filter((c): c is RuntimeConfig => !!c),
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
        this.diary = diary;
        this.page = page;


        console.log(`ImageViewer.ngOnInit: config.baseUrl:  ${config.baseUrl}`);

        const base = config.baseUrl.replace(/\/+$/, '');
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
        this.modelContext.setHasSelectedMarquee(!!this.marquee);
      });

    // 5) Marquees list
    this.modelContext.marquees$
      .pipe(takeUntil(this.destroy$))
      .subscribe(ms => {
        console.log('ImageViewerComponent.<subscribe marquees>: ids=', ms.map(m => m.id));
        this.marquees = ms;

        // ensure the selected marquee is derived from the current list when the list updates
        if (this.marquee) {
          const refreshed = ms.find(m => m.id === this.marquee!.id);
          if (refreshed) {
            this.marquee = refreshed;
          }
        }
      });

    this.modelContext.editMarqueeMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.editMarqueeMode = value;

        if (this.pointerInteraction.lastPoint) {
          this.calculateCursorStyle(this.pointerInteraction.lastPoint, this.editMarqueeMode);
        }
      });

    this.modelContext.deleteButtonClicked$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.deleteSelectedFragment());
  }

  ngAfterViewInit(): void {
    if (this.svgRef?.nativeElement) {
      this.svgRef.nativeElement.focus();
      console.log('ImageViewerComponent.ngAfterViewInit: svg focused');
    }
  }

  ngOnDestroy(): void {
    console.log(`ImageViewerComponent.ngOnDestroy`);

    this.modelContext.setHasSelectedMarquee(false);
    this.modelContext.setEditMarqueeMode(false);

    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
    window.removeEventListener('pointercancel', this.onPointerUpBound);

    this.destroy$.next();
    this.destroy$.complete();
  }

  // -----------------------------------------------------------------------------
  // template/view helpers
  // -----------------------------------------------------------------------------

  trackById(index: number, m: Marquee) {
    return m.id;
  }

  get otherMarquees(): Marquee[] {
    const selectedId = this.marquee?.id;
    return this.marquees.filter(m => m.id !== selectedId);
  }

  // -----------------------------------------------------------------------------
  // pointer-down group:
  // -----------------------------------------------------------------------------

  async onPointerDown(event: PointerEvent): Promise<void> {
    console.log(`ImageViewerComponent.onPointerDown: pointerType=${event.pointerType}`);

    if (!this.svgRef) {
      console.log(`ImageViewerComponent.onPointerDown: skipping as !svgRef`);
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      console.log(`ImageViewerComponent.onPointerDown: skipping as wrong mouse button`);
      return;
    }

    event.preventDefault();

    this.capturePointer(event);
    this.pointerInteraction.activePointers.set(event.pointerId, event);

    if (this.pointerInteraction.activePointers.size === 2) {
      this.beginPinchInteraction();
      return;
    }

    if (this.pointerInteraction.activePointers.size > 1) {
      return;
    }

    await this.beginSinglePointerInteraction(event);
  }

  private async beginSinglePointerInteraction(event: PointerEvent): Promise<void> {
    window.addEventListener('pointermove', this.onPointerMoveBound, { passive: false });
    window.addEventListener('pointerup', this.onPointerUpBound);
    window.addEventListener('pointercancel', this.onPointerUpBound);

    const isEditMarqueeMode = event.ctrlKey || this.editMarqueeMode;
    const pointerPosition = this.getPointerPosition(event);

    this.pointerInteraction.startPoint = pointerPosition;
    this.pointerInteraction.lastPoint = pointerPosition;

    const hasSelectedMarquee = this.marquee != null;

    const selectedResizeEdge =
      hasSelectedMarquee && isEditMarqueeMode
        ? this.detectResizeEdge(pointerPosition)
        : undefined;

    const pointerCanEditSelectedMarquee =
      hasSelectedMarquee &&
      isEditMarqueeMode &&
      (
        this.isResizeEdgeActive(selectedResizeEdge) ||
        this.pointInBounds(pointerPosition, this.marqueeBoundsInSvg())
      );

    const clickedMarquee = this.marqueeAtPointer(pointerPosition);

    if (
      !pointerCanEditSelectedMarquee &&
      clickedMarquee &&
      clickedMarquee.id !== this.marquee?.id
    ) {
      console.log(`ImageViewerComponent.beginSinglePointerInteraction: selecting clicked marquee ${clickedMarquee.id}`);
      await this.onSelectMarquee(clickedMarquee, event);
      this.cleanupAllPointers();
      return;
    }

    if (pointerCanEditSelectedMarquee) {
      const started = await this.beginMarqueeInteraction(pointerPosition, selectedResizeEdge);

      if (!started) {
        this.cleanupAllPointers();
      }

      return;
    }

    this.beginPanInteraction(pointerPosition);
  }

  private async beginMarqueeInteraction(
    pointerPosition: DOMPoint,
    resizeEdge?: ResizeEdge
  ): Promise<boolean> {

    if (this.marqueeUpdateInFlight) {
      console.log('ImageViewerComponent.beginMarqueeInteraction: update already in flight');
      return false;
    }

    if (!this.marquee) {
      console.log('ImageViewerComponent.beginMarqueeInteraction: There is no current marquee');
      return false;
    }

    const locked = await this.fragmentLockService.lockFragmentForEdit(this.marquee.fragmentId);
    if (!locked) {
      return false;
    }

    this.marqueeInteraction.startRect = { ...this.marquee.rectangle };
    this.marqueeInteraction.resizeEdge = resizeEdge ?? this.detectResizeEdge(pointerPosition);
    this.marqueeInteraction.marqueeId = this.marquee.id;
    this.marqueeInteraction.marqueeVersion = this.marquee.version;
    this.marqueeInteraction.lockedFragmentId = this.marquee.fragmentId;
    this.marqueeInteraction.lockAcquired = true;

    if (this.isResizeEdgeActive(this.marqueeInteraction.resizeEdge)) {
      this.pointerInteraction.mode = 'resizing-marquee';
    } else {
      this.pointerInteraction.mode = 'moving-marquee';

      const r = this.marquee.rectangle;
      this.marqueeInteraction.startMarqueePoint = { x: r.x, y: r.y };
    }

    return true;
  }

  private beginPanInteraction(pointerPosition: DOMPoint): void {
    console.log(`ImageViewerComponent.beginPanInteraction`);
    this.pointerInteraction.mode = 'panning';
    this.pointerInteraction.startPoint = pointerPosition;
    this.pointerInteraction.lastPoint = pointerPosition;
  }

  private beginPinchInteraction(): void {
    console.log(`ImageViewerComponent.beginPinchInteraction`);

    this.unlockMarqueeEditFragmentIfNeeded();
    this.clearMarqueeInteractionState();

    this.pointerInteraction.mode = 'pinching';
    this.startPinchGesture();
  }

  private capturePointer(event: PointerEvent): void {
    try {
      this.svgRef.nativeElement.setPointerCapture(event.pointerId);
    } catch (e) {
      console.warn('ImageViewerComponent.capturePointer: setPointerCapture failed', e);
    }
  }

  // -----------------------------------------------------------------------------
  // pointer-move group:
  // -----------------------------------------------------------------------------

  onPointerMove(event: PointerEvent): void {
    if (!this.svgRef) {
      console.log(`ImageViewerComponent.onPointerMove: skipping as !svgRef`);
      return;
    }

    const isEditMarqueeMode = event.ctrlKey || this.editMarqueeMode;
    const pointerPosition = this.getPointerPosition(event);

    this.pointerInteraction.lastPoint = pointerPosition;
    this.calculateCursorStyle(pointerPosition, isEditMarqueeMode);
  }

  onPointerMoveBoundInternal(event: PointerEvent): void {
    if (!this.svgRef) {
      console.log(`ImageViewerComponent.onPointerMoveBoundInternal: skipping as !svgRef`);
      return;
    }

    event.preventDefault();

    this.trackPointerMove(event);

    if (this.pointerInteraction.activePointers.size === 2) {
      this.updatePinchInteraction();
      return;
    }

    if (this.pointerInteraction.activePointers.size > 1) {
      return;
    }

    const pointerPosition = this.getPointerPosition(event);
    const isEditMarqueeMode = event.ctrlKey || this.editMarqueeMode;

    this.pointerInteraction.lastPoint = pointerPosition;
    this.calculateCursorStyle(pointerPosition, isEditMarqueeMode);

    this.updateSinglePointerInteraction(pointerPosition);
  }

  private trackPointerMove(event: PointerEvent): void {
    if (this.pointerInteraction.activePointers.has(event.pointerId)) {
      this.pointerInteraction.activePointers.set(event.pointerId, event);
    }
  }

  private updatePinchInteraction(): void {
    this.updatePinchGesture();
  }

  private updateSinglePointerInteraction(pointerPosition: DOMPoint): void {
    if (!this.pointerInteraction.startPoint) {
      console.log(`ImageViewerComponent.updateSinglePointerInteraction: skipping as !startPoint`);
      return;
    }

    switch (this.pointerInteraction.mode) {
      case 'panning':
        this.updatePanInteraction(pointerPosition);
        return;

      case 'moving-marquee':
        this.updateMoveMarqueeInteraction(pointerPosition);
        return;

      case 'resizing-marquee':
        this.updateResizeMarqueeInteraction(pointerPosition);
        return;

      case 'idle':
      case 'pinching':
        return;
    }
  }

  private updatePanInteraction(pointerPosition: DOMPoint): void {
    const startPoint = this.pointerInteraction.startPoint;
    if (!startPoint) {
      return;
    }

    const dx = pointerPosition.x - startPoint.x;
    const dy = pointerPosition.y - startPoint.y;

    this.offsetX += dx;
    this.offsetY += dy;

    this.pointerInteraction.startPoint = pointerPosition;
  }

  private updateMoveMarqueeInteraction(pointerPosition: DOMPoint): void {
    if (this.marquee == null) {
      return;
    }

    const startPoint = this.pointerInteraction.startPoint;
    const startMarqueePoint = this.marqueeInteraction.startMarqueePoint;

    if (!startPoint || !startMarqueePoint) {
      return;
    }

    const dx = pointerPosition.x - startPoint.x;
    const dy = pointerPosition.y - startPoint.y;

    const dxSvg = dx / this.scale;
    const dySvg = dy / this.scale;

    this.marquee.rectangle.x = startMarqueePoint.x + dxSvg;
    this.marquee.rectangle.y = startMarqueePoint.y + dySvg;
  }

  private updateResizeMarqueeInteraction(pointerPosition: DOMPoint): void {
    if (this.marquee == null) {
      return;
    }

    const startPoint = this.pointerInteraction.startPoint;
    const startRect = this.marqueeInteraction.startRect;
    const resizeEdge = this.marqueeInteraction.resizeEdge;

    if (!startPoint || !startRect || !this.isResizeEdgeActive(resizeEdge)) {
      return;
    }

    const dxSvg = (pointerPosition.x - startPoint.x) / this.scale;
    const dySvg = (pointerPosition.y - startPoint.y) / this.scale;

    const { left, right, top, bottom } = resizeEdge!;

    let { x, y, width, height } = startRect;

    if (left) {
      x = startRect.x + dxSvg;
      width = startRect.width - dxSvg;
    }

    if (right) {
      width = startRect.width + dxSvg;
    }

    if (top) {
      y = startRect.y + dySvg;
      height = startRect.height - dySvg;
    }

    if (bottom) {
      height = startRect.height + dySvg;
    }

    const MIN = 5;

    if (width < 0) {
      x += width;
      width = Math.abs(width);
    }

    if (height < 0) {
      y += height;
      height = Math.abs(height);
    }

    width = Math.max(width, MIN);
    height = Math.max(height, MIN);

    this.marquee.rectangle.x = x;
    this.marquee.rectangle.y = y;
    this.marquee.rectangle.width = width;
    this.marquee.rectangle.height = height;
  }

  private updatePinchGesture(): void {
    const points = Array.from(this.pointerInteraction.activePointers.values());
    if (points.length !== 2) return;

    if (
      this.pinchInteraction.startDistance == null ||
      this.pinchInteraction.startScale == null ||
      this.pinchInteraction.startCenter == null ||
      this.pinchInteraction.startOffsetX == null ||
      this.pinchInteraction.startOffsetY == null
    ) {
      this.startPinchGesture();
      return;
    }

    const p1 = this.getPointerPosition(points[0]);
    const p2 = this.getPointerPosition(points[1]);

    const newDistance = this.distance(p1, p2);
    const newCenter = this.midpoint(p1, p2);

    const factor = newDistance / this.pinchInteraction.startDistance;
    const newScale = this.pinchInteraction.startScale * factor;

    // Keep the original pinch center stable while also allowing two-finger pan
    const svgXBefore =
      (this.pinchInteraction.startCenter.x - this.pinchInteraction.startOffsetX) / this.pinchInteraction.startScale;
    const svgYBefore =
      (this.pinchInteraction.startCenter.y - this.pinchInteraction.startOffsetY) / this.pinchInteraction.startScale;

    this.offsetX = newCenter.x - svgXBefore * newScale;
    this.offsetY = newCenter.y - svgYBefore * newScale;
    this.scale = newScale;
  }

  private startPinchGesture(): void {
    const points = Array.from(this.pointerInteraction.activePointers.values());
    if (points.length !== 2) return;

    const p1 = this.getPointerPosition(points[0]);
    const p2 = this.getPointerPosition(points[1]);

    this.pinchInteraction.startDistance = this.distance(p1, p2);
    this.pinchInteraction.startScale = this.scale;
    this.pinchInteraction.startCenter = this.midpoint(p1, p2);
    this.pinchInteraction.startOffsetX = this.offsetX;
    this.pinchInteraction.startOffsetY = this.offsetY;
  }

  private unlockMarqueeEditFragmentIfNeeded(): void {
    const fragmentId = this.marqueeInteraction.lockedFragmentId;
    const lockAcquired = this.marqueeInteraction.lockAcquired === true;

    if (!lockAcquired || fragmentId == null) {
      return;
    }

    /*
     * Clear first so a second cleanup path cannot send a duplicate unlock.
     */
    this.marqueeInteraction.lockAcquired = false;
    this.marqueeInteraction.lockedFragmentId = undefined;

    console.log(
      `ImageViewerComponent.unlockMarqueeEditFragmentIfNeeded: unlocking fragment ${fragmentId}`
    );

    this.fragmentLockService.unlockFragmentAfterFailedEdit(fragmentId);
  }

  // -----------------------------------------------------------------------------
  // pointer-up/cancel group:
  // -----------------------------------------------------------------------------

  onPointerUpBoundInternal(event: PointerEvent): void {
    console.log(`ImageViewerComponent.onPointerUpBoundInternal: pointerId=${event.pointerId}`);

    this.endPointer(event);

    if (this.pointerInteraction.activePointers.size > 0) {
      this.handlePartialPointerEnd();
      return;
    }

    this.endFinalPointer();
  }

  private endPointer(event: PointerEvent): void {
    this.releasePointer(event);
    this.pointerInteraction.activePointers.delete(event.pointerId);
  }

  private handlePartialPointerEnd(): void {
    if (this.pointerInteraction.activePointers.size < 2) {
      this.clearPinchState();
    }

    // Do not complete/persist anything yet.
    // Another pointer is still down.
  }

  private endFinalPointer(): void {
    this.removePointerWindowListeners();

    this.completePointerInteraction();

    this.clearPointerInteractionState();
  }

  onPointerCancel(event: PointerEvent): void {
    console.log(`ImageViewer.onPointerCancel: pointerId=${event.pointerId}`);
    this.releasePointer(event);
    this.cleanupAllPointers();
  }

  onPointerLeave(event: PointerEvent): void {
    console.log(`ImageViewer.onPointerLeave`);

    // With pointer capture, pointerleave during a drag is not necessarily fatal.
    // But if you do treat it as fatal, clear the activePointers map too.
    if (this.pointerInteraction.activePointers.size === 0) {
      this.releasePointer(event);
      this.cleanupAllPointers();
    }
  }

  private cleanupAllPointers(): void {
    const svg = this.svgRef?.nativeElement;

    if (svg) {
      for (const pointerId of this.pointerInteraction.activePointers.keys()) {
        try {
          if (svg.hasPointerCapture(pointerId)) {
            svg.releasePointerCapture(pointerId);
          }
        } catch (e) {
          console.warn(`ImageViewerComponent.cleanupAllPointers: releasePointerCapture failed for ${pointerId}`, e);
        }
      }
    }

    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
    window.removeEventListener('pointercancel', this.onPointerUpBound);

    this.pointerInteraction.activePointers.clear();
    this.unlockMarqueeEditFragmentIfNeeded();
    this.clearPointerInteractionState();
  }

  private releasePointer(event: PointerEvent): void {
    try {
      const svg = this.svgRef?.nativeElement;

      if (svg?.hasPointerCapture(event.pointerId)) {
        svg.releasePointerCapture(event.pointerId);
      }
    } catch (e) {
      console.warn('ImageViewerComponent.releasePointer: releasePointerCapture failed', e);
    }
  }

  private removePointerWindowListeners(): void {
    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
    window.removeEventListener('pointercancel', this.onPointerUpBound);
  }

  private clearMarqueeInteractionState(): void {
    this.marqueeInteraction = {};
  }

  private clearPointerInteractionState(): void {
    this.pointerInteraction.mode = 'idle';
    this.pointerInteraction.startPoint = undefined;
    this.pointerInteraction.lastPoint = undefined;

    this.marqueeInteraction = {};
    this.clearPinchState();
  }

  private clearPinchState(): void {
    this.pinchInteraction = {};
  }

  // -----------------------------------------------------------------------------
  // selection/cursor/hit-testing:
  // -----------------------------------------------------------------------------

  async onSelectMarquee(marquee: Marquee, event?: MouseEvent | PointerEvent) {

    console.log(`ImageViewerComponent.onSelectMarquee: marquee: ${JSON.stringify(marquee)}`);

    this.unlockMarqueeEditFragmentIfNeeded();

    this.modelContext.setMarqueeId(marquee.id);
    this.modelContext.setFragmentId(marquee.fragmentId);

    this.router.navigate(['/diary', this.diary.id, this.page.id, marquee.fragmentId]);
  }

  private marqueeAtPointer(pointerPosition: DOMPoint): Marquee | undefined {
    for (let i = this.marquees.length - 1; i >= 0; i--) {
      const m = this.marquees[i];

      if (this.pointInBounds(pointerPosition, this.marqueeBoundsInSvgFor(m))) {
        return m;
      }
    }

    return undefined;
  }

  private marqueeBoundsInSvg() {
    const m = this.marquee!.rectangle;
    const x = m.x * this.scale + this.offsetX;
    const y = m.y * this.scale + this.offsetY;
    const w = m.width * this.scale;
    const h = m.height * this.scale;
    return { left: x, right: x + w, top: y, bottom: y + h, w, h };
  }

  private marqueeBoundsInSvgFor(marquee: Marquee) {
    const r = marquee.rectangle;

    const x = r.x * this.scale + this.offsetX;
    const y = r.y * this.scale + this.offsetY;
    const w = r.width * this.scale;
    const h = r.height * this.scale;

    return {
      left: x,
      right: x + w,
      top: y,
      bottom: y + h
    };
  }


  private pointInBounds(
    p: DOMPoint,
    b: { left: number; right: number; top: number; bottom: number }
  ): boolean {
    return p.x >= b.left && p.x <= b.right &&
      p.y >= b.top && p.y <= b.bottom;
  }

  private pointInRect(p: Point, r: Rectangle): boolean {
    return p.x >= r.x && p.x <= r.x + r.width &&
      p.y >= r.y && p.y <= r.y + r.height;
  }

  private isResizeEdgeActive(edge?: ResizeEdge): boolean {
    return !!edge && (edge.left || edge.right || edge.top || edge.bottom);
  }

  calculateCursorStyle(pointerPosition: DOMPoint, isEditMarqueeMode: boolean) {

    // console.log(`ImageViewerComponent.calculateCursorStyle: mode=${this.mode} isDraggingGlobal=${this.isDraggingGlobal} isDraggingMarquee=${this.isDraggingMarquee}`);

    let cursor = 'default';

    if (!this.marquee) {
      // console.log(`ImageViewerComponent.calculateCursorStyle: no marquee --> default cursor style`);
      this.cursorStyle = cursor;
      return;
    }

    if (!isEditMarqueeMode) {
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
    const nearLeft = Math.abs(pointerPosition.x - bounds.left) < margin;
    const nearRight = Math.abs(pointerPosition.x - bounds.right) < margin;
    const nearTop = Math.abs(pointerPosition.y - bounds.top) < margin;
    const nearBottom = Math.abs(pointerPosition.y - bounds.bottom) < margin;

    const insideHoriz = (pointerPosition.x + margin >= bounds.left) && (pointerPosition.x - margin <= bounds.right);
    const insideVert = (pointerPosition.y + margin >= bounds.top) && (pointerPosition.y - margin <= bounds.bottom);

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

  detectResizeEdge(pointerPosition: DOMPoint): { left: boolean, right: boolean, top: boolean, bottom: boolean } {
    const edges = { left: false, right: false, top: false, bottom: false };
    if (this.marquee == null) return edges;

    const m = this.marquee.rectangle;
    const margin = 40;

    // Apply the <g> transform to get the position of the marquee in SVG logical space
    const bounds = this.marqueeBoundsInSvg();

    // The mouse position is already in SVG logical space
    // Now hit-test against the transformed marquee
    const insideHoriz = (pointerPosition.x + margin >= bounds.left) && (pointerPosition.x - margin <= bounds.right);
    const insideVert = (pointerPosition.y + margin >= bounds.top) && (pointerPosition.y - margin <= bounds.bottom);

    if (insideHoriz && insideVert) {
      edges.left = Math.abs(pointerPosition.x - bounds.left) < margin;
      edges.right = Math.abs(pointerPosition.x - bounds.right) < margin;
      edges.top = Math.abs(pointerPosition.y - bounds.top) < margin;
      edges.bottom = Math.abs(pointerPosition.y - bounds.bottom) < margin;
    }

    return edges;
  }

  // Get the mouse position relative to the SVG element in screen/pixel space.
  getPointerPosition(event: MouseEvent | PointerEvent): DOMPoint {
    if (!this.svgRef?.nativeElement) {
      console.warn('ImageViewerComponent.getPointerPosition: svgRef is not yet available');
      return new DOMPoint(0, 0);
    }

    const svg = this.svgRef.nativeElement;
    const pt = svg.createSVGPoint();

    pt.x = event.clientX;
    pt.y = event.clientY;

    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return pt;
    }

    return pt.matrixTransform(ctm.inverse());
  }

  // -----------------------------------------------------------------------------
  // add/update persistence:
  // -----------------------------------------------------------------------------

  private onAddButtonClick(): void {
    console.log(`ImageViewerComponent.onAddButtonClick`);

    firstValueFrom(
      combineLatest([
        this.modelContext.selectedFragment$,
        this.modelContext.fragments$
      ]).pipe(take(1))
    ).then(([selectedFragment, fragments]) => {
      const year = selectedFragment?.year ?? 0;
      const month = selectedFragment?.month ?? 0;
      const day = selectedFragment?.day ?? 0;

      const sequence = selectedFragment
        ? this.nextFragmentSequence(fragments, selectedFragment.sequence)
        : 1000;

      const rectangle = this.defaultMarqueeRectangle();

      const request = new AddFragmentRequest(
        this.page.id,
        year,
        month,
        day,
        sequence,
        '',
        rectangle.x,
        rectangle.y,
        rectangle.width,
        rectangle.height
      );

      this.rpcService.addFragment$(request)
        .pipe(take(1))
        .subscribe({
          next: (fragment: Fragment) => {
            console.log(
              `ImageViewerComponent.onAddButtonClick: fragment ${fragment.id} added`
            );

            this.alertService.info(`Fragment ${fragment.id} added`);

            this.modelContext.setFragmentId(fragment.id);
            this.modelContext.setMarqueeId(fragment.marqueeId);

            this.router.navigate([
              '/diary',
              this.diary.id,
              this.page.id,
              fragment.id
            ]);
          },

          error: err => {
            console.warn('ImageViewerComponent.onAddButtonClick failed', err);

            if (!this.handleAuthError(err)) {
              this.alertService.error('Could not add fragment');
            }
          }
        });
    });
  }

  private completePointerInteraction(): void {
    if (this.shouldPersistMarqueeUpdate()) {
      this.persistMarqueeUpdate();
      return;
    }

    // We locked the fragment but did not actually move/resize enough to save.
    // Since updateMarquee will not be called, the responder will not release the lock.
    this.unlockMarqueeEditFragmentIfNeeded();
  }

  private shouldPersistMarqueeUpdate(): boolean {
    const m = this.marquee;

    const wasMarqueeEdit =
      this.pointerInteraction.mode === 'moving-marquee' ||
      this.pointerInteraction.mode === 'resizing-marquee';

    if (
      m == null ||
      !wasMarqueeEdit ||
      this.marqueeInteraction.marqueeId !== m.id ||
      this.marqueeInteraction.marqueeVersion !== m.version
    ) {
      return false;
    }

    return this.hasMarqueeChanged();
  }

  private hasMarqueeChanged(): boolean {
    if (!this.marquee) {
      return false;
    }

    if (this.pointerInteraction.mode === 'moving-marquee') {
      const start = this.marqueeInteraction.startMarqueePoint;

      if (!start) {
        return false;
      }

      return Math.hypot(
        this.marquee.rectangle.x - start.x,
        this.marquee.rectangle.y - start.y
      ) > 0.5;
    }

    if (this.pointerInteraction.mode === 'resizing-marquee') {
      const start = this.marqueeInteraction.startRect;

      if (!start) {
        return false;
      }

      const r = this.marquee.rectangle;

      return (
        Math.abs(r.x - start.x) > 0.5 ||
        Math.abs(r.y - start.y) > 0.5 ||
        Math.abs(r.width - start.width) > 0.5 ||
        Math.abs(r.height - start.height) > 0.5
      );
    }

    return false;
  }

  private persistMarqueeUpdate(): void {

    if (this.marqueeUpdateInFlight) {
      console.log('ImageViewer: skipping update as there is a marquee Update In Flight');

      /*
       * We may already have acquired a lock for this interaction.
       * Since we are not sending updateMarquee, the responder will not clear it.
       */
      this.unlockMarqueeEditFragmentIfNeeded();

      return;
    }

    const current = this.marquee!;
    if (current == null) {
      return;
    }

    const lockedFragmentId = this.marqueeInteraction.lockedFragmentId;
    const lockAcquired = this.marqueeInteraction.lockAcquired === true;

    this.marqueeUpdateInFlight = true;

    const prevSnapshot: Marquee = {
      ...current,
      rectangle: { ...current.rectangle }
    };

    const requestPayload: Marquee = {
      ...prevSnapshot,
      version: prevSnapshot.version
    };

    const updated: Marquee = {
      ...current,
      version: (current.version ?? 0) + 1,
      rectangle: { ...current.rectangle }
    };

    this.marquee = updated;

    const idx = this.marquees.findIndex(m => m.id === updated.id);
    if (idx >= 0) {
      this.marquees[idx] = updated;
    }

    this.rpcService.updateMarquee$(requestPayload).subscribe({
      next: (saved: Marquee) => {
        console.log('ImageViewer: marquee update succeeded.', saved);

        this.marqueeUpdateInFlight = false;

        if (this.marquee?.id === saved.id) {
          this.marquee = saved;
        }

        const idx = this.marquees.findIndex(m => m.id === saved.id);
        if (idx >= 0) {
          this.marquees[idx] = saved;
        }
      },

      error: (err) => {
        console.log(`ImageViewer: marquee update failed, rolling back.`, err);
        this.marqueeUpdateInFlight = false;
        this.rollbackMarqueeUpdate(prevSnapshot);

        // updateMarquee failed, so the responder did not release the lock.
        // Because the client is rolling back/abandoning this edit, release it here.
        if (lockAcquired && lockedFragmentId != null) {
          this.fragmentLockService.unlockFragmentAfterFailedEdit(lockedFragmentId);
        }

        if (!this.handleAuthError(err)) {
          this.alertService.error(err);
        }
      }
    });
  }

  private rollbackMarqueeUpdate(prevSnapshot: Marquee): void {
    if (this.marquee && this.marquee.id === prevSnapshot.id) {
      this.marquee = {
        ...prevSnapshot,
        rectangle: { ...prevSnapshot.rectangle }
      };
    }

    const idx = this.marquees.findIndex(m => m.id === prevSnapshot.id);
    if (idx >= 0) {
      this.marquees[idx] = {
        ...prevSnapshot,
        rectangle: { ...prevSnapshot.rectangle }
      };
    }
  }

  // -----------------------------------------------------------------------------
  // keyboard/context/auth/lock:
  // -----------------------------------------------------------------------------

  onKeyDown(event: KeyboardEvent): void {
    if (this.marquee == null) {
      return;
    }

    if (event.key === 'Delete' && event.ctrlKey) {
      event.preventDefault();

      console.log('ImageViewerComponent.onKeyDown: Control + Delete pressed');
      this.deleteSelectedFragment();
    }
  }

  onRightClick(e: MouseEvent) {
  }

  private handleAuthError(err: any): boolean {
    if (err?.status === 401) {
      const returnUrl = this.router.url;
      this.router.navigate(['/signin'], { queryParams: { returnUrl } });
      return true;
    }
    return false;
  }

  private async deleteSelectedFragment(): Promise<void> {
    const fragment = await firstValueFrom(
      this.modelContext.selectedFragment$.pipe(take(1))
    );

    if (!fragment) {
      this.alertService.error('No fragment is currently selected');
      return;
    }

    const locked = await this.fragmentLockService.lockFragmentForEdit(fragment.id);
    if (!locked) {
      return;
    }

    console.log(
      `ImageViewerComponent.deleteSelectedFragment: deleting fragment ${fragment.id}, marquee ${fragment.marqueeId}`
    );

    this.rpcService.deleteFragment$(fragment.id)
      .pipe(take(1))
      .subscribe({
        next: (id: number) => {
          console.log(`ImageViewerComponent.deleteSelectedFragment: delete succeeded: id: ${id}`);

          /*
           * Do not unlock here if DeleteFragment clears the lock on the responder
           * side as part of the successful transaction.
           */

          this.modelContext.setMarqueeId(null);
          this.modelContext.setFragmentId(null);

          this.router.navigate([
            '/diary',
            this.diary.id,
            this.page.id
          ]);
        },

        error: (err: unknown) => {
          console.warn(`ImageViewerComponent.deleteSelectedFragment: delete failed`, err);

          this.fragmentLockService.unlockFragmentAfterFailedEdit(fragment.id);

          if (!this.handleAuthError(err)) {
            this.alertService.error('Could not delete fragment');
          }
        }
      });
  }

  private async deleteSelectedMarquee(): Promise<void> {
    const marquee = this.marquee;

    if (!marquee) {
      return;
    }

    const fragmentId = marquee.fragmentId;
    const marqueeId = marquee.id;

    console.log(
      `ImageViewerComponent.deleteSelectedMarquee: locking fragment ${fragmentId} before deleting marquee ${marqueeId}`
    );

    const locked = await this.fragmentLockService.lockFragmentForEdit(fragmentId);

    if (!locked) {
      console.warn(
        `ImageViewerComponent.deleteSelectedMarquee: could not lock fragment ${fragmentId}; delete abandoned`
      );
      return;
    }

    this.rpcService.deleteMarquee$(marqueeId)
      .pipe(take(1))
      .subscribe({
        next: (id: number) => {
          console.log(`ImageViewerComponent.deleteSelectedMarquee: delete succeeded: id: ${id}`);

          /*
           * Do not call unlockFragment$ here if DeleteMarquee clears the lock
           * on the responder side after a successful delete.
           */

          this.marquee = null;
          this.modelContext.setMarqueeId(null);

          this.router.navigate(['/diary', this.diary.id, this.page.id]);
        },

        error: (err: unknown) => {
          console.warn(`ImageViewerComponent.deleteSelectedMarquee: delete failed`, err);

          /*
           * The delete failed. The responder may have rolled back before clearing
           * the lock, so unlock as a client-side fallback.
           */
          this.fragmentLockService.unlockFragmentAfterFailedEdit(fragmentId);

          if (!this.handleAuthError(err)) {
            this.alertService.error('Could not delete marquee');
          }
        }
      });
  }

  // -----------------------------------------------------------------------------
  // tiny generic geometry helpers
  // -----------------------------------------------------------------------------
  private distance(a: DOMPoint, b: DOMPoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private midpoint(a: DOMPoint, b: DOMPoint): DOMPoint {
    return new DOMPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
  }

  arraysEqual(a: Marquee[], b: Marquee[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((m, i) => m.id === b[i].id);
  }

  // -----------------------------------------------------------------------------
  // Methods used in the template
  // -----------------------------------------------------------------------------

  get width(): number {
    return this.page?.width ?? 0;
  }

  get height(): number {
    return this.page?.height ?? 0;
  }

  get transformStyle(): string {
    return `translate(${this.offsetX}, ${this.offsetY}) scale(${this.scale})`;
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

  private defaultMarqueeRectangle(): Rectangle {
    return new Rectangle(
      this.page.width / 5,
      this.page.height / 5,
      (3 * this.page.width) / 5,
      (3 * this.page.height) / 5
    );
  }

  private nextFragmentSequence(fragments: Fragment[], selectedSequence: number): number {
    const sorted = fragments
      .slice()
      .sort((a, b) => a.sequence - b.sequence);

    const selectedIndex = sorted.findIndex(f => f.sequence === selectedSequence);
    const selected = selectedIndex >= 0 ? sorted[selectedIndex] : null;
    const next = selectedIndex >= 0 ? sorted[selectedIndex + 1] : null;

    if (selected && next) {
      return (selected.sequence + next.sequence) / 2;
    }

    if (selected) {
      return selected.sequence + 1000;
    }

    if (sorted.length > 0) {
      return sorted[sorted.length - 1].sequence + 1000;
    }

    return 1000;
  }
}
