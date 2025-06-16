import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  OnInit
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
import { combineLatest, from, Subject, takeUntil } from 'rxjs';
import { LiveObjectListService } from '../../mqtt/live.object.list.service';
import { ConfigService } from '../../config/config.service';
import { LiveObjectService } from '../../mqtt/live.object.service';

enum ViewMode {
  WithFragment,
  WithoutFragment
}

@Component({
  selector: 'app-image-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-viewer.component.html',
  styleUrls: ['./image-viewer.component.scss']
})
export class ImageViewerComponent implements OnInit {

  @Input() width = 1000;
  @Input() height = 1400;
  @Input() imageUrl = '';
  @Input() fragment?: Fragment;

  @Output() titleChanged = new EventEmitter<string>();
  @Output() svgRefReady = new EventEmitter<ElementRef<SVGSVGElement>>();

  @Output() marqueeMoved = new EventEmitter<Marquee>();
  @Output() marqueeSelected = new EventEmitter<Marquee>();
  @Output() fragmentChanged = new EventEmitter<Fragment>();

  @ViewChild('svgRef', { static: true }) svgRef!: ElementRef<SVGSVGElement>;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private rpcService: RpcService,
    private alertService: AlertService,
    private configService: ConfigService,
    private liveObjectService: LiveObjectService,
    private liveObjectListService: LiveObjectListService
  ) { };

  private destroy$ = new Subject<void>();
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  resizeEdge?: { left: boolean; right: boolean; top: boolean; bottom: boolean; };
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

  ngOnInit(): void {
    this.svgRefReady.emit(this.svgRef);

    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const diaryId = Number(this.route.snapshot.paramMap.get('diaryId'));
        const pageId = Number(this.route.snapshot.paramMap.get('pageId'));

        const fragmentParam = this.route.snapshot.paramMap.get('fragmentId');
        const fragmentId = fragmentParam !== null ? Number(fragmentParam) : null;
        const hasValidFragmentId = fragmentId !== null && !isNaN(fragmentId);

        const config$ = from(this.configService.getConfig());
        const diary$ = this.liveObjectService.getDiaryById$(diaryId);
        const page$ = this.liveObjectService.getPageById$(diaryId, pageId);
        const pages$ = this.liveObjectListService.getPagesForDiary$(diaryId);
        const marquees$ = this.liveObjectListService.getMarqueesForPage$(diaryId, pageId);

        if (hasValidFragmentId) {

          const fragment$ = this.liveObjectService.getFragmentById$(fragmentId);
          combineLatest([config$, diary$, page$, pages$, fragment$, marquees$])
            .pipe(takeUntil(this.destroy$))
            .subscribe(([config, diary, page, pages, fragment, marquees]) => {

              this.mode = ViewMode.WithFragment;
              this.width = page.width;
              this.height = page.height;
              this.diary = diary;
              this.page = page;
              this.pages = pages;
              this.marquees = marquees;
              this.imageUrl = `${config.fileServerUrl}/${diary.name}/${page.name}${page.extension}`;

              const title = `${diary.name} - ${page.name} - ${fragmentId}`;
              this.titleChanged.emit(title);

              this.originalRectangle = { ...fragment.marquee.rectangle };
              const text = `marquee\n${JSON.stringify(fragment.marquee, null, 2)}\n\n` +
                `page\n${JSON.stringify(page, null, 2)}\n\n` +
                `config\n${JSON.stringify(config, null, 2)}\n\n` +
                `viewport size: width: ${window.innerWidth}, height ${window.innerHeight}`
                ;

              this.fragment = fragment;
              this.fragment.text = text;
              this.updateOtherMarquees();
              this.fragmentChanged.emit(fragment);
            });
        } else {

          combineLatest([config$, diary$, page$, pages$, marquees$])
            .pipe(takeUntil(this.destroy$))
            .subscribe(([config, diary, page, pages, marquees]) => {

              this.width = page.width;
              this.height = page.height;
              this.diary = diary;
              this.page = page;
              this.pages = pages;
              this.marquees = marquees;
              this.imageUrl = `${config.fileServerUrl}/${diary.name}/${page.name}${page.extension}`;

              const title = `${diary.name} - ${page.name}`;
              this.titleChanged.emit(title);

              this.fragment = undefined as any;
              this.originalRectangle = undefined as any;
              this.updateOtherMarquees();

              console.log('otherMarquees:');
              this.otherMarquees.forEach((m, index) => {
                console.log(`  [${index}] ${JSON.stringify(m)}`);
              });
            });
        }
      });
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
    if (this.mode !== ViewMode.WithFragment || !this.fragment || !this.svgRef) return;

    const mousePosition = this.getMousePosition(event);

    const isCtrlKeyDown = event.ctrlKey;
    if (isCtrlKeyDown) {
      this.resizeEdge = this.detectResizeEdge(mousePosition);

      this.dragStart = mousePosition;
      this.originalRectangle = { ...this.fragment.marquee.rectangle };

      if (Object.values(this.resizeEdge).every(v => v === false)) {
        // Ctrl + click inside marquee = move marquee
        this.isDraggingMarquee = true;
        this.dragStart = mousePosition;
        const r = this.fragment.marquee.rectangle;
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
    if (this.mode !== ViewMode.WithFragment || !this.fragment || !this.svgRef) return;

    const isCtrlKeyDown = event.ctrlKey;
    let mousePosition = this.getMousePosition(event);
    this.calculateCursorStyle(mousePosition, isCtrlKeyDown)
    if (!this.dragStart) return;

    const dx = mousePosition.x - this.dragStart.x;
    const dy = mousePosition.y - this.dragStart.y;

    const r = this.fragment.marquee.rectangle;

    if (this.isDraggingGlobal) {
      this.offsetX += dx;
      this.offsetY += dy;
      this.dragStart = mousePosition;
    }

    if (this.isDraggingMarquee && this.fragment && this.dragStartMarquee) {
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
    if (this.mode !== ViewMode.WithFragment) return;
    if (!this.fragment) return;
    if (this.isResizing() || this.isDragging()) {

      // console.log(`ImageViewerComponent.onMouseUp: updateMarquee: ${JSON.stringify(this.fragment.marquee)}`);

      this.rpcService.updateMarquee$(this.fragment.marquee).subscribe({
        next: () => {
          // console.log(`ImageViewerComponent.onMouseUp: update succeeded`);
        },
        error: (err) => {
          console.log(`ImageViewerComponent.onMouseUp: error: ${err}`);
          this.alertService.error(err);
        }
      });
    }

    this.isDraggingGlobal = false;
    this.isDraggingMarquee = false;
    this.resizeEdge = undefined;
    this.dragStart = undefined;
    this.dragStartMarquee = undefined;
    this.originalRectangle = undefined;
  }

  onSelectMarquee(marquee: Marquee) {
    console.log(`ImageViewerComponent.onSelectMarquee: marquee: ${JSON.stringify(marquee)}`);
    this.router.navigate([`/diary/${this.diary.id}/${this.page.id}/${marquee.fragmentId}`]);
  }

  private updateOtherMarquees() {
    if (this.fragment) {
      this.otherMarquees = this.marquees.filter(m => m.id != this.fragment?.id);
    } else {
      this.otherMarquees = this.marquees;
    }
  }

  calculateCursorStyle(mousePosition: DOMPoint, isCtrlKeyDown: boolean) {
    if (this.mode != ViewMode.WithFragment) return;
    if (!this.fragment) return;

    const m = this.fragment.marquee.rectangle;

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
    if (this.mode !== ViewMode.WithFragment) return edges;
    if (!this.fragment) return edges;

    const m = this.fragment.marquee.rectangle;
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
    if (this.mode !== ViewMode.WithFragment) return;
    if (!this.fragment) return;

    if (event.key === 'Delete' && event.ctrlKey) {
      console.log('ImageViewerComponent.onKeyDown: Control + Delete pressed');

      // Find index of current fragment
      const currentIndex = this.marquees.findIndex(m => m.id === this.fragment?.id);

      // Compute next fragment (wrap around or pick previous if at end)
      const nextFragment = (currentIndex >= 0 && currentIndex < this.marquees.length - 1)
        ? this.marquees[currentIndex + 1]
        : (currentIndex > 0 ? this.marquees[currentIndex - 1] : null);

      if (nextFragment) {
        console.log(`Navigating to next fragment: ${nextFragment.id}`);
        this.router.navigate([
          `/diary/${this.diary.id}/${this.page.id}/${nextFragment.id}`
        ]);
      } else {
        console.log('No next fragment to navigate to.');
      }

      console.log(`ImageViewerComponent.onKeyDown: deleting fregment id: ${this.fragment.id}`);
      this.rpcService.deleteMarquee$(this.fragment.id).subscribe({
        next: (id: number) => {
          console.log(`ImageViewerComponent.onKeyDown: delete succeeded: id: ${id}`);
        },
        error: (err) => {
          console.log(`ImageViewerComponent.onKeyDown: delete error: ${err}`);
          this.alertService.error(err);
        }
      });
    }
  }

  onRightClick(e: MouseEvent) {
  }

  onAddButtonClick() {
    console.log(`ImageViewerComponent.onAddButtonClick`);

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

        console.log(`ImageViewerComponent.onAddButtonClick: fragment: id: ${marquee.id} added`);
        this.alertService.info(`fragment: id: ${marquee.id} added`);

        this.router.navigate([`/diary/${this.diary.id}/${this.page.id}/${marquee.id}`]);
      },
      error: (err) => {
        console.log(`ImageViewerComponent.onAddButtonClick: error: ${err}`)
        this.alertService.error(err);
      }
    });
  }
}
