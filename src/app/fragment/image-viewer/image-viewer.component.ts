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
import { Fragment } from '../../model/fragment';
import { AccessTokenService } from '../../user/token/accessTokenService';


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
}

interface PinchInteraction {
  startDistance?: number;
  startScale?: number;
  startCenter?: DOMPoint;
  startOffsetX?: number;
  startOffsetY?: number;
}


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

  private readonly onPointerMoveBound = this.onPointerMoveBoundInternal.bind(this);
  private readonly onPointerUpBound = this.onPointerUpBoundInternal.bind(this);
  private destroy$ = new Subject<void>();

  scale = 1;
  offsetX = 0;
  offsetY = 0;
  imageURL: string = '';
  marquee: Marquee | null = null;
  marquees: Marquee[] = [];
  mode: ViewMode = ViewMode.WithoutMarquee;
  cursorStyle = '';
  diary: Diary = Diary.default;
  page: Page = Page.default;
  config: Config | null = null;
  editMarqueeMode = false;

  // interactionMode: InteractionMode = 'idle';
  private pointerInteraction: PointerInteraction = {
    mode: 'idle',
    activePointers: new Map<number, PointerEvent>()
  };

  private marqueeInteraction: MarqueeInteraction = {};

  private pinchInteraction: PinchInteraction = {};

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

  private marqueeAtPointer(pointerPosition: DOMPoint): Marquee | undefined {
    for (let i = this.marquees.length - 1; i >= 0; i--) {
      const m = this.marquees[i];

      if (this.pointInBounds(pointerPosition, this.marqueeBoundsInSvgFor(m))) {
        return m;
      }
    }

    return undefined;
  }


  private isResizeEdgeActive(edge?: ResizeEdge): boolean {
    return !!edge && (edge.left || edge.right || edge.top || edge.bottom);
  }

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
        this.config = config;
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
        this.mode = m ? ViewMode.WithMarquee : ViewMode.WithoutMarquee;
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

    // Auto-select first marquee only if there is no fragmentId AND no selected marquee.
    this.modelContext.selectedPage$
      .pipe(
        filter(p => !!p),
        switchMap(() =>
          combineLatest([
            this.modelContext.marquees$,
            this.modelContext.fragmentId$,
            this.modelContext.selectedMarquee$,
          ]).pipe(
            filter(([ms, fid, selected]) =>
              fid == null &&
              selected == null &&
              Array.isArray(ms) &&
              ms.length > 0
            ),
            take(1)
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(([ms]) => {
        const first = ms[0];

        this.modelContext.setMarqueeId(first.id);
        this.modelContext.setFragmentId(first.fragmentId);

        this.router.navigate(
          ['/diary', this.diary!.id, this.page!.id, first.fragmentId],
          { replaceUrl: true }
        );
      });

    this.modelContext.editMarqueeMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.editMarqueeMode = value;

        if (this.pointerInteraction.lastPoint) {
          this.calculateCursorStyle(this.pointerInteraction.lastPoint, this.editMarqueeMode);
        }
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

    this.modelContext.setHasSelectedMarquee(false);
    this.modelContext.setEditMarqueeMode(false);

    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
    window.removeEventListener('pointercancel', this.onPointerUpBound);

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




  private clearMarqueeInteractionState(): void {
    this.marqueeInteraction = {};
  }

  async onPointerDown(event: PointerEvent): Promise<void> {
    console.log(`ImageViewerComponent.onPointerDown: pointerType=${event.pointerType}`);

    if (!this.svgRef) {
      console.log(`ImageViewerComponent.onPointerDown: skipping as !svgRef`);
      return;
    }

    // For mouse, only accept left button.
    // For touch/pen, button is often 0, but buttons may vary across browsers.
    if (event.pointerType === 'mouse' && event.button !== 0) {
      console.log(`ImageViewerComponent.onPointerDown: skipping as wrong mouse button`);
      return;
    }

    event.preventDefault();

    const isEditMarqueeMode = event.ctrlKey || this.editMarqueeMode;
    const pointerPosition = this.getPointerPosition(event);

    const selectedResizeEdge =
      this.mode === ViewMode.WithMarquee && this.marquee && isEditMarqueeMode
        ? this.detectResizeEdge(pointerPosition)
        : undefined;

    const pointerIsOnSelectedMarquee =
      this.mode === ViewMode.WithMarquee &&
      !!this.marquee &&
      isEditMarqueeMode &&
      (
        this.isResizeEdgeActive(selectedResizeEdge) ||
        this.pointInBounds(pointerPosition, this.marqueeBoundsInSvg())
      );

    const clickedMarquee = this.marqueeAtPointer(pointerPosition);

    console.log(
      `clickedMarquee=${clickedMarquee?.id}, selected=${this.marquee?.id}, activePointers=${this.pointerInteraction.activePointers.size}`
    );

    // Plain click/tap on a different marquee selects it.
    // Do this before pointer capture / activePointers setup.
    if (
      !pointerIsOnSelectedMarquee &&
      this.pointerInteraction.activePointers.size === 0 &&
      clickedMarquee &&
      clickedMarquee.id !== this.marquee?.id
    ) {
      console.log(`ImageViewerComponent.onPointerDown: selecting clicked marquee ${clickedMarquee.id}`);
      await this.onSelectMarquee(clickedMarquee, event);
      return;
    }

    const svg = this.svgRef.nativeElement;

    try {
      svg.setPointerCapture(event.pointerId);
    } catch (e) {
      console.warn('ImageViewerComponent.onPointerDown: setPointerCapture failed', e);
    }

    this.pointerInteraction.activePointers.set(event.pointerId, event);

    if (this.pointerInteraction.activePointers.size === 2) {
      this.clearMarqueeInteractionState();
      this.pointerInteraction.mode = 'pinching';
      this.startPinchGesture();
      return;
    }

    if (this.pointerInteraction.activePointers.size > 1) {
      return;
    }

    window.addEventListener('pointermove', this.onPointerMoveBound, { passive: false });
    window.addEventListener('pointerup', this.onPointerUpBound);
    window.addEventListener('pointercancel', this.onPointerUpBound);


    this.pointerInteraction.startPoint = pointerPosition;
    this.pointerInteraction.lastPoint = pointerPosition;

    console.log(`ImageViewerComponent.onPointerDown: is viewMode.WithMarquee: ${this.mode === ViewMode.WithMarquee}`);
    console.log(`ImageViewerComponent.onPointerDown: this.marquee: ${JSON.stringify(this.marquee)}`);
    console.log(`ImageViewerComponent.onPointerDown: isEditMarqueeMode: ${isEditMarqueeMode}`);

    if (this.mode === ViewMode.WithMarquee && this.marquee && isEditMarqueeMode) {
      console.log(`ImageViewerComponent.onPointerDown: with marquee`);

      this.marqueeInteraction.startRect = { ...this.marquee.rectangle };
      this.marqueeInteraction.resizeEdge = selectedResizeEdge ?? this.detectResizeEdge(pointerPosition);
      this.marqueeInteraction.marqueeId = this.marquee.id;
      this.marqueeInteraction.marqueeVersion = this.marquee.version;

      if (!this.isResizeEdgeActive(this.marqueeInteraction.resizeEdge)) {
        this.pointerInteraction.mode = 'moving-marquee';

        const r = this.marquee.rectangle;
        this.marqueeInteraction.startMarqueePoint = { x: r.x, y: r.y };
      } else {
        this.pointerInteraction.mode = 'resizing-marquee';
      }

    } else {
      console.log(`ImageViewerComponent.onPointerDown: global pan`);
      this.pointerInteraction.mode = 'panning';
    }
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

    if (this.pointerInteraction.activePointers.has(event.pointerId)) {
      this.pointerInteraction.activePointers.set(event.pointerId, event);
    }

    if (this.pointerInteraction.activePointers.size === 2) {
      this.updatePinchGesture();
      return;
    }

    if (this.pointerInteraction.activePointers.size > 1) {
      return;
    }

    const isEditMarqueeMode = event.ctrlKey || this.editMarqueeMode;
    const pointerPosition = this.getPointerPosition(event);

    this.pointerInteraction.lastPoint = pointerPosition;
    this.calculateCursorStyle(pointerPosition, isEditMarqueeMode);

    if (!this.pointerInteraction.startPoint) {
      console.log(`ImageViewerComponent.onPointerMoveBoundInternal: skipping as !dragStart`);
      return;
    }

    const dx = pointerPosition.x - this.pointerInteraction.startPoint.x;
    const dy = pointerPosition.y - this.pointerInteraction.startPoint.y;

    if (this.pointerInteraction.mode == 'panning') {
      this.offsetX += dx;
      this.offsetY += dy;
      this.pointerInteraction.startPoint = pointerPosition;
      return;
    }

    if (this.mode !== ViewMode.WithMarquee) {
      console.log(`ImageViewerComponent.onPointerMoveBoundInternal: skipping as mode != ViewMode.WithMarquee`);
      return;
    }

    if (!this.marquee) {
      console.log(`ImageViewerComponent.onPointerMoveBoundInternal: skipping as !marquee`);
      return;
    }

    const r = this.marquee.rectangle;

    if (this.pointerInteraction.mode === 'moving-marquee' && this.marqueeInteraction.startMarqueePoint) {
      const dxSvg = dx / this.scale;
      const dySvg = dy / this.scale;

      r.x = this.marqueeInteraction.startMarqueePoint.x + dxSvg;
      r.y = this.marqueeInteraction.startMarqueePoint.y + dySvg;
    }

    if (this.pointerInteraction.mode === 'resizing-marquee' &&
      this.marqueeInteraction.startRect
      && this.isResizeEdgeActive(this.marqueeInteraction.resizeEdge)) {
      const left = this.marqueeInteraction.resizeEdge?.left;
      const right = this.marqueeInteraction.resizeEdge?.right;
      const top = this.marqueeInteraction.resizeEdge?.top;
      const bottom = this.marqueeInteraction.resizeEdge?.bottom;
      let { x, y, width, height } = this.marqueeInteraction.startRect;

      const dxSvg = (pointerPosition.x - this.pointerInteraction.startPoint.x) / this.scale;
      const dySvg = (pointerPosition.y - this.pointerInteraction.startPoint.y) / this.scale;

      if (left) {
        x = this.marqueeInteraction.startRect.x + dxSvg;
        width = this.marqueeInteraction.startRect.width - dxSvg;
      }

      if (right) {
        width = this.marqueeInteraction.startRect.width + dxSvg;
      }

      if (top) {
        y = this.marqueeInteraction.startRect.y + dySvg;
        height = this.marqueeInteraction.startRect.height - dySvg;
      }

      if (bottom) {
        height = this.marqueeInteraction.startRect.height + dySvg;
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

      r.x = x;
      r.y = y;
      r.width = width;
      r.height = height;
    }
  }

  private distance(a: DOMPoint, b: DOMPoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private midpoint(a: DOMPoint, b: DOMPoint): DOMPoint {
    return new DOMPoint((a.x + b.x) / 2, (a.y + b.y) / 2);
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


  onPointerUpBoundInternal(event: PointerEvent): void {
    console.log(`ImageViewerComponent.onPointerUpBoundInternal: pointerId=${event.pointerId}`);

    this.pointerInteraction.activePointers.delete(event.pointerId);

    try {
      const svg = this.svgRef?.nativeElement;
      if (svg?.hasPointerCapture(event.pointerId)) {
        svg.releasePointerCapture(event.pointerId);
      }
    } catch (e) {
      console.warn('ImageViewerComponent.onPointerUpBoundInternal: releasePointerCapture failed', e);
    }

    // If we have gone from 2 fingers to 1, end the pinch state,
    // but do not yet remove the listeners.
    if (this.pointerInteraction.activePointers.size < 2) {
      this.clearPinchState();
    }

    // If another finger is still down, wait for its pointerup.
    // Do not persist/clear the gesture yet.
    if (this.pointerInteraction.activePointers.size > 0) {
      return;
    }

    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
    window.removeEventListener('pointercancel', this.onPointerUpBound);

    const m = this.marquee;

    const wasMarqueeEdit =
      this.pointerInteraction.mode === 'moving-marquee' ||
      this.pointerInteraction.mode === 'resizing-marquee';

    const canUpdate =
      this.mode === ViewMode.WithMarquee &&
      !!m &&
      wasMarqueeEdit &&
      this.marqueeInteraction.marqueeId === m.id &&
      this.marqueeInteraction.marqueeVersion === m.version;

    const moved =
      this.pointerInteraction.mode === 'moving-marquee' &&
      !!this.marquee &&
      !!this.marqueeInteraction.startMarqueePoint &&
      Math.hypot(
        this.marquee.rectangle.x - this.marqueeInteraction.startMarqueePoint.x,
        this.marquee.rectangle.y - this.marqueeInteraction.startMarqueePoint.y
      ) > 0.5;

    const resized =
      this.pointerInteraction.mode === 'resizing-marquee';

    const changed = moved || resized;

    if (canUpdate && changed) {
      const current = this.marquee!;
      const prevSnapshot: Marquee = { ...current, rectangle: { ...current.rectangle } };

      const requestPayload: Marquee = {
        ...prevSnapshot,
        version: prevSnapshot.version
      };

      current.version = (current.version ?? 0) + 1;

      // Keep local list in sync immediately, even before MQTT echoes the update.
      const idx = this.marquees.findIndex(m => m.id === current.id);
      if (idx >= 0) {
        this.marquees[idx] = {
          ...current,
          rectangle: { ...current.rectangle }
        };
      }

      this.rpcService.updateMarquee$(requestPayload).subscribe({
        next: () => {
          console.log('ImageViewer: marquee update succeeded (optimistic).');
        },
        error: (err) => {
          console.log(`ImageViewer: marquee update failed, rolling back.`, err);

          if (this.marquee && this.marquee.id === prevSnapshot.id) {
            this.marquee.version = prevSnapshot.version;
            this.marquee.rectangle = { ...prevSnapshot.rectangle };
          }

          const idx = this.marquees.findIndex(m => m.id === prevSnapshot.id);
          if (idx >= 0) {
            this.marquees[idx] = { ...prevSnapshot, rectangle: { ...prevSnapshot.rectangle } };
          }

          if (!this.handleAuthError(err)) {
            this.alertService.error(err);
          }
        }
      });
    }

    this.clearPointerInteractionState();
  }

  private clearPinchState(): void {
    this.pinchInteraction = {};
  }

  private clearPointerInteractionState(): void {
    this.pointerInteraction.mode = 'idle';
    this.pointerInteraction.startPoint = undefined;
    this.pointerInteraction.lastPoint = undefined;

    this.marqueeInteraction = {};
    this.clearPinchState();
  }



  private pointInRect(p: Point, r: Rectangle): boolean {
    return p.x >= r.x && p.x <= r.x + r.width &&
      p.y >= r.y && p.y <= r.y + r.height;
  }

  async onSelectMarquee(marquee: Marquee, event?: MouseEvent | PointerEvent) {

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
    if (this.mode !== ViewMode.WithMarquee) return edges;
    if (!this.marquee) return edges;

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
    const rectangle = new Rectangle(
      this.width / 5,
      this.height / 5,
      (3 * this.width) / 5,
      (3 * this.height) / 5
    );

    const sequence = 123;

    this.rpcService.addMarquee$(this.page, rectangle, sequence).subscribe({
      next: (m: Marquee) => {
        this.alertService.info(`marquee: id: ${m.id} added`);

        // Optional but useful: make the local list immediately consistent,
        // instead of waiting for the MQTT retained topic update to arrive.
        this.marquees = [
          ...this.marquees.filter(existing => existing.id !== m.id),
          m
        ];

        this.modelContext.setMarqueeId(m.id);
        this.modelContext.setFragmentId(m.fragmentId);

        this.router.navigate([
          '/diary',
          this.diary.id,
          this.page.id,
          m.fragmentId
        ]);
      },

      error: (err) => {
        if (!this.handleAuthError(err)) {
          this.alertService.error(err);
        }
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

  onPointerCancel(event: PointerEvent): void {
    console.log(`ImageViewer.onPointerCancel: pointerId=${event.pointerId}`);
    this.cleanupAllPointers();
  }

  onPointerLeave(event: PointerEvent): void {
    console.log(`ImageViewer.onPointerLeave`);

    // With pointer capture, pointerleave during a drag is not necessarily fatal.
    // But if you do treat it as fatal, clear the activePointers map too.
    if (this.pointerInteraction.activePointers.size === 0) {
      this.cleanupAllPointers();
    }
  }

  private cleanupAllPointers(): void {
    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
    window.removeEventListener('pointercancel', this.onPointerUpBound);

    this.pointerInteraction.activePointers.clear();
    this.clearPointerInteractionState();
  }
}
