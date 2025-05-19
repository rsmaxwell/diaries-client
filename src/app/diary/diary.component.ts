import { Component, OnDestroy, OnInit } from '@angular/core';
import { Diary, UpdateDiaryRequest } from '../model/diary';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FullheaderComponent } from "../headers/fullheader/fullheader.component";
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FullfooterComponent } from "../headers/fullfooter/fullfooter.component";
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { forkJoin, Observable, Subscription, switchMap } from 'rxjs';
import { AlertService } from '../alerts/alert.service';
import { Page } from '../model/page';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { LiveObjectListService } from '../mqtt/live.object.list.service';
import { LiveObjectService } from '../mqtt/live.object.service';
import { RpcService } from '../mqtt/rpc.service';
import { ConfigService } from '../config/config.service';
import { AccessTokenService } from '../user/token/AccessTokenService';
import { MqttService } from '../mqtt/mqtt.service';
import { ReplyHandler } from '../utilities/replyHandler';
import { Constants } from '../utilities/constants';



@Component({
  selector: 'app-diary',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FullheaderComponent,
    FullfooterComponent,
    MatCardModule,
    MatSelectModule,
    MatInputModule,
    MatFormFieldModule,
    MatTableModule,
    ScrollingModule,
    DragDropModule
  ],
  templateUrl: './diary.component.html',
  styleUrl: './diary.component.scss'
})
export class DiaryComponent implements OnInit, OnDestroy {

  title = 'Diaries';

  pages: Page[] = [];
  dataSource = new MatTableDataSource<Page>();
  displayedColumns: string[] = ['id', 'sequence', 'name'];
  pageSubscription: Subscription = new Subscription();

  diary: Diary | undefined;


  constructor(
    private config: ConfigService,
    private mqtt: MqttService,
    private accessToken: AccessTokenService,
    private rpcService: RpcService,
    private liveObjectListService: LiveObjectListService,
    private liveObjectService: LiveObjectService,
    private router: Router,
    private route: ActivatedRoute,
    private alertService: AlertService
  ) {
    console.log(`DiaryComponent.constructor`)
  }

  ngOnInit(): void {
    console.log(`DiaryComponent.ngOnInit`)

    this.dataSource.data = this.pages;

    const sub = this.route.params
      .pipe(
        switchMap(params => {
          const id = +params['diaryId'];
          return this.liveObjectService.getDiaryById$(id);
        })
      )
      .subscribe(diary => {
        if (!diary) return;
        this.diary = diary;

        console.log(`PageComponent.ngOnInit: diary.id: ${diary.id}`)

        // Only now get the pages
        this.liveObjectListService.getPagesForDiary$(diary.id)
          .subscribe(pages => {
            this.pages = pages;
            this.dataSource.data = pages;
          });
      });

    this.pageSubscription.add(sub);
  }

  selectItem(id: number) {
    console.log(`PageComponent.selectItem: id: ${id}`)

    if (typeof id !== 'number') {
      console.error('Expected numeric page ID, got:', id);
      return;
    }

    this.router.navigate([`/diary/${this.diary?.id}/${id}`]);
  }

  ngOnDestroy(): void {
    console.log('PagesComponent.ngOnDestroy: unsubscribing');
    this.pageSubscription?.unsubscribe();
  }

  drop(event: CdkDragDrop<Diary[]>) {
    const data = this.dataSource.data;
    moveItemInArray(data, event.previousIndex, event.currentIndex);
    this.dataSource.data = data; // Trigger table update

    let seq = 1;
    data.map(p => {

      console.log(`drop: id: ${p.id}, sequence: ${p.sequence}, name: ${p.name}`);

      if (seq != p.sequence) {

        console.log(`          id: ${p.id}, sequence: ${p.sequence} --> ${seq}`);

        p.sequence = seq;

        this.updatePage$(p).subscribe({
          next: (id) => {
            console.log(`diary: ${p.id}, ${p.sequence}, ${p.name} updated`);
          },
          error: (err) => {
            console.log(`DiaryComponent.drop: error: ${err}`)
            this.alertService.error(err);
          }
        });
      }

      seq++;
    })
  }


  updatePage$(page: Page): Observable<number> {
    return forkJoin({
      cfg: this.config.getConfig(),
      client: this.mqtt.getConnection(),
      token: this.accessToken.getToken()
    }).pipe(
      switchMap(({ cfg, client, token }) => {
        const replyTopic = `reply/${cfg.clientId}/updatePage`;
        const payload = { function: 'updatePage', args: new UpdateDiaryRequest(page) };
        const deserialize = ReplyHandler.getBufferAsNumber
        return this.rpcService.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
      })
    );
  }
}
