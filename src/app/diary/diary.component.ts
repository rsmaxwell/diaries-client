import { Component, OnDestroy, OnInit } from '@angular/core';
import { Diary } from '../model/diary';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FullHeaderComponent } from "../headers/fullheader/fullheader.component";
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FullfooterComponent } from "../headers/fullfooter/fullfooter.component";
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { map, Subject, takeUntil } from 'rxjs';
import { AlertService } from '../alerts/alert.service';
import { Page } from '../model/page';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { RpcService } from '../mqtt/rpc.service';
import { ModelContext } from '../model/model-context';



@Component({
  selector: 'app-diary',
  standalone: true,
  imports: [
    FormsModule,
    FullHeaderComponent,
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
  displayedColumns: string[] = ['id', 'sequence', 'name'];
  dataSource = new MatTableDataSource<Page>();
  diaryId: number | undefined;
  diary: Diary | undefined;
  private destroy$ = new Subject<void>();

  constructor(
    private rpcService: RpcService,
    private router: Router,
    private route: ActivatedRoute,
    private alertService: AlertService,
    private modelContext: ModelContext
  ) { }

  ngOnInit(): void {
    console.log(`DiaryComponent.ngOnInit`);

    // 🚦 Listen reactively for param changes
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        map(paramMap => ({
          diaryId: paramMap.get('diaryId') ? +paramMap.get('diaryId')! : null
        }))
      )
      .subscribe(({ diaryId }) => {
        console.log(`DiaryComponent.ngOnInit: Route changed: diaryId: ${diaryId}`);

        if (diaryId) {
          this.modelContext.setDiaryId(diaryId);
        }
      })

    // Subscribe to the reactive Diary stream 
    this.modelContext.selectedDiary$
      .pipe(takeUntil(this.destroy$))
      .subscribe(diary => {
        console.log(`DiaryComponent.ngOnInit: diary.id: ${diary.id}`);
        this.diary = diary;
      });

    // Begin fetching pages immediately
    this.modelContext.pages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(pages => {
        // console.log(`DiaryComponent.ngOnInit: pages.length: ${pages.length}`);
        this.dataSource.data = pages;
      });
  }

  ngOnDestroy(): void {
    console.log('DiaryComponent.ngOnDestroy');

    this.destroy$.next();
    this.destroy$.complete();

    this.modelContext.cleanupTopicTree();
  }

  selectItem(id: number) {
    console.log(`DiaryComponent.selectItem: id: ${id}`);

    if (typeof id !== 'number') {
      console.error('Expected numeric page ID, got:', id);
      return;
    }

    console.log(`DiaryComponent.selectItem: this.diary: ${JSON.stringify(this.diary)}`);

    this.router.navigate([`/diary/${this.diary?.id}/${id}`]);
  }

  drop(event: CdkDragDrop<Page[]>) {
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

    // Update the Item 
    this.rpcService.updatePage$(movedItem).subscribe({
      next: (n) => {
        console.log(`UpdatePage succeeded: n: ${n}`);

        // Normalise
        this.rpcService.normalisePages$().subscribe({
          next: (n) => {
            console.log(`NormalisePages succeeded: n: ${n}`);
          },
          error: (err) => {
            console.log(`NormalisePages failed: ${err}`)
            this.alertService.error(err);
          }
        });

      },
      error: (err) => {
        console.log(`UpdatePage failed: ${err}`)
        this.alertService.error(err);
      }
    });
  }
}
