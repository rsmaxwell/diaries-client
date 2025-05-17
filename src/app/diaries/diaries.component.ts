import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Diary } from '../diary/diary';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FullheaderComponent } from '../headers/fullheader/fullheader.component';
import { FullfooterComponent } from '../headers/fullfooter/fullfooter.component';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { LiveObjectListService } from '../mqtt/live.object.list.service';

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
    MatButtonModule
  ],
  templateUrl: './diaries.component.html',
  styleUrl: './diaries.component.scss'
})
export class DiariesComponent implements OnInit, OnDestroy {

  title = "Diaries";
  dataSource = new MatTableDataSource<Diary>();
  displayedColumns: string[] = ['id', 'name'];
  subscription: Subscription | null = null;

  constructor(
    private liveObjectListService: LiveObjectListService,
    private router: Router
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
}
