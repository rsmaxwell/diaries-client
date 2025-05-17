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
import { AlertService } from '../alerts/alert.service';
import { ConfigService } from '../config/config.service';
import { BehaviorSubject, combineLatest, filter, Observable } from 'rxjs';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { Marquee } from '../model/marquee/marquee';
import { Rectangle } from '../utilities/rectangle';
import { RpcService } from '../mqtt/rpc.service';
import { LiveObjectService } from '../mqtt/live.object.service';
import { LiveObjectListService } from '../mqtt/live.object.list.service';
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
  selectedMarqueeId: number | null = null;
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

  diary$: Observable<Diary> | null = null;
  page$: Observable<Page> | null = null;


  constructor(
    private route: ActivatedRoute,
    private liveObjectService: LiveObjectService,
    private liveObjectListService: LiveObjectListService,
    private rpcService: RpcService,
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

        combineLatest([
          this.diary$ = this.liveObjectService.getDiaryById$(diaryId),
          this.page$ = this.liveObjectService.getPageById$(diaryId, pageId)
        ])
          .pipe(
            filter(([d, p]) => d !== undefined && p !== undefined)
          )
          .subscribe(([diary, page]) => {
            this.handlePageReply(diary as Diary, page as Page);
          });

        // Fetch the list of marquees
        this.liveObjectListService.getMarqueesForPage$(diaryId, pageId).subscribe(marquees => {
          this.marquees = marquees;
          console.log(`pageComponent.ngOnInit: marquees: ${JSON.stringify(marquees)}`);
        });
      })
      .catch((error) => {
        console.error(`PageComponent.ngOnInit: configuration error: ${error}`);
      });
  }

  ngOnDestroy(): void {
    this.liveObjectListService.unsubscribeFromMarqueesForPage$(this.diary.id, this.page.id);
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
    this.selectedMarqueeId = null;
  }
  deleteSelection() {
    if (this.selectedMarqueeId) {
      console.log(`PageComponent.deleteSelection: marquee: ${this.selectedMarqueeId}`)
      this.rpcService.deleteMarquee$(this.selectedMarqueeId).subscribe({
        next: () => {
          console.log(`PageComponent.deleteSelection: delete succeeded`)
        },
        error: (err) => {
          console.log(`PageComponent.deleteSelection: error: ${err}`);
          this.alertService.error(err);
        }
      });
      this.selectedMarqueeId = null;
    }
  }
  updateViewBox(viewBox: Rectangle) {
    this.viewBox = viewBox
    this.viewBoxAsString = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  }
  setSelection(marquee: Marquee) {
    this.selectedMarqueeId = marquee.id;
  }
  updateCurrentMarquee(rectangle: Rectangle) {
    this.currentMarquee = new Marquee(0, rectangle);
  }
  clearCurrentMarquee() {
    this.currentMarquee = null;
  }
  addNewMarquee(rectangle: Rectangle, sequence: number) {
    console.log(`PageComponent.addMarquee: id: ${JSON.stringify(rectangle)}`)
    this.rpcService.addMarquee$(this.page, rectangle, sequence).subscribe({
      next: (id) => {
        const marquee = new Marquee(id, rectangle);
        this.selectedMarqueeId = marquee.id;
        this.currentMarquee = null;

        console.log(`PageComponent.addMarquee: fragment: id: ${marquee.id} added`);
        this.alertService.info(`fragment: id: ${marquee.id} added`);
      },
      error: (err) => {
        console.log(`PageComponent.addNewMarquee: error: ${err}`)
        this.alertService.error(err);
      }
    });
  }

  updateMarquee(marquee: Marquee) {
    this.rpcService.updateMarquee$(marquee).subscribe({
      next: () => {
        console.log(`PageComponent.updateMarquee: update succeeded`);
      },
      error: (err) => {
        console.log(`PageComponent.updateMarquee: error: ${err}`);
        this.alertService.error(err);
      }
    });
  }
}
