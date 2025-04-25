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
import { Rectangle } from '../utilities/rectangle';
import { NgZone } from '@angular/core';

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
  public viewBox = '0 0 800 600'; // default value
  fileServerUrl: string = "";
  mode: 'select' | 'add' | 'view' = 'view';
  selectedFragment: Fragment | null = null;
  currentFragment: Fragment | null = null;
  fragments: Fragment[] = [];

  handlers!: Record<Mode, PageModeHandler>;

  onClick(event: MouseEvent) {
    console.log(`PageComponent.onClick: mode: ${this.mode}`)
    let handler = this.handlers[this.mode];
    handler.onClick(event);
  }

  onMouseMove(event: MouseEvent) {
    console.log(`PageComponent.onMouseMove: mode: ${this.mode}`)
    let handler = this.handlers[this.mode];
    handler.onMouseMove(event);
  }

  onMouseDown(event: MouseEvent) {
    console.log(`PageComponent.onMouseDown: mode: ${this.mode}`)
    let handler = this.handlers[this.mode];
    handler.onMouseDown(event);
  }

  onWheel(event: WheelEvent) {
    console.log(`PageComponent.onWheel: mode: ${this.mode}`)
    let handler = this.handlers[this.mode];
    handler.onWheel(event);
  }

  constructor(
    private route: ActivatedRoute,
    private diaryService: DiaryService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private configService: ConfigService,
    private ngZone: NgZone
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
            console.log(`PageComponent.ngOnInit: getDiary.next: viewBox: ${this.viewBox}`);

            this.setupZoomPan();

            console.log('Set viewBox to:', this.viewBox);
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
      view: new ViewModeHandler(this, svg),
      select: new SelectModeHandler(this, svg),
      add: new AddModeHandler(this, svg)
    };

    svg.addEventListener('wheel', (e) => {
      console.log(`PageComponent.addEventListener - wheel`)
      let handler = this.handlers[this.mode];
      handler.onWheel(e);
    });

    svg.addEventListener('mousedown', (e) => {
      console.log(`PageComponent.addEventListener - mousedown`)
      let handler = this.handlers[this.mode];
      handler.onMouseDown(e);
    });

    svg.addEventListener('mousemove', (e) => {
      console.log(`PageComponent.addEventListener - mousemove`)
      let handler = this.handlers[this.mode];
      handler.onMouseMove(e);
    });

    window.addEventListener('mouseup', (e) => {
      console.log(`PageComponent.addEventListener - mouseup`)
      let handler = this.handlers[this.mode];
      handler.onMouseUp(e);
    });
  }

  onSelectFragment(fragment: Fragment) {
    console.log(`PageComponent.onSelectFragment: mode: ${this.mode}`)
    let handler = this.handlers[this.mode];
    handler.onSelectFragment(fragment);
  }

  onKeyDown(e: KeyboardEvent) {
    console.log(`PageComponent.onKeyDown: mode: ${this.mode}`)
    let handler = this.handlers[this.mode];
    handler.onKeyDown(e);
  }

  cancelSelection() {
    this.selectedFragment = null;
  }
  setViewBox(viewBox: string) {
    this.viewBox = viewBox;
  }
  setSelection(fragment: Fragment) {
    this.selectedFragment = fragment;
  }
  resizeSelectedFragment(fragment: Fragment) {
    this.selectedFragment = fragment;
  }
  updateCurrentFragment(rectangle: Rectangle) {
    this.currentFragment = new Fragment("currentFragment", rectangle);
  }
  addNewFragment(rectangle: Rectangle) {
    const n = this.fragments.length + 1;
    const id = "rect" + n.toString();
    const fragment = new Fragment(id, rectangle);
    this.fragments.push(fragment);
  }
  clearCurrentFragment() {
    this.currentFragment = null;
  }
  getViewBox(): string {
    return this.viewBox;
  }
}
