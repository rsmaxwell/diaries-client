import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Diary, UpdateDiaryRequest } from '../model/diary';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FullheaderComponent } from '../headers/fullheader/fullheader.component';
import { FullfooterComponent } from '../headers/fullfooter/fullfooter.component';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { forkJoin, Observable, Subscription, switchMap } from 'rxjs';
import { LiveObjectListService } from '../mqtt/live.object.list.service';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { RpcService } from '../mqtt/rpc.service';
import { AlertService } from '../alerts/alert.service';
import { ConfigService } from '../config/config.service';
import { MqttService } from '../mqtt/mqtt.service';
import { AccessTokenService } from '../user/token/AccessTokenService';
import { ReplyHandler } from '../utilities/replyHandler';
import { Constants } from '../utilities/constants';

@Component({
  selector: 'app-diaries',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    ScrollingModule,
    FullheaderComponent,
    FullfooterComponent,
    MatCardModule,
    MatButtonModule,
    DragDropModule
  ],
  templateUrl: './diaries.component.html',
  styleUrl: './diaries.component.scss'
})
export class DiariesComponent implements OnInit, OnDestroy {

  title = 'Diaries';

  dataSource = new MatTableDataSource<Diary>();
  displayedColumns: string[] = ['id', 'sequence', 'name'];
  subscription: Subscription | null = null;

  constructor(
    private config: ConfigService,
    private mqtt: MqttService,
    private accessToken: AccessTokenService,
    private rpcService: RpcService,
    private liveObjectListService: LiveObjectListService,
    private router: Router,
    private alertService: AlertService
  ) {
    console.log(`DiariesComponent.constructor`);
  }

  ngOnInit(): void {
    console.log(`DiariesComponent.ngOnInit`);
    this.subscription = this.liveObjectListService.getDiaries$().subscribe(diaries => {
      this.dataSource.data = diaries;
    });
  }

  selectItem(id: number): void {
    console.log(`DiariesComponent.selectItem: id: ${id}`)
    this.router.navigate([`/diary/${id}`]);
  }

  ngOnDestroy(): void {
    console.log('DiariesComponent.ngOnDestroy');
    if (this.subscription) {
      console.log('DiariesComponent.ngOnDestroy: Unsubscribed from SubscriptionService');
      this.subscription.unsubscribe();
    }
    this.liveObjectListService.unsubscribeFromDiaries$();
  }

  drop(event: CdkDragDrop<Diary[]>) {
    const data = this.dataSource.data;

    // Move the item in the array
    moveItemInArray(data, event.previousIndex, event.currentIndex);

    // Get the moved item
    const movedDiary = data[event.currentIndex];

    // Determine surrounding sequence values
    const prevDiary = data[event.currentIndex - 1] ?? null;
    const nextDiary = data[event.currentIndex + 1] ?? null;

    if (prevDiary && nextDiary) {
      // Middle of the list --> set sequence to average
      movedDiary.sequence = (prevDiary.sequence + nextDiary.sequence) / 2;
    } else if (!prevDiary && nextDiary) {
      // Moved to the beginning --> less than next
      movedDiary.sequence = nextDiary.sequence - 1000;
    } else if (prevDiary && !nextDiary) {
      // Moved to the end --> more than previous
      movedDiary.sequence = prevDiary.sequence + 1000;
    } else {
      // Only item in the list
      movedDiary.sequence = 1000;
    }

    // Trigger table update
    this.dataSource.data = data;

    // Normalise the diaries
    this.rpcService.normaliseDiaries$().subscribe({
      next: (n) => {
        console.log(`NormaliseDiaries succeeded: n: ${n}`);
      },
      error: (err) => {
        console.log(`NormaliseDiaries failed: ${err}`)
        this.alertService.error(err);
      }
    });
  }
}
