import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FullheaderComponent } from "../headers/fullheader/fullheader.component";
import { FullfooterComponent } from "../headers/fullfooter/fullfooter.component";
import { AlertsComponent } from "../alerts/alerts.component";
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Diary } from '../diary/diary';
import { Page } from './page';
import { ActivatedRoute } from '@angular/router';
import { DiaryService } from '../diary/diary.service';
import { AlertService } from '../alerts/alert.service';
import { ConfigService } from '../config/config.service';


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
export class PageComponent implements OnInit {

  @Input() title?: string;
  diary: Diary = new Diary();
  page: Page = new Page();
  viewBox = '0 0 800 600'; // default value
  fileServerUrl: string = "";

  constructor(
    private route: ActivatedRoute,
    private diaryService: DiaryService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private configService: ConfigService
  ) { }

  ngOnInit(): void {
    console.log(`pageComponent.ngOnInit`);

    this.configService.getConfig()
      .then((config) => {
        console.log(`pageComponent.ngOnInit: config: ${JSON.stringify(config)}`);
        this.fileServerUrl = config.fileServerUrl;

        const diaryId = Number(this.route.snapshot.paramMap.get('diaryId'));
        const pageId = Number(this.route.snapshot.paramMap.get('pageId'));

        this.diaryService.getDiary(diaryId).subscribe({
          next: (value: unknown) => {
            // console.log(`pageComponent.ngOnInit: JSON.stringify(value): ${JSON.stringify(value)}`);
            console.log(`pageComponent.ngOnInit: got diary and its pages`);

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
            }

            console.log(`pageComponent.ngOnInit: diary: ${this.diary.name}: page: ${this.page.name}`);

            this.viewBox = `0 0 ${this.page.width} ${this.page.height}`;
            this.setupZoomPan();
            this.cdr.detectChanges();
          },
          error: err => {
            console.error(`PageComponent.ngOnInit: error: ${err}`);
            this.alertService.error(err);
          },
          complete: () => console.log('PageComponent.ngOnInit: complete')
        });
      })
      .catch((error) => {
        console.error(`MqttService.getConnection: configuration error: ${error}`);
      });
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
