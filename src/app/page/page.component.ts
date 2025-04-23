import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageheaderComponent } from "../headers/pageheader/pageheader.component";
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Diary } from '../diary/diary';
import { Page } from './page';
import { ViewModeHandler } from './modehandlers/viewModeHandler';
import { SelectModeHandler } from './modehandlers/selectModehandler';
import { AddModeHandler } from './modehandlers/addModehandler';
import { ActivatedRoute } from '@angular/router';
import { DiaryService } from '../diary/diary.service';
import { AlertService } from '../alerts/alert.service';
import { ConfigService } from '../config/config.service';
import { BehaviorSubject } from 'rxjs';
import { PageModeHandler } from './modehandlers/pageModeHandler';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { Fragment } from '../model/fragment/fragment';

type Mode = 'view' | 'select' | 'add';

@Component({
  selector: 'app-pages',
  standalone: true,
  imports: [
    CommonModule,
    PageheaderComponent,
    PagefooterComponent,
    MatSlideToggleModule
  ],
  templateUrl: './page.component.html',
  styleUrl: './page.component.scss'
})
export class PageComponent implements OnInit {

  title$ = new BehaviorSubject<string>('Loading...');

  diary: Diary = new Diary();
  page: Page = new Page();
  viewBox = '0 0 800 600'; // default value
  fileServerUrl: string = "";
  mode: 'select' | 'add' | 'view' = 'view';
  currentFragment: Fragment | null = null;
  fragments: Fragment[] = [];

  handlers!: Record<Mode, PageModeHandler>;

  currentHandler!: PageModeHandler;

  getCurrentHandler(): PageModeHandler {
    return this.handlers[this.mode];
  }

  onClick(event: MouseEvent) {
    this.currentHandler.onClick(event);
  }

  onMouseMove(event: MouseEvent) {
    this.currentHandler.onMouseMove(event);
  }

  onMouseDown(event: MouseEvent) {
    this.currentHandler.onMouseDown(event);
  }

  onWheel(event: WheelEvent) {
    this.currentHandler.onWheel(event);
  }

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

              console.log(`pageComponent.ngOnInit: updating the title`);
              this.title$.next(`${this.diary.name} - ${this.page.name}`);
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

  onAddClick(): void {
    console.log('PageComponent.onAddClick')
    this.mode = "add";
  }

  onViewClick(): void {
    console.log('PageComponent.onViewClick')
    this.mode = "view";
  }

  onSelectClick(): void {
    console.log('PageComponent.onSelectClick')
    this.mode = "select";
  }

  setupZoomPan(): void {

    const svgEl = document.getElementById('zoomable-svg');

    if (!(svgEl instanceof SVGSVGElement)) {
      console.error('zoomable-svg is not an SVG element');
      return;
    }

    const svg = svgEl; // svg is now safely typed as SVGSVGElement

    this.handlers = {
      view: new ViewModeHandler(svg, 0, 0, this.page.width, this.page.height),
      select: new SelectModeHandler(svg),
      add: new AddModeHandler(svg)
    };

    this.currentHandler = this.handlers['view'];
    this.viewBox = this.currentHandler.getViewBox();

    svg.addEventListener('wheel', (e) => {
      let handler = this.handlers[this.mode];
      handler.onWheel(e);
      if (handler.hasViewBox()) {
        this.viewBox = handler.getViewBox();
      }
    });

    svg.addEventListener('mousedown', (e) => {
      let handler = this.handlers[this.mode];
      handler.onMouseDown(e);
    });

    svg.addEventListener('mousemove', (e) => {
      let handler = this.handlers[this.mode];
      handler.onMouseMove(e);
      if (handler.hasViewBox()) {
        this.viewBox = handler.getViewBox();
      }
      if (handler.hasRectangleInProgress()) {
        // console.log('PageComponent.mousemove: rectangleInProgress');
        const r = handler.getRectangle();
        const n = this.fragments.length + 1;
        const id = "rect" + n.toString();
        const style = "fill:none;fill-opacity:1;stroke:#ff0000;stroke-width:10;stroke-dasharray:10, 10;stroke-dashoffset:0;stroke-opacity:1;paint-order:stroke fill markers";
        this.currentFragment = new Fragment(id, r.x, r.y, r.width, r.height, style);
      }
    });

    window.addEventListener('mouseup', (e) => {
      let handler = this.handlers[this.mode];
      handler.onMouseUp(e);
      if (handler.hasRectangleComplete()) {
        const r = handler.getRectangle();
        const n = this.fragments.length + 1;
        const id = "rect" + n.toString();
        const style = "fill:none;fill-opacity:1;stroke:#000000;stroke-width:10;stroke-dasharray:10, 10;stroke-dashoffset:0;stroke-opacity:1;paint-order:stroke fill markers";
        const fragment = new Fragment(id, r.x, r.y, r.width, r.height, style);
        this.fragments.push(fragment);

        this.currentFragment = null;
      }
    });
  }
}
