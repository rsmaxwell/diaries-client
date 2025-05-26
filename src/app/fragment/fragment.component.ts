// fragment.component.ts
import { ChangeDetectorRef, Component, HostListener, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Config, ConfigService } from '../config/config.service';
import { LiveObjectService } from '../mqtt/live.object.service';
import { Rectangle } from '../utilities/rectangle';
import { Marquee } from '../model/marquee';
import { FullheaderComponent } from '../headers/fullheader/fullheader.component';
import { FullfooterComponent } from '../headers/fullfooter/fullfooter.component';
import { CommonModule } from '@angular/common';
import { combineLatest, from, Observable } from 'rxjs';
import { Diary } from '../model/diary';
import { Page } from '../model/page';
import { Point } from '../utilities/point';

@Component({
  selector: 'app-fragment',
  standalone: true,
  imports: [
    CommonModule,
    FullheaderComponent,
    FullfooterComponent
  ],
  templateUrl: './fragment.component.html',
  styleUrls: ['./fragment.component.scss']
})
export class FragmentComponent implements OnInit {

  @ViewChild('svgContainerRef') svgContainerRef!: ElementRef<SVGSVGElement>;
  @ViewChild('svgRef') svgRef!: ElementRef<SVGSVGElement>;

  title = 'Fragment';

  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;

  fragment!: { marquee: Marquee; text: string };
  imageUrl = '';
  width = 0;
  height = 0;
  scale = 1;
  offsetX = 0;
  offsetY = 0;
  cursorStyle = '';
  isDraggingGlobal = false;
  isDraggingMarquee = false;
  dragStart?: DOMPoint;
  dragStartMarquee?: Point;
  originalRectangle?: Rectangle;
  resizeEdge?: { left: boolean; right: boolean; top: boolean; bottom: boolean; };

  config$: Observable<Config> | null = null;
  diary$: Observable<Diary> | null = null;
  page$: Observable<Page> | null = null;
  marquee$: Observable<Marquee> | null = null;

  constructor(
    private route: ActivatedRoute,
    private configService: ConfigService,
    private liveObjectService: LiveObjectService,
    private cdr: ChangeDetectorRef
  ) { }

  @HostListener('window:resize', ['$event'])
  onResize(event: UIEvent) {
    this.windowWidth = window.innerWidth;
    this.windowHeight = window.innerHeight;
    console.log(`Window resized: ${this.windowWidth} x ${this.windowHeight}`);
  }

  ngOnInit() {
    const diaryId = Number(this.route.snapshot.paramMap.get('diaryId'));
    const pageId = Number(this.route.snapshot.paramMap.get('pageId'));
    const fragmentId = Number(this.route.snapshot.paramMap.get('fragmentId'));

    const width = window.innerWidth;
    const height = window.innerHeight;
    console.log(`Viewport size: ${width} x ${height}`);

    combineLatest([
      this.config$ = from(this.configService.getConfig()),
      this.diary$ = this.liveObjectService.getDiaryById$(diaryId),
      this.page$ = this.liveObjectService.getPageById$(diaryId, pageId),
      this.marquee$ = this.liveObjectService.getMarqueeById$(diaryId, pageId, fragmentId)

    ]).subscribe(([config, diary, page, marquee]) => {
      this.fragment = {
        marquee,
        text: `marquee\n${JSON.stringify(marquee, null, 2)}\n\n` +
          `page\n${JSON.stringify(page, null, 2)}\n\n` +
          `config\n${JSON.stringify(config, null, 2)}\n\n` +
          `viewport size: width: ${width}, height ${height}`
      };
      this.width = page.width;
      this.height = page.height;
      this.imageUrl = `${config.fileServerUrl}/${diary.name}/${page.name}${page.extension}`;
      this.originalRectangle = { ...this.fragment.marquee.rectangle }; // shallow copy

      this.title = `${diary.name} - ${page.name}`;

      // Ensure the view is updated before accessing svgRef
      this.cdr.detectChanges();

      if (this.svgRef) {
        const rect = this.svgRef.nativeElement.getBoundingClientRect();
        console.log(`SVG rect: {x:${rect.x}, y:${rect.y}, width:${rect.width}, height:${rect.height}}`);
      }
    });
  }

  get transformStyle(): string {
    return `translate(${this.offsetX}, ${this.offsetY}) scale(${this.scale})`;
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
    const mousePosition = this.getMousePosition(event);
    const isCtrlKeyDown = event.ctrlKey;

    if (isCtrlKeyDown && this.fragment?.marquee) {
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

    if (this.isDraggingMarquee && this.fragment?.marquee && this.dragStartMarquee) {
      const dxSvg = dx / this.scale;
      const dySvg = dy / this.scale;
    
      r.x = this.dragStartMarquee.x + dxSvg;
      r.y = this.dragStartMarquee.y + dySvg;
    }

    if (isCtrlKeyDown && this.isResizeActive() && this.originalRectangle) {
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

  private isResizeActive(): boolean {
    const e = this.resizeEdge;
    return !!e && (e.left || e.right || e.top || e.bottom);
  }

  onMouseUp() {
    this.isDraggingGlobal = false;
    this.isDraggingMarquee = false;
    this.resizeEdge = undefined;
    this.dragStart = undefined;
    this.dragStartMarquee = undefined;
    this.originalRectangle = undefined;
  }

  onRightClick(e: MouseEvent) {
  }

  calculateCursorStyle(mousePosition: DOMPoint, isCtrlKeyDown: boolean) {

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

    const edges = { left: false, right: false, top: false, bottom: false };

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
}