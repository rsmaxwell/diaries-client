import { Component, Input, OnInit } from '@angular/core';
import { Diary } from '../diary';
import { Page } from '../page';
import { NgFor, NgIf, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DiaryService } from '../diary.service';
import { PageService } from '../page.service';
import { FullheaderComponent } from "../headers/fullheader/fullheader.component";
import { AlertsComponent } from "../alerts/alerts.component";
import { AlertbuttonsComponent } from "../alertbuttons/alertbuttons.component";
import { MatTableModule } from '@angular/material/table';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FullfooterComponent } from "../headers/fullfooter/fullfooter.component";
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-diary',
  standalone: true,
  imports: [
    FormsModule,
    NgIf,
    NgFor,
    UpperCasePipe,
    FullheaderComponent,
    AlertsComponent,
    AlertbuttonsComponent,
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
export class DiaryComponent implements OnInit {

  @Input() title?: string;
  @Input() diary?: Diary;

  displayedColumns: string[] = ['id', 'name'];
  pages: Page[] = [];
  private pageSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private diaryService: DiaryService,
    private pageService: PageService
  ) { }

  ngOnInit(): void {
    console.log(`DiaryComponent.ngOnInit`)
    this.getDiary();
    this.getPages();
  }

  getDiary(): void {
    const id = this.route.snapshot.paramMap.get('id');
    console.log(`DiaryComponent.getDiary: id: ${id}`)

    if (id != undefined) {
      this.diaryService.getDiary(Number(id))
        .subscribe(diary => {
          this.diary = diary
          this.pageService.subscribe(diary);
        });
    }
  }

  getPages(): void {
    this.pageSubscription = this.pageService.getPages().subscribe({
      next: value => {
        console.log(`DiaryComponent.getPages: JSON.stringify(value): ${JSON.stringify(value)}`);
        this.pages = value
      },
      error: err => console.error('DiaryComponent.getPages: error: ' + err),
      complete: () => console.log('DiaryComponent.getPages: complete')
    })
  }

  ngOnDestroy(): void {
    console.log('DiaryComponent.ngOnDestroy')

    this.pageService.unsubscribe();

    if (this.pageSubscription) {
      this.pageSubscription.unsubscribe();
      console.log('DiaryComponent.ngOnDestroy: Unsubscribed from pageService');
    }
  }

  getRecord(page: Page) {
    console.log(`DiaryComponent.getRecord: id: ${page.id}, path: ${page.name}`)

    // this.router.navigate([`/diary/${page.id}`]);
  }
}
