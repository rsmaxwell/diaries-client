import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageheaderComponent } from "../headers/pageheader/pageheader.component";
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Diary } from '../model/diary';
import { Page } from '../model/page';
import { ViewModeHandler } from './modehandlers/viewModeHandler';
import { SelectModeHandler } from './modehandlers/selectModeHandler';
import { AddModeHandler } from './modehandlers/addModeHandler';
import { ActivatedRoute } from '@angular/router';
import { AlertService } from '../alerts/alert.service';
import { Config, ConfigService } from '../config/config.service';
import { BehaviorSubject, combineLatest, from, Observable } from 'rxjs';
import { Rectangle } from '../utilities/rectangle';
import { RpcService } from '../mqtt/rpc.service';
import { LiveObjectService } from '../mqtt/live.object.service';
import { LiveObjectListService } from '../mqtt/live.object.list.service';
import { Marquee } from '../model/marquee';
import { MqttService } from '../mqtt/mqtt.service';
import { AccessTokenService } from '../user/token/AccessTokenService';
import { Router } from '@angular/router';

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

  diary: Diary = Diary.default;
  page: Page = Page.default;
  pages: Page[] = [];
  marquees: Marquee[] = [];
  viewBox = new Rectangle(0, 0, 0, 0);
  imageUrl: string = "";
  mode: 'select' | 'add' | 'view' = 'view';
  selectedMarqueeId: number | null = null;
  currentMarquee: Marquee | null = null;
  svg: HTMLElement | SVGSVGElement = {} as HTMLElement;
  viewModeHandler = new ViewModeHandler(this);

  handlers = {
    view: this.viewModeHandler,
    select: new SelectModeHandler(this),
    add: new AddModeHandler(this)
  };

  config$: Observable<Config> | null = null;
  diary$: Observable<Diary> | null = null;
  page$: Observable<Page> | null = null;
  marquees$: Observable<Marquee[]> | null = null;
  svgContainerClass = 'svg-container';
  cursorStyle = '';

  constructor(
    private configService: ConfigService,
    private mqtt: MqttService,
    private accessToken: AccessTokenService,
    private rpcService: RpcService,
    private route: ActivatedRoute,
    private liveObjectService: LiveObjectService,
    private liveObjectListService: LiveObjectListService,
    private alertService: AlertService,
    private cdr: ChangeDetectorRef,
    private router: Router,
  ) { }


  ngOnInit(): void {
    console.log(`PageComponent.ngOnInit`);

    const svgEl = document.getElementById('zoomable-svg');
    if (!(svgEl instanceof SVGSVGElement)) {
      console.error('zoomable-svg is not an SVG element');
      return;
    }
    this.svg = svgEl;

    const diaryId = Number(this.route.snapshot.paramMap.get('diaryId'));
    const pageId = Number(this.route.snapshot.paramMap.get('pageId'));

    if (isNaN(diaryId) || isNaN(pageId)) {
      this.alertService.error('Invalid route: diaryId or pageId is not a number');
      return;
    }

    combineLatest([
      this.config$ = from(this.configService.getConfig()),
      this.diary$ = this.liveObjectService.getDiaryById$(diaryId),
      this.page$ = this.liveObjectService.getPageById$(diaryId, pageId),
      this.marquees$ = this.liveObjectListService.getMarqueesForPage$(diaryId, pageId)

    ]).subscribe(([config, diary, page, marquees]) => {

        this.imageUrl = `${config.fileServerUrl}/${diary.name}/${page.name}${page.extension}`
        this.diary = diary;
        this.page = page;
        this.marquees = marquees;

        this.title$.next(`${diary.name} - ${page.name}`);
      
        const rect = new Rectangle(0, 0, page.width, page.height);
        this.viewModeHandler.setViewBox(rect);
        this.updateViewBox(rect);
        this.cdr.detectChanges();
      });
  }

ngOnDestroy(): void {
  if (this.diary == null || this.page == null) return;
  this.liveObjectListService.unsubscribeFromMarqueesForPage$(this.diary.id, this.page.id);
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
onRightClick(e: MouseEvent) {
  let handler = this.handlers[this.mode];
  handler.onRightClick(e);
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
}
viewBoxString(): string {
  return `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`;
}
setSelection(marquee: Marquee) {
  this.selectedMarqueeId = marquee.id;
}
updateCurrentMarquee(rectangle: Rectangle,) {
  // console.log(`PageComponent.updateCurrentMarquee: rectangle: ${JSON.stringify(rectangle)}`);
  if (this.currentMarquee != null) {
    this.currentMarquee.rectangle = rectangle;
    // console.log(`PageComponent.updateCurrentMarquee: rectangle: ${JSON.stringify(this.currentMarquee)}`);
  }
}
clearCurrentMarquee() {
  this.currentMarquee = null;
}
addNewMarquee(rectangle: Rectangle, sequence: number) {
  console.log(`PageComponent.addMarquee: id: ${JSON.stringify(rectangle)}`)
  this.rpcService.addMarquee$(this.page, rectangle, sequence).subscribe({
    next: (id) => {
      const marquee = new Marquee(id, rectangle, sequence);
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

onBackPressed() {
  if (!this.pages || this.pages.length === 0) return;

  const currentIndex = this.pages.findIndex(p => p.id === this.page.id);

  if (currentIndex > 0) {
    const prevPage = this.pages[currentIndex - 1];
    console.log(`Navigating to previous page: ${prevPage.id}`);
    this.router.navigate([`/diary/${this.diary.id}/${prevPage.id}`]);
  } else {
    console.log('Already at the first page or current page not found.');
  }
}

onUpPressed() {
  console.log('PageComponent: Up pressed');
  // Your logic here
}

onForwardPressed() {
  console.log('PageComponent: Forward pressed');
  if (!this.pages || this.pages.length === 0) return;

  const currentIndex = this.pages.findIndex(p => p.id === this.page.id);

  if (currentIndex >= 0 && currentIndex < this.pages.length - 1) {
    const nextPage = this.pages[currentIndex + 1];
    console.log(`Navigating to next page: ${nextPage.id}`);
    this.router.navigate([`/diary/${this.diary.id}/${nextPage.id}`]);
  } else {
    console.log('Already at the last page or current page not found.');
  }
}

onMarqueeRightClick(event: MouseEvent, marquee: Marquee) {
  event.preventDefault(); // Prevent the browser context menu

  if (this.mode === 'select') {
    this.router.navigate([
      `/diary/${this.diary.id}/${this.page.id}/fragment/${marquee.id}`
    ]);
  }
}
}
