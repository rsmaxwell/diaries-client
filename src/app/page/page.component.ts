import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageheaderComponent } from "../headers/pageheader/pageheader.component";
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Diary } from '../diary/diary';
import { Page } from './page';
import { ViewModeHandler } from './modehandlers/viewModeHandler';
import { SelectModeHandler } from './modehandlers/selectModeHandler';
import { AddModeHandler } from './modehandlers/addModeHandler';
import { ActivatedRoute } from '@angular/router';
import { DiariesService } from '../diaries/diaries.service';
import { AlertService } from '../alerts/alert.service';
import { ConfigService } from '../config/config.service';
import { BehaviorSubject, combineLatest, filter } from 'rxjs';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { Fragment, Marquee } from '../model/fragment/fragment';
import { Rectangle } from '../utilities/rectangle';
import { FragmentServiceGet } from '../fragments/fragment.service.get';
import { FragmentServiceAdd } from '../fragments/fragment.service.add';
import { FragmentServiceUpdate } from '../fragments/fragment.service.update';
import { FragmentServiceDelete } from '../fragments/fragment.service.delete';
import { PagesService } from '../diary/pages.service';


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
export class PageComponent implements OnInit, OnDestroy {

  title$ = new BehaviorSubject<string>('Loading...');

  diary: Diary = new Diary();
  page: Page = new Page();
  viewBox = new Rectangle(0, 0, 0, 0);
  viewBoxAsString = '0 0 0 0';
  fileServerUrl: string = "";
  mode: 'select' | 'add' | 'view' = 'view';
  selectedMarquee: Marquee | null = null;
  currentMarquee: Marquee | null = null;
  marquees: Marquee[] = [];
  svg: HTMLElement | SVGSVGElement = {} as HTMLElement;
  viewModeHandler = new ViewModeHandler(this);
  style: string = '';
  handlers = {
    view: this.viewModeHandler,
    select: new SelectModeHandler(this),
    add: new AddModeHandler(this)
  };


  constructor(
    private route: ActivatedRoute,
    private diariesService: DiariesService,
    private pagesService: PagesService,
    private fragmentServiceGet: FragmentServiceGet,
    private fragmentServiceAdd: FragmentServiceAdd,
    private fragmentServiceUpdate: FragmentServiceUpdate,
    private fragmentServiceDelete: FragmentServiceDelete,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private configService: ConfigService
  ) { }


  ngOnInit(): void {
    console.log(`PageComponent.ngOnInit`);

    const svgEl = document.getElementById('zoomable-svg');
    if (!(svgEl instanceof SVGSVGElement)) {
      console.error('zoomable-svg is not an SVG element');
      return;
    }
    this.svg = svgEl;

    this.configService.getConfig()
      .then((config) => {
        this.fileServerUrl = config.fileServerUrl;

        const diaryIdParam = this.route.snapshot.paramMap.get('diaryId');
        const pageIdParam = this.route.snapshot.paramMap.get('pageId');

        if (!diaryIdParam || !pageIdParam) {
          this.alertService.error('Invalid route: missing diaryId or pageId');
          return;
        }

        const diaryId = Number(diaryIdParam);
        const pageId = Number(pageIdParam);

        if (isNaN(diaryId) || isNaN(pageId)) {
          this.alertService.error('Invalid route: diaryId or pageId is not a number');
          return;
        }

        // Combine Diary and Page fetches
        combineLatest([
          this.diariesService.getDiaryById(diaryId),
          this.pagesService.getPageForDiaryById(diaryId, pageId)
        ])
          .pipe(
            filter(([d, p]) => d !== undefined && p !== undefined)
          )
          .subscribe(([diary, page]) => {
            this.handlePageReply(diary as Diary, page as Page);
          });

        // Fetch fragments separately (and convert to Marquee)
        this.fragmentServiceGet.getFragmentsForPage(diaryId, pageId)
          .pipe(filter((fragments): fragments is Fragment[] => Array.isArray(fragments)))
          .subscribe(fragments => {
            this.marquees = fragments.map(fragment => Marquee.fromFragment(fragment));
          });
      })
      .catch((error) => {
        console.error(`MqttService.getConnection: configuration error: ${error}`);
      });
  }

  ngOnDestroy(): void {
    this.fragmentServiceGet.unsubscribe(this.diary.id, this.page.id);
  }


  handlePageReply(diary: Diary, page: Page) {
    console.log(`pageComponent.handlePageReply: diary: ${JSON.stringify(diary)}, page: ${JSON.stringify(page)}`);

    this.diary = diary;
    this.page = page;

    console.log(`pageComponent.handlePageReply: updating the title`);
    this.title$.next(`${diary.name} - ${page.name}`);

    const rect = new Rectangle(0, 0, page.width, page.height);
    this.viewModeHandler.setViewBox(rect);
    this.updateViewBox(rect);
    this.cdr.detectChanges();
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
  onSelectMarquee(marquee: Marquee) {
    let handler = this.handlers[this.mode];
    handler.onSelectMarquee(marquee);
  }
  onKeyDown(e: KeyboardEvent) {
    let handler = this.handlers[this.mode];
    handler.onKeyDown(e);
  }


  cancelSelection() {
    this.selectedMarquee = null;
  }
  deleteSelection() {
    if (this.selectedMarquee) {
      console.log(`PageComponent.deleteSelection: marquee: ${JSON.stringify(this.selectedMarquee)}`)
      this.fragmentServiceDelete.deleteFragment(this.selectedMarquee)
        .then((x) => {
          console.log(`PageComponent.deleteSelection: delete succeeded`)
        })
      this.selectedMarquee = null;
    }
  }
  updateViewBox(viewBox: Rectangle) {
    this.viewBox = viewBox
    this.viewBoxAsString = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  }
  setSelection(marquee: Marquee) {
    this.selectedMarquee = marquee;
  }
  updateCurrentMarquee(rectangle: Rectangle) {
    this.currentMarquee = new Marquee(0, rectangle);
  }
  clearCurrentMarquee() {
    this.currentMarquee = null;
  }
  addNewFragment(rectangle: Rectangle) {

    console.log(`PageComponent.addFragment: sending addFragment request: id: ${JSON.stringify(rectangle)}`)
    this.fragmentServiceAdd.addFragment(this.page, rectangle)
      .then((id) => {
        // Wait for MQTT to deliver the new fragment, which will be handled by the existing subscription
        const marquee = new Marquee(id, rectangle);
        this.selectedMarquee = marquee;
        this.currentMarquee = null;

        console.log(`PageComponent.addFragment: fragment: id: ${marquee.id} added`);
        this.alertService.info(`fragment: id: ${marquee.id} added`);
      })
      .catch((err) => {
        console.log(`PageComponent.addFragment: error: ${err}`)
        this.alertService.error(err);
      });
  }

  updateFragment(marquee: Marquee) {
    console.log(`PageComponent.updateFragment: marquee: ${JSON.stringify(marquee)}`)
    this.fragmentServiceUpdate.updateFragment(marquee)
      .then((x) => {
        console.log(`PageComponent.updateFragment: update succeeded`)
      })
  }
}
