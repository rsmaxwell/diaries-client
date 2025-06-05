import { Component, OnDestroy, OnInit } from '@angular/core';
import { Diary } from '../model/diary';
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
import { Subject, switchMap, takeUntil } from 'rxjs';
import { AlertService } from '../alerts/alert.service';
import { Page } from '../model/page';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { LiveObjectListService } from '../mqtt/live.object.list.service';
import { LiveObjectService } from '../mqtt/live.object.service';
import { RpcService } from '../mqtt/rpc.service';



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
  displayedColumns: string[] = ['id', 'sequence', 'name'];
  dataSource = new MatTableDataSource<Page>();
  diary: Diary | undefined;
  private destroy$ = new Subject<void>();

  constructor(
    private rpcService: RpcService,
    private liveObjectListService: LiveObjectListService,
    private liveObjectService: LiveObjectService,
    private router: Router,
    private route: ActivatedRoute,
    private alertService: AlertService
  ) {
    console.log(`DiaryComponent.constructor`);
  }

  ngOnInit(): void {
    console.log(`DiaryComponent.ngOnInit`);

    this.route.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap(params => {
          const id = +params['diaryId'];
          return this.liveObjectService.getDiaryById$(id);
        })
      )
      .subscribe(diary => {
        this.diary = diary;

        console.log(`PageComponent.ngOnInit: diary.id: ${diary.id}`);

        // Only now get the pages
        this.liveObjectListService.getPagesForDiary$(diary.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe(pages => {
            this.dataSource.data = pages;
          });
      });
  }

  ngOnDestroy(): void {
    console.log('DiaryComponent.ngOnDestroy');
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectItem(id: number) {
    console.log(`PageComponent.selectItem: id: ${id}`);

    if (typeof id !== 'number') {
      console.error('Expected numeric page ID, got:', id);
      return;
    }

    this.router.navigate([`/diary/${this.diary?.id}/${id}`]);
  }

  drop(event: CdkDragDrop<Diary[]>) {
    const data = this.dataSource.data;
    moveItemInArray(data, event.previousIndex, event.currentIndex);
    this.dataSource.data = data;

    let seq = 1;
    data.map(p => {
      console.log(`drop: id: ${p.id}, sequence: ${p.sequence}, name: ${p.name}`);

      if (seq != p.sequence) {
        console.log(`          id: ${p.id}, sequence: ${p.sequence} --> ${seq}`);
        p.sequence = seq;

        this.rpcService.updatePage$(p)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (id) => {
              console.log(`diary: ${p.id}, ${p.sequence}, ${p.name} updated`);
            },
            error: (err) => {
              console.log(`DiaryComponent.drop: error: ${err}`);
              this.alertService.error(err);
            }
          });
      }

      seq++;
    });
  }
}
