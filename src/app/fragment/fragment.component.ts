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

  @ViewChild('svgRef') svgRef!: ElementRef<SVGSVGElement>;

  title = 'Fragment';

  windowWidth = window.innerWidth;
  windowHeight = window.innerHeight;

  fragment!: { marquee: Marquee; text: string };
  viewBox = new Rectangle(0, 0, 1000, 1000);
  imageUrl = '';
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  lastMouseX = 0;
  lastMouseY = 0;
  isDragging = false;

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

      const margin = 50;
      // const r = marquee.rectangle;
      const r = new Rectangle(0, 0, page.width, page.height);
      this.viewBox = new Rectangle(r.x - margin, r.y - margin, r.width + 2 * margin, r.height + 2 * margin);

      // Ensure the view is updated before accessing svgRef
      this.cdr.detectChanges();

      if (this.svgRef) {
        const rect = this.svgRef.nativeElement.getBoundingClientRect();
        console.log(`SVG Size - this.svgRef.nativeElement (after view update): width = ${rect.width}, height = ${rect.height}`);
      }
    });
  }

  viewBoxString(): string {
    return `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`;
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    const scaleFactor = event.deltaY < 0 ? 0.9 : 1.1;

    // Center point to zoom on
    const rect = this.svgRef.nativeElement.getBoundingClientRect();
    const svgX = (event.clientX - rect.left) * (this.viewBox.width / rect.width) + this.viewBox.x;
    const svgY = (event.clientY - rect.top) * (this.viewBox.height / rect.height) + this.viewBox.y;

    // Zoom logic
    this.viewBox.x = svgX - (svgX - this.viewBox.x) * scaleFactor;
    this.viewBox.y = svgY - (svgY - this.viewBox.y) * scaleFactor;
    this.viewBox.width *= scaleFactor;
    this.viewBox.height *= scaleFactor;

    console.log(`Zoom level:     ${this.viewBox.width.toFixed(2)} x ${this.viewBox.height.toFixed(2)}`);
    console.log(`SVG pixel size: ${rect.width.toFixed(2)} x ${rect.height.toFixed(2)}`);
  }

  onMouseDown(event: MouseEvent) {
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.isDragging = true;
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;

    const rect = this.svgRef.nativeElement.getBoundingClientRect();

    const dx = (event.clientX - this.lastMouseX) * (this.viewBox.width / rect.width);
    const dy = (event.clientY - this.lastMouseY) * (this.viewBox.height / rect.height);
    this.viewBox.x -= dx;
    this.viewBox.y -= dy;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  }

  onMouseUp() {
    this.isDragging = false;
  }

  onRightClick(e: MouseEvent) {
  }
}
