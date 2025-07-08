import { Component, OnDestroy, OnInit } from '@angular/core';

import { Diary } from '../model/diary';
import { Router } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FullheaderComponent } from '../headers/fullheader/fullheader.component';
import { FullfooterComponent } from '../headers/fullfooter/fullfooter.component';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { LiveObjectListService } from '../mqtt/live.object.list.service';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { RpcService } from '../mqtt/rpc.service';
import { AlertService } from '../alerts/alert.service';
import { FragmentContextService } from '../fragment/fragment-context.service';

@Component({
  selector: 'app-diaries',
  standalone: true,
  imports: [
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
  private destroy$ = new Subject<void>();

  constructor(
    private rpcService: RpcService,
    private fragmentContext: FragmentContextService,
    private router: Router,
    private alertService: AlertService
  ) {
    console.log(`DiariesComponent.constructor`);
  }

  ngOnInit(): void {
    console.log(`DiariesComponent.ngOnInit`);

    this.fragmentContext.getDiaries$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(diaries => {
        this.dataSource.data = diaries;
      });
  }

  ngOnDestroy(): void {
    console.log('DiariesComponent.ngOnDestroy');

    this.destroy$.next();
    this.destroy$.complete();

    this.fragmentContext.cleanupTopicTree();
  }

  selectItem(id: number): void {
    console.log(`DiariesComponent.selectItem: id: ${id}`)
    this.router.navigate([`/diary/${id}`]);
  }

  drop(event: CdkDragDrop<Diary[]>) {
    const updated = [...this.dataSource.data];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.dataSource.data = updated;

    // Get the moved item
    const movedItem = updated[event.currentIndex];

    // Determine surrounding sequence values
    const prevItem = updated[event.currentIndex - 1] ?? null;
    const nextItem = updated[event.currentIndex + 1] ?? null;

    if (prevItem && nextItem) {
      // Middle of the list --> set sequence to average
      movedItem.sequence = (prevItem.sequence + nextItem.sequence) / 2;
    } else if (!prevItem && nextItem) {
      // Moved to the beginning --> less than next
      movedItem.sequence = nextItem.sequence - 1000;
    } else if (prevItem && !nextItem) {
      // Moved to the end --> more than previous
      movedItem.sequence = prevItem.sequence + 1000;
    } else {
      // Only item in the list
      movedItem.sequence = 1000;
    }

    // Trigger table update
    this.dataSource.data = updated;

    // Update the item
    this.rpcService.updateDiary$(movedItem).subscribe({
      next: (n) => {
        console.log(`UpdateDiary succeeded: n: ${n}`);

        // Normalise 
        this.rpcService.normaliseDiaries$().subscribe({
          next: (n) => {
            console.log(`NormaliseDiaries succeeded: n: ${n}`);
          },
          error: (err) => {
            console.log(`NormaliseDiaries failed: ${err}`)
            this.alertService.error(err);
          }
        });

      },
      error: (err) => {
        console.log(`UpdateDiary failed: ${err}`)
        this.alertService.error(err);
      }
    });
  }
}
