import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Diary } from '../model/diary';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FullheaderComponent } from '../headers/fullheader/fullheader.component';
import { FullfooterComponent } from '../headers/fullfooter/fullfooter.component';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { LiveObjectListService } from '../mqtt/live.object.list.service';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { RpcService } from '../mqtt/rpc.service';
import { AlertService } from '../alerts/alert.service';

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

  title = "Diaries";
  dataSource = new MatTableDataSource<Diary>();
  displayedColumns: string[] = ['id', 'sequence', 'name'];
  subscription: Subscription | null = null;

  constructor(
    private liveObjectListService: LiveObjectListService,
    private router: Router,
    private rpcService: RpcService,
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
    moveItemInArray(data, event.previousIndex, event.currentIndex);
    this.dataSource.data = data; // Trigger table update
    // Optionally: emit/save the new order to backend here
    console.log('Updated diary order:', data.map(d => d.id));

    let seq = 1;
    data.map(d => {

      console.log(`drop: id: ${d.id}, sequence: ${d.sequence}, name: ${d.name}`);

      if (seq != d.sequence) {

        console.log(`          id: ${d.id}, sequence: ${d.sequence} --> ${seq}`);

        d.sequence = seq;

        this.rpcService.updateDiary$(d).subscribe({
          next: (id) => {
            console.log(`diary: ${d.id}, ${d.sequence}, ${d.name} updated`);
          },
          error: (err) => {
            console.log(`DiariesComponent.drop: error: ${err}`)
            this.alertService.error(err);
          }
        });
      }

      seq++;
    })
  }
}
