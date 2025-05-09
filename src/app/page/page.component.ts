import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageheaderComponent } from "../headers/pageheader/pageheader.component";
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Diary } from '../diary/diary';
import { Page } from './page';
import { ViewModeHandler } from './modehandlers/viewModeHandler';
import { SelectModeHandler } from './modehandlers/selectModeHandler';
import { AddModeHandler } from './modehandlers/addModeHandler';
import { ActivatedRoute } from '@angular/router';
import { DiaryService } from '../diary/diary.service';
import { AlertService } from '../alerts/alert.service';
import { ConfigService } from '../config/config.service';
import { BehaviorSubject } from 'rxjs';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { Fragment } from '../model/fragment/fragment';
import { Rectangle } from '../utilities/rectangle';
import { AddFragmentService } from './addFragment.service';
import { UpdateFragmentService } from './updateFragment.service';


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
  viewBox = new Rectangle(0, 0, 0, 0);
  viewBoxAsString = '0 0 0 0';
  fileServerUrl: string = "";
  mode: 'select' | 'add' | 'view' = 'view';
  selectedFragment: Fragment | null = null;
  currentFragment: Fragment | null = null;
  fragments: Fragment[] = [];
  svg: HTMLElement | SVGSVGElement = {} as HTMLElement;
  viewModeHandler = new ViewModeHandler(this);
  fragmentCounter = 0;
  style: string = '';  
  handlers = {
    view: this.viewModeHandler,
    select: new SelectModeHandler(this),
    add: new AddModeHandler(this)
  };


  constructor(
    private route: ActivatedRoute,
    private diaryService: DiaryService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private configService: ConfigService,
    public addFragmentService: AddFragmentService,
    public updateFragmentService: UpdateFragmentService
  ) { }


  ngOnInit(): void {
    console.log(`pageComponent.ngOnInit`);

    const svgEl = document.getElementById('zoomable-svg');
    if (!(svgEl instanceof SVGSVGElement)) {
      console.error('zoomable-svg is not an SVG element');
      return;
    }
    this.svg = svgEl; // svg is now safely typed as SVGSVGElement



    this.configService.getConfig()
      .then((config) => {
        this.fileServerUrl = config.fileServerUrl;

        const diaryId = Number(this.route.snapshot.paramMap.get('diaryId'));
        const pageId = Number(this.route.snapshot.paramMap.get('pageId'));

        this.diaryService.getDiary(diaryId).subscribe({
          next: (value: unknown) => {
            this.connected(diaryId, pageId, value); 
          },
          error: (err: string) => {
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

  connected(diaryId: number, pageId: number, value: unknown) {
    {
      console.log(`pageComponent.ngOnInit.connected: got diary and its pages`);

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

      console.log(`pageComponent.ngOnInit.connected: diary: ${this.diary.name}: page: ${this.page.name}`);
      const rect = new Rectangle(0, 0, this.page.width, this.page.height);
      this.viewModeHandler.setViewBox(rect);
      this.updateViewBox(rect);
      this.cdr.detectChanges();
    }
  }

  onClick(event: MouseEvent) {
    let handler = this.handlers[this.mode];
    handler.onClick(event);
  }
  onMouseMove(event: MouseEvent) {
    let handler = this.handlers[this.mode];
    handler.onMouseMove(event);
  }
  onMouseDown(event: MouseEvent) {
    console.log(`PageComponent.onMouseDown`);
    let handler = this.handlers[this.mode];
    handler.onMouseDown(event);
  }
  onMouseUp(event: MouseEvent) {
    let handler = this.handlers[this.mode];
    handler.onMouseUp(event);
  }
  onWheel(event: WheelEvent) {
    let handler = this.handlers[this.mode];
    handler.onWheel(event);
  }
  onAddButtonClick(): void {
    this.mode = "add";
  }
  onViewButtonClick(): void {
    this.mode = "view";
  }
  onSelectButtonClick(): void {
    this.mode = "select";
  }
  onSelectFragment(fragment: Fragment) {
    let handler = this.handlers[this.mode];
    handler.onSelectFragment(fragment);
  }
  onKeyDown(e: KeyboardEvent) {
    let handler = this.handlers[this.mode];
    handler.onKeyDown(e);
  }


  cancelSelection() {
    this.selectedFragment = null;
  }
  updateViewBox(viewBox: Rectangle) {
    this.viewBox = viewBox
    this.viewBoxAsString = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  }
  setSelection(fragment: Fragment) {
    this.selectedFragment = fragment;
  }
  updateCurrentFragment(rectangle: Rectangle) {
    this.currentFragment = new Fragment(0, 0, rectangle, "");
  }
  clearCurrentFragment() {
    this.currentFragment = null;
  }
  addNewFragment(rectangle: Rectangle) {
    this.fragmentCounter++; // always increment
    const svgElementId = `fragment-${this.fragmentCounter}`;
    const fragment = new Fragment(0, 0, rectangle, "");

    this.fragments.push(fragment);
    this.selectedFragment = fragment;

    console.log(`PageComponent.addFragment: sending addFragment id: ${fragment.id} request to responder`)
    this.addFragmentService.addFragment(this.diary, this.page, fragment)
      .then((id) => {
        fragment.id = id;
        console.log(`PageComponent.addFragment: fragment: id: ${fragment.id} added`);
        this.alertService.info(`fragment: id: ${fragment.id} added`);
      })
      .catch((err) => {
        console.log(`PageComponent.addFragment: error: ${err}`)
        this.alertService.error(err);
      });
  }
  updateFragment(fragment: Fragment, rectangle: Rectangle) {

    console.log(`PageComponent.updateFragment: sending updateFragment id: ${fragment.id} request to responder`)
    this.updateFragmentService.updateFragment(this.diary, this.page, fragment)
      .then((id) => {
        console.log(`PageComponent.updateFragment: response: id: ${id}`)
        this.alertService.info(`fragment: id: ${id}: fragment: {id: ${fragment.id}, pageid: ${fragment.pageId}} updated`);
      })
      .catch((err) => {
        console.log(`PageComponent.updateFragment: error: ${err}`)
        this.alertService.error(err);
      });
  }
}
