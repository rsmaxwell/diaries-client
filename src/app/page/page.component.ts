import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageheaderComponent } from "../headers/pageheader/pageheader.component";
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Diary } from '../model/diary';
import { Page } from '../model/page';
import { ViewModeHandler } from './modehandlers/viewModeHandler';
import { SelectModeHandler } from './modehandlers/selectModeHandler';
import { AddModeHandler } from './modehandlers/addModeHandler';
import { ActivatedRoute } from '@angular/router';
import { AlertService } from '../alerts/alert.service';
import { ConfigService } from '../config/config.service';
import { BehaviorSubject, combineLatest, filter, forkJoin, Observable, switchMap } from 'rxjs';
import { PagefooterComponent } from '../headers/pagefooter/pagefooter.component';
import { Rectangle } from '../utilities/rectangle';
import { RpcService } from '../mqtt/rpc.service';
import { LiveObjectService } from '../mqtt/live.object.service';
import { LiveObjectListService } from '../mqtt/live.object.list.service';
import { AddMarqueeRequest, DeleteMarqueeRequest, Marquee, UpdateMarqueeRequest } from '../model/marquee';
import { MqttService } from '../mqtt/mqtt.service';
import { AccessTokenService } from '../user/token/AccessTokenService';
import { ReplyHandler } from '../utilities/replyHandler';
import { Constants } from '../utilities/constants';
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

  diary: Diary = new Diary();
  page: Page = new Page();
  pages: Page[] = [];
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
    private config: ConfigService,
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

    this.config.getConfig()
      .then((cfg) => {
        this.fileServerUrl = cfg.fileServerUrl;

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
        });

        // Fetch the list of pages
        this.liveObjectListService.getPagesForDiary$(diaryId).subscribe(pages => {
          this.pages = pages;
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
      this.deleteMarquee$(this.selectedMarqueeId).subscribe({
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
    this.addMarquee$(this.page, rectangle, sequence).subscribe({
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
    this.updateMarquee$(marquee).subscribe({
      next: () => {
        console.log(`PageComponent.updateMarquee: update succeeded`);
      },
      error: (err) => {
        console.log(`PageComponent.updateMarquee: error: ${err}`);
        this.alertService.error(err);
      }
    });
  }

  addMarquee$(page: Page, rect: Rectangle, sequence: number): Observable<number> {
    return forkJoin({
      cfg: this.config.getConfig(),
      client: this.mqtt.getConnection(),
      token: this.accessToken.getToken()
    }).pipe(
      switchMap(({ cfg, client, token }) => {
        const replyTopic = `reply/${cfg.clientId}/addMarquee`;
        const payload = { function: 'addMarquee', args: new AddMarqueeRequest(page.id, rect, sequence) };
        const deserialize = ReplyHandler.getBufferAsNumber
        return this.rpcService.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
      })
    );
  }

  updateMarquee$(marquee: Marquee): Observable<number> {
    return forkJoin({
      cfg: this.config.getConfig(),
      client: this.mqtt.getConnection(),
      token: this.accessToken.getToken()
    }).pipe(
      switchMap(({ cfg, client, token }) => {
        const replyTopic = `reply/${cfg.clientId}/updateMarquee`;
        const payload = { function: 'updateMarquee', args: new UpdateMarqueeRequest(marquee) };
        const deserialize = ReplyHandler.getBufferAsNumber
        return this.rpcService.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
      })
    );
  }

  deleteMarquee$(id: number): Observable<number> {
    return forkJoin({
      cfg: this.config.getConfig(),
      client: this.mqtt.getConnection(),
      token: this.accessToken.getToken()
    }).pipe(
      switchMap(({ cfg, client, token }) => {
        const replyTopic = `reply/${cfg.clientId}/deleteMarquee`;
        const payload = { function: 'deleteMarquee', args: new DeleteMarqueeRequest(id) };
        const deserialize = ReplyHandler.getBufferAsNumber
        return this.rpcService.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
      })
    );
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
}
