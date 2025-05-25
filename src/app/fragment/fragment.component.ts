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
  lastMouseX = 0;
  lastMouseY = 0;
  isDragging = false;
  scale = 1;
  offsetX = 0;
  offsetY = 0;

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
    const rect = this.svgRef.nativeElement.getBoundingClientRect();
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
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.isDragging = true;
  }

  onMouseMove(event: MouseEvent) {
    // console.log(`FragmentComponent.onMouseMove: ${event.clientX}, ${event.clientY}`);
    if (!this.isDragging) return;

    const dx = (event.clientX - this.lastMouseX) / this.scale;
    const dy = (event.clientY - this.lastMouseY) / this.scale;

    this.offsetX += dx;
    this.offsetY += dy;

    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  }

  onMouseUp() {
    this.isDragging = false;
  }


  onRightClick(e: MouseEvent) {
  }
}
