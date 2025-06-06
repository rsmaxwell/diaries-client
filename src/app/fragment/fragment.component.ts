// fragment.component.ts
import { ChangeDetectorRef, Component, HostListener, ElementRef, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Config, ConfigService } from '../config/config.service';
import { LiveObjectService } from '../mqtt/live.object.service';
import { Rectangle } from '../utilities/rectangle';
import { Marquee } from '../model/marquee';
import { CommonModule } from '@angular/common';
import { combineLatest, from, Observable, Subject, Subscription, takeUntil } from 'rxjs';
import { Diary } from '../model/diary';
import { Page } from '../model/page';
import { Point } from '../utilities/point';
import { PageheaderComponent } from '../headers/pageheader/pageheader.component';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { LiveObjectListService } from '../mqtt/live.object.list.service';
import { Fragment } from '../model/fragment';
import { RpcService } from '../mqtt/rpc.service';
import { AlertService } from '../alerts/alert.service';

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
export class FragmentComponent implements OnInit, OnDestroy {

  @ViewChild('svgContainerRef') svgContainerRef!: ElementRef<SVGSVGElement>;
  @ViewChild('svgRef') svgRef!: ElementRef<SVGSVGElement>;

  title = 'Fragment';

  private destroy$ = new Subject<void>();

  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;

  diary: Diary = Diary.default;
  page: Page = Page.default;
  fragment!: Fragment;
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
  pages: Page[] = [];
  marquees: Marquee[] = [];
  otherMarquees: Marquee[] = [];

