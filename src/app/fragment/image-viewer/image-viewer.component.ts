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
import { Fragment } from '../../model/fragment';
import { Point } from '@angular/cdk/drag-drop';
import { Rectangle } from '../../utilities/rectangle';
import { Diary } from '../../model/diary';
import { Page } from '../../model/page';
import { RpcService } from '../../mqtt/rpc.service';
import { AlertService } from '../../alerts/alert.service';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, combineLatest, distinctUntilChanged, filter, from, map, Subject, switchMap, takeUntil } from 'rxjs';
import { LiveObjectListService } from '../../mqtt/live.object.list.service';
import { ConfigService } from '../../config/config.service';
import { LiveObjectService } from '../../mqtt/live.object.service';
import { FragmentContextService } from '../fragment-context.service';

enum ViewMode {
  WithMarquee,
  WithoutFragment
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
    private route: ActivatedRoute,
    private router: Router,
    private rpcService: RpcService,
    private alertService: AlertService,
    private configService: ConfigService,
    private liveObjectService: LiveObjectService,
    private liveObjectListService: LiveObjectListService,
    private context: FragmentContextService
  ) { };

  private destroy$ = new Subject<void>();
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  width: number = 0;
  height: number = 0;
  imageUrl: string = '';
  resizeEdge?: { left: boolean; right: boolean; top: boolean; bottom: boolean; };
  marquee: Marquee | null = null;
  marquees: Marquee[] = [];
  otherMarquees: Marquee[] = [];
  mode: ViewMode = ViewMode.WithoutFragment;
  cursorStyle = '';
  isDraggingGlobal = false;
  isDraggingMarquee = false;
  dragStart?: DOMPoint;
  dragStartMarquee?: Point;
  originalRectangle?: Rectangle;
  diary: Diary = Diary.default;
  page: Page = Page.default;
  pages: Page[] = [];
  private params$ = new BehaviorSubject<{ diaryId: number, pageId: number, marqueeId: number | null } | null>(null);


  ngOnInit(): void {
    console.log(`ImageViewerComponent.ngOnInit`);

    this.context.addButtonClicked$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.onAddButtonClick();
      });

    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(paramMap => {
        const diaryId = Number(paramMap.get('diaryId'));
        const pageId = Number(paramMap.get('pageId'));
        const marqueeId = paramMap.has('marqueeId') ? Number(paramMap.get('marqueeId')) : null;

        this.params$.next({ diaryId, pageId, marqueeId });
      });

    this.params$
      .pipe(
        filter((p): p is { diaryId: number; pageId: number; marqueeId: number | null } => p !== null),
        distinctUntilChanged((a, b) =>
          a.diaryId === b.diaryId &&
          a.pageId === b.pageId &&
          a.marqueeId === b.marqueeId
        ),
        switchMap(({ diaryId, pageId, marqueeId }) => {
          const config$ = from(this.configService.getConfig());
          const diary$ = this.liveObjectService.getDiaryById$(diaryId).pipe(takeUntil(this.destroy$));
          const page$ = this.liveObjectService.getPageById$(diaryId, pageId).pipe(takeUntil(this.destroy$));
          const pages$ = this.liveObjectListService.getPagesForDiary$(diaryId).pipe(takeUntil(this.destroy$));
          const marquees$ = this.liveObjectListService.getMarqueesForPage$(diaryId, pageId).pipe(takeUntil(this.destroy$));

          if (marqueeId !== null) {
            const marquee$ = this.liveObjectService.getMarqueeById$(diaryId, pageId, marqueeId).pipe(takeUntil(this.destroy$));
            return combineLatest([config$, diary$, page$, pages$, marquees$, marquee$]).pipe(
              map(([config, diary, page, pages, marquees, marquee]) => ({
                config, diary, page, pages, marquees, marquee, marqueeId
              }))
            );
          } else {
            return combineLatest([config$, diary$, page$, pages$, marquees$]).pipe(
              map(([config, diary, page, pages, marquees]) => ({
                config, diary, page, pages, marquees, marquee: null, marqueeId: null
              }))
            );
          }
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(({ config, diary, page, pages, marquees, marquee, marqueeId }) => {


        console.log(`ImageViewerComponent.OnInit: subscribe: marqueeId: ${marqueeId}, marquee: ${JSON.stringify(marquee)}`);

        this.diary = diary;
        this.page = page;
        this.width = page.width;
        this.height = page.height;
        this.pages = pages;
        this.marquees = marquees;
        this.imageUrl = `${config.fileServerUrl}/${diary.name}/${page.name}${page.extension}`;

        const title = marqueeId ? `${diary.name} - ${page.name} - ${marqueeId}` : `${diary.name} - ${page.name}`;
        this.titleChanged.emit(title);

        if (marqueeId !== null && marquee === null) {
          // console.log(`ImageViewerComponent.OnInit: subscribe: marquee: ${marqueeId}. no valid marquee, or marquee was deleted`);
          this.marquee = undefined!;
          this.originalRectangle = undefined;
          this.mode = ViewMode.WithoutFragment;
          this.updateOtherMarquees();
          this.router.navigate([`/diary/${this.diary.id}/${this.page.id}`]);
          return;
        }

        if (marquee) {
          // console.log(`ImageViewerComponent.OnInit: subscribe: marquee: ${JSON.stringify(marquee)}`);
          this.marquee = marquee;
          this.mode = ViewMode.WithMarquee;
          this.context.setFragmentId(marquee.fragmentId);
        }

        this.updateOtherMarquees();
        // this.otherMarquees.forEach((m, index) => {
        //   console.log(`  [${index}] ${JSON.stringify(m)}`);
        // });
      });
  }

  ngAfterViewInit(): void {
    if (this.svgRef?.nativeElement) {
      this.svgRef.nativeElement.focus();
      console.log('ImageViewerComponent: svg focused');
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.diary && this.page) {
      this.liveObjectListService.unsubscribeFromPagesForDiary$(this.diary.id);
      this.liveObjectListService.unsubscribeFromMarqueesForPage$(this.diary.id, this.page.id);
    }
  }

  get transformStyle(): string {
    return `translate(${this.offsetX}, ${this.offsetY}) scale(${this.scale})`;
  }

  onMouseLeave(event: MouseEvent) {
    console.log(`ImageViewer.onMouseLeave:`);
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();

    // This increases (scroll up) or decreases (scroll down) the scale.
    const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9;
    const newScale = this.scale * scaleFactor;

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
    if (this.mode !== ViewMode.WithMarquee || !this.marquee || !this.svgRef) return;

    console.log(`ImageViewerComponent.onMouseDown: this.marquee: ${JSON.stringify(this.marquee)}`);

    this.updateOtherMarquees();

    const mousePosition = this.getMousePosition(event);

    const isCtrlKeyDown = event.ctrlKey;
    if (isCtrlKeyDown) {
      this.resizeEdge = this.detectResizeEdge(mousePosition);

      this.dragStart = mousePosition;
      this.originalRectangle = { ...this.marquee.rectangle };

      if (Object.values(this.resizeEdge).every(v => v === false)) {
        // Ctrl + click inside marquee = move marquee
        this.isDraggingMarquee = true;
        this.dragStart = mousePosition;
        const r = this.marquee.rectangle;
        this.dragStartMarquee = { x: r.x, y: r.y };
      } else {
        // Ctrl + click near edge = resize
        this.dragStart = mousePosition;
      }
    } else {
      // fallback to global pan
      this.isDraggingGlobal = true;
      this.dragStart = mousePosition;
    }
  }


  onMouseMove(event: MouseEvent) {
    if (this.mode !== ViewMode.WithMarquee || !this.marquee || !this.svgRef) return;

    const isCtrlKeyDown = event.ctrlKey;
    let mousePosition = this.getMousePosition(event);
    this.calculateCursorStyle(mousePosition, isCtrlKeyDown)
    if (!this.dragStart) return;

    const dx = mousePosition.x - this.dragStart.x;
    const dy = mousePosition.y - this.dragStart.y;

    const r = this.marquee.rectangle;

    if (this.isDraggingGlobal) {
      this.offsetX += dx;
      this.offsetY += dy;
      this.dragStart = mousePosition;
    }

    if (this.isDraggingMarquee && this.marquee && this.dragStartMarquee) {
      const dxSvg = dx / this.scale;
      const dySvg = dy / this.scale;

      r.x = this.dragStartMarquee.x + dxSvg;
      r.y = this.dragStartMarquee.y + dySvg;
    }

    if (isCtrlKeyDown && this.isResizing() && this.originalRectangle) {
      const { left, right, top, bottom } = this.resizeEdge!;
      const dx = (mousePosition.x - this.dragStart!.x) / this.scale;
      const dy = (mousePosition.y - this.dragStart!.y) / this.scale;

      if (left) {
        r.x = this.originalRectangle.x + dx;
        r.width = this.originalRectangle.width - dx;
      }
      if (right) {
        r.width = this.originalRectangle.width + dx;
      }
      if (top) {
        r.y = this.originalRectangle.y + dy;
        r.height = this.originalRectangle.height - dy;
      }
      if (bottom) {
        r.height = this.originalRectangle.height + dy;
      }
      return;
    }
  }

  onMouseUp() {
    if (this.mode !== ViewMode.WithMarquee) return;
    if (!this.marquee) return;
    if (this.isResizing() || this.isDragging()) {

      console.log(`ImageViewerComponent.onMouseUp: updating marquee`);
      this.rpcService.updateMarquee$(this.marquee).subscribe({
        next: (id) => {
          console.log(`ImageViewerComponent.onMouseUp: marquee updated succeeded: id: ${id}`);
        },
        error: (err) => {
          console.log(`ImageViewerComponent.onMouseUp: ${err}`);
          if (!this.handleAuthError(err)) {
            this.alertService.error(err);
          }
        }
      });
    }

    this.updateOtherMarquees();

    this.isDraggingGlobal = false;
    this.isDraggingMarquee = false;
    this.resizeEdge = undefined;
    this.dragStart = undefined;
    this.dragStartMarquee = undefined;
    this.originalRectangle = undefined;
  }

  onSelectMarquee(marquee: Marquee) {
    console.log(`ImageViewerComponent.onSelectMarquee: marquee: ${JSON.stringify(marquee)}`);

    const target = `/diary/${this.diary.id}/${this.page.id}/${marquee.id}`
    console.log(`ImageViewerComponent.onSelectMarquee: redirecting to: ${target}`);

    this.router.navigate([`/diary/${this.diary.id}/${this.page.id}/${marquee.id}`]);
  }

  private updateOtherMarquees() {
    this.otherMarquees = this.marquees.filter(m => m.id !== this.marquee?.id);
  }

  calculateCursorStyle(mousePosition: DOMPoint, isCtrlKeyDown: boolean) {
    if (this.mode != ViewMode.WithMarquee) return;
    if (!this.marquee) return;

    const m = this.marquee.rectangle;

    // Apply the <g> transform to get the position of the marquee in SVG logical space
    const rectX = m.x * this.scale + this.offsetX;
    const rectY = m.y * this.scale + this.offsetY;
    const rectWidth = m.width * this.scale;
    const rectHeight = m.height * this.scale;

    const left = rectX;
    const right = rectX + rectWidth;
    const top = rectY;
    const bottom = rectY + rectHeight;

    // The mouse position is already in SVG logical space

    // Now hit-test against the transformed marquee
    const margin = 40;
    const nearLeft = Math.abs(mousePosition.x - left) < margin;
    const nearRight = Math.abs(mousePosition.x - right) < margin;
    const nearTop = Math.abs(mousePosition.y - top) < margin;
    const nearBottom = Math.abs(mousePosition.y - bottom) < margin;

    const insideHoriz = (mousePosition.x + margin >= left) && (mousePosition.x - margin <= right);
    const insideVert = (mousePosition.y + margin >= top) && (mousePosition.y - margin <= bottom);

    let cursor = 'default';

    if (isCtrlKeyDown && insideHoriz && insideVert) {

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
    const left = m.x * this.scale + this.offsetX;
    const right = (m.x + m.width) * this.scale + this.offsetX;
    const top = m.y * this.scale + this.offsetY;
    const bottom = (m.y + m.height) * this.scale + this.offsetY;

    // The mouse position is already in SVG logical space
    // Now hit-test against the transformed marquee
    const insideHoriz = (mousePosition.x + margin >= left) && (mousePosition.x - margin <= right);
    const insideVert = (mousePosition.y + margin >= top) && (mousePosition.y - margin <= bottom);

    if (insideHoriz && insideVert) {
      edges.left = Math.abs(mousePosition.x - left) < margin;
      edges.right = Math.abs(mousePosition.x - right) < margin;
      edges.top = Math.abs(mousePosition.y - top) < margin;
      edges.bottom = Math.abs(mousePosition.y - bottom) < margin;
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

      this.router.navigate([`/diary/${this.diary.id}/${this.page.id}`]);
    }
  }

  onRightClick(e: MouseEvent) {
  }

  onAddButtonClick() {
    const x = this.width / 5;
    const y = this.height / 5;
    const width = 3 * this.width / 5;
    const height = 3 * this.height / 5;
    const rectangle = new Rectangle(x, y, width, height);
    const sequence = 123
    console.log(`ImageViewerComponent.onAddButtonClick: id: ${JSON.stringify(rectangle)}`)
    this.rpcService.addMarquee$(this.page, rectangle, sequence).subscribe({
      next: (id) => {
        const marquee = new Marquee(id, rectangle, sequence);

        console.log(`ImageViewerComponent.onAddButtonClick: marquee: id: ${marquee.id} added`);
        this.alertService.info(`marquee: id: ${marquee.id} added`);

        this.router.navigate([`/diary/${this.diary.id}/${this.page.id}/${marquee.id}`]);
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
}
