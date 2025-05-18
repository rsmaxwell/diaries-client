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
import { Subscription, switchMap } from 'rxjs';
import { AlertService } from '../alerts/alert.service';
import { Page } from '../model/page';
import { LiveObjectListService } from '../mqtt/live.object.list.service';
import { LiveObjectService } from '../mqtt/live.object.service';


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
    ScrollingModule
  ],
  templateUrl: './diary.component.html',
  styleUrl: './diary.component.scss'
})
export class DiaryComponent implements OnInit, OnDestroy {

  title = "Diaries";

  pages: Page[] = [];
  pageDataSource = new MatTableDataSource<Page>();
  displayedColumns: string[] = ['id', 'sequence', 'name'];
  pageSubscription: Subscription = new Subscription();

  diary: Diary | undefined;


  constructor(
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
}
