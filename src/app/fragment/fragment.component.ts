// fragment.component.ts
import { ChangeDetectorRef, Component, HostListener, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConfigService } from '../config/config.service';
import { LiveObjectService } from '../mqtt/live.object.service';
import { Rectangle } from '../utilities/rectangle';
import { Marquee } from '../model/marquee';
import { FullheaderComponent } from '../headers/fullheader/fullheader.component';
import { FullfooterComponent } from '../headers/fullfooter/fullfooter.component';
import { CommonModule } from '@angular/common';

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
  svg!: HTMLElement | SVGSVGElement;
  lastMouseX = 0;
  lastMouseY = 0;
  isDragging = false;


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

    this.configService.getConfig().then((config) => {
      this.liveObjectService.getDiaryById$(diaryId).subscribe(diary => {
        this.liveObjectService.getPageById$(diaryId, pageId).subscribe(page => {
          this.liveObjectService.getMarqueeById$(diaryId, pageId, fragmentId).subscribe(marquee => {
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

            // const r = marquee.rectangle;
            const r = new Rectangle(0, 0, page.width, page.height);
            this.viewBox = new Rectangle(r.x - 50, r.y - 50, r.width + 100, r.height + 100);

            // Ensure the view is updated before accessing svgRef
            this.cdr.detectChanges();

            if (this.svgRef) {
              const rect = this.svgRef.nativeElement.getBoundingClientRect();
              console.log(`SVG Size - this.svgRef.nativeElement (after view update): width = ${rect.width}, height = ${rect.height}`);
            }
          });
        });
      });
    });
  }

  viewBoxString(): string {
    return `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`;
  }

  getMouseSvgCoords(event: MouseEvent): { x: number; y: number } {

    const rect = this.svgRef.nativeElement.getBoundingClientRect();
    // const rect = this.svg.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (this.viewBox.width / rect.width) + this.viewBox.x;
    const y = (event.clientY - rect.top) * (this.viewBox.height / rect.height) + this.viewBox.y;
    return { x, y };
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    const { x: svgX, y: svgY } = this.getMouseSvgCoords(event);
    const scaleFactor = event.deltaY < 0 ? 0.9 : 1.1;

    this.viewBox.x = svgX - (svgX - this.viewBox.x) * scaleFactor;
    this.viewBox.y = svgY - (svgY - this.viewBox.y) * scaleFactor;
    this.viewBox.width *= scaleFactor;
    this.viewBox.height *= scaleFactor;
  }

  onMouseDown(event: MouseEvent) {
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.isDragging = true;
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;
    const dx = (event.clientX - this.lastMouseX) * (this.viewBox.width / this.svg.clientWidth);
    const dy = (event.clientY - this.lastMouseY) * (this.viewBox.height / this.svg.clientHeight);
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