  config$: Observable<Config> | null = null;
  diary$: Observable<Diary> | null = null;
  page$: Observable<Page> | null = null;
  pages$: Observable<Page[]> | null = null;
  fragment$: Observable<Fragment> | null = null;
  marquees$: Observable<Marquee[]> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private rpcService: RpcService,
    private alertService: AlertService,
    private configService: ConfigService,
    private liveObjectService: LiveObjectService,
    private liveObjectListService: LiveObjectListService,
    private cdr: ChangeDetectorRef
  ) { }

  @HostListener('window:resize', ['$event'])
  onResize(event: UIEvent) {
    this.windowWidth = window.innerWidth;
    this.windowHeight = window.innerHeight;
    console.log(`Window resized: ${this.windowWidth} x ${this.windowHeight}`);
  }

  ngOnInit() {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
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
          this.pages$ = this.liveObjectListService.getPagesForDiary$(diaryId),
          this.fragment$ = this.liveObjectService.getFragmentById$(diaryId, pageId, fragmentId),
          this.marquees$ = this.liveObjectListService.getMarqueesForPage$(diaryId, pageId),
        ])
          .pipe(takeUntil(this.destroy$))
          .subscribe(([config, diary, page, pages, fragment, marquees]) => {

            const marquee = fragment.toMarquee();

            const text = `marquee\n${JSON.stringify(marquee, null, 2)}\n\n` +
              `page\n${JSON.stringify(page, null, 2)}\n\n` +
              `config\n${JSON.stringify(config, null, 2)}\n\n` +
              `viewport size: width: ${width}, height ${height}`
            ;

            this.fragment = fragment;
            this.fragment.text = text;

            this.width = page.width;
            this.height = page.height;
            this.diary = diary;
            this.page = page;
            this.pages = pages;
            this.marquees = marquees;
            this.updateOtherMarquees();
            this.imageUrl = `${config.fileServerUrl}/${diary.name}/${page.name}${page.extension}`;
            this.originalRectangle = { ...this.fragment.rectangle };
            this.title = `${diary.name} - ${page.name} - ${fragmentId}`;
          });
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

    if (isCtrlKeyDown && this.fragment) {
      this.resizeEdge = this.detectResizeEdge(mousePosition);

      this.dragStart = mousePosition;
      this.originalRectangle = { ...this.fragment.rectangle };

      if (Object.values(this.resizeEdge).every(v => v === false)) {
        // Ctrl + click inside marquee = move marquee
        this.isDraggingMarquee = true;
        this.dragStart = mousePosition;
        const r = this.fragment.rectangle;
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

  onKeyDown(event: KeyboardEvent) {
    console.log(`FragmentComponent.onKeyDown: key: ${event.key}`);

    if (event.key === 'Delete' && event.ctrlKey) {
      console.log('FragmentComponent.onKeyDown: Control + Delete was pressed');

      // Find index of current fragment
      const currentIndex = this.marquees.findIndex(m => m.id === this.fragment.id);

      // Compute next fragment (wrap around or pick previous if at end)
      const nextFragment = (currentIndex >= 0 && currentIndex < this.marquees.length - 1)
        ? this.marquees[currentIndex + 1]
        : (currentIndex > 0 ? this.marquees[currentIndex - 1] : null);

      this.rpcService.deleteMarquee$(this.fragment.id).subscribe({
        next: () => {
          console.log(`FragmentComponent.onKeyDown: delete succeeded`);

          if (nextFragment) {
            console.log(`Navigating to next fragment: ${nextFragment.id}`);
            this.router.navigate([
              `/diary/${this.diary.id}/${this.page.id}/${nextFragment.id}`
            ]);
          } else {
            console.log('No next fragment to navigate to.');
          }
        },
        error: (err) => {
          console.log(`FragmentComponent.onKeyDown: delete error: ${err}`);
          this.alertService.error(err);
        }
      });
    }
  }

  onMouseMove(event: MouseEvent) {
    const isCtrlKeyDown = event.ctrlKey;
    let mousePosition = this.getMousePosition(event);
    this.calculateCursorStyle(mousePosition, isCtrlKeyDown)
    if (!this.dragStart) return;

    const dx = mousePosition.x - this.dragStart.x;
    const dy = mousePosition.y - this.dragStart.y;

    const r = this.fragment.rectangle;

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

    if (this.isResizeActive()) {
      this.rpcService.updateMarquee$(this.fragment.toMarquee()).subscribe({
        next: () => {
          console.log(`FragmentComponent.onMouseUp: update succeeded`);
        },
        error: (err) => {
          console.log(`FragmentComponent.onMouseUp: error: ${err}`);
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

  onRightClick(e: MouseEvent) {
  }

  calculateCursorStyle(mousePosition: DOMPoint, isCtrlKeyDown: boolean) {

    const m = this.fragment.rectangle;

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
    const m = this.fragment.rectangle;
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

  onBackPressed() {
    console.log(`FragmentComponent.onBackPressed`);
    if (!this.pages || this.pages.length === 0) return;

    const currentIndex = this.pages.findIndex(p => p.id === this.page.id);

    if (currentIndex > 0) {
      const prevPage = this.pages[currentIndex - 1];
      console.log(`Navigating to previous page: ${prevPage.id}`);

      this.router.navigate([`/diary/${this.diary.id}/${prevPage.id}`]);
    } else {
      console.log('Already at the first page or current page not found.');
    }
  }

  onUpPressed() {
    console.log('FragmentComponent: Up pressed');
  }

  onForwardPressed() {
    console.log('FragmentComponent: Forward pressed');
    if (!this.pages || this.pages.length === 0) return;

    const currentIndex = this.pages.findIndex(p => p.id === this.page.id);

    if (currentIndex >= 0 && currentIndex < this.pages.length - 1) {
      const nextPage = this.pages[currentIndex + 1];
      console.log(`Navigating to next page: ${nextPage.id}`);
      this.router.navigate([`/diary/${this.diary.id}/${nextPage.id}`]);
    } else {
      console.log('Already at the last page or current page not found.');
    }
  }

  onMarqueeRightClick($event: MouseEvent, marquee: Marquee) {
    console.log(`FragmentComponent.onMarqueeRightClick: marquee: ${marquee}`);
  }
  onSelectMarquee(marquee: Marquee) {
    console.log(`FragmentComponent.onSelectMarquee: marquee: ${marquee}`);
  }

  private updateOtherMarquees() {
    if (this.marquees && this.fragment) {
      this.otherMarquees = this.marquees.filter(m => m.id !== this.fragment.id);
    } else {
      this.otherMarquees = [];
    }
  }
}
