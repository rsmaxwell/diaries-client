import { ChangeDetectorRef, AfterViewInit, Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FullheaderComponent } from "../headers/fullheader/fullheader.component";
import { FullfooterComponent } from "../headers/fullfooter/fullfooter.component";
import { AlertsComponent } from "../alerts/alerts.component";
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Diary, DiaryResponse } from '../diary/diary';
import { Page } from './page';
import { ActivatedRoute } from '@angular/router';
import { DiaryService } from '../diary/diary.service';
import { AlertService } from '../alerts/alert.service';


@Component({
  selector: 'app-pages',
  standalone: true,
  imports: [
    CommonModule,
    FullheaderComponent,
    FullfooterComponent,
    AlertsComponent,
    MatSlideToggleModule,
  ],
  templateUrl: './page.component.html',
  styleUrl: './page.component.scss'
})
export class PageComponent implements OnInit, AfterViewInit {

  @Input() title?: string;
  diary: Diary = new Diary();
  page: Page = new Page();
  viewBox = '0 0 800 600'; // default value

  constructor(
    private route: ActivatedRoute,
    private diaryService: DiaryService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    console.log(`pageComponent.ngOnInit`);

    const diaryId = Number(this.route.snapshot.paramMap.get('diaryId'));
    const pageId = Number(this.route.snapshot.paramMap.get('pageId'));

    this.diaryService.getDiary(diaryId).subscribe({
      next: (value: unknown) => {
        console.log(`pageComponent.ngOnInit: JSON.stringify(value): ${JSON.stringify(value)}`);

        if (
          typeof value === 'object' &&
          value !== null &&
          'diary' in value &&
          'pages' in value &&
          Array.isArray((value as any).pages)
        ) {
          const response = value as {
            diary: { id: number; name: string };
            pages: Page[];
          };

          this.diary = response.diary;

          const found = response.pages.find(p => p.id === pageId);
          if (found) {
            this.page = found;
          } else {
            console.error('Page not found in diary.pages');
          }

          const svg = this.generateSvg(this.page);
          console.log(`pageComponent.ngOnInit: page.svg:`);
          console.log(`${svg}`);
        }
      },
      error: err => {
        console.error(`PageComponent.ngOnInit: error: ${err}`);
        this.alertService.error(err);
      },
      complete: () => console.log('PageComponent.ngOnInit: complete')
    });
  }

  ngAfterViewInit(): void {
    console.log(`pageComponent.ngAfterViewInit: JSON.stringify(this.page): ${JSON.stringify(this.page)}`);
    if (this.page) {
      this.viewBox = `0 0 ${this.page.width} ${this.page.height}`;
      this.setupZoomPan();
      this.cdr.detectChanges();
    }
  }



  generateSvg(page: Page): string {
    if (!this.diary || !page) {
      return '';
    }

    const width = page.width || 800;
    const height = page.height || 600;

    const imageUrl = `http://localhost:8081/images/${this.diary.name}/${page.name}${page.extension}`;

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <image href="${imageUrl}" x="0" y="0" height="${height}px" width="${width}px"/>
</svg>
    `.trim();

    return svg;
  }


  setupZoomPan(): void {

    const svgEl = document.getElementById('zoomable-svg');

    if (!(svgEl instanceof SVGSVGElement)) {
      console.error('zoomable-svg is not an SVG element');
      return;
    }

    const svg = svgEl; // svg is now safely typed as SVGSVGElement

    let viewBox = {
      x: 0,
      y: 0,
      w: this.page?.width ?? 800,
      h: this.page?.height ?? 600
    };

    let isPanning = false;
    let start = { x: 0, y: 0 };

    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = 1.1;
      const direction = e.deltaY < 0 ? 1 / zoomFactor : zoomFactor;

      const newW = viewBox.w * direction;
      const newH = viewBox.h * direction;
      const dx = (e.offsetX / svg.clientWidth) * (viewBox.w - newW);
      const dy = (e.offsetY / svg.clientHeight) * (viewBox.h - newH);

      viewBox = {
        x: viewBox.x + dx,
        y: viewBox.y + dy,
        w: newW,
        h: newH
      };

      this.viewBox = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;
    });

    svg.addEventListener('mousedown', (e) => {
      isPanning = true;
      start = { x: e.clientX, y: e.clientY };
    });

    svg.addEventListener('mousemove', (e) => {
      if (!isPanning) return;

      const dx = (e.clientX - start.x) * (viewBox.w / svg.clientWidth);
      const dy = (e.clientY - start.y) * (viewBox.h / svg.clientHeight);

      viewBox.x -= dx;
      viewBox.y -= dy;

      this.viewBox = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;
      start = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      isPanning = false;
    });
  }
}
