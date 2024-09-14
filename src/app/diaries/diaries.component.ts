import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf, UpperCasePipe } from '@angular/common';
import { Diary } from '../diary';
import { DiaryService } from '../diary.service';
import { DiaryComponent } from "../diary/diary.component";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FullheaderComponent } from "../headers/fullheader/fullheader.component";
import { FullfooterComponent } from "../headers/fullfooter/fullfooter.component";
import { AlertsComponent } from "../alerts/alerts.component";
import { AlertbuttonsComponent } from "../alertbuttons/alertbuttons.component";
import { MatCardModule } from '@angular/material/card';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-diaries',
  standalone: true,
  imports: [
    FormsModule,
    NgFor,
    NgIf,
    RouterOutlet, 
    RouterLink, 
    RouterLinkActive,
    UpperCasePipe,
    DiaryComponent,
    MatTableModule,
    ScrollingModule,
    FullheaderComponent,
    FullfooterComponent,
    AlertsComponent,
    AlertbuttonsComponent,
    MatCardModule
  ],
  templateUrl: './diaries.component.html',
  styleUrl: './diaries.component.scss'
})
export class DiariesComponent implements OnInit, OnDestroy {

  @Input() title?: string;
  
  displayedColumns: string[] = ['id', 'name'];
  diaries: Diary[] = [];
  private diarySubscription?: Subscription;

  constructor(
    private diaryService: DiaryService, 
    private router: Router
  ) {}

  ngOnInit(): void {
    this.getDiaries();
  }

  getDiaries(): void {
    this.diarySubscription = this.diaryService.getDiaries().subscribe({
      next: value => {
        console.log(`DiariesComponent.getDiaries: JSON.stringify(value): ${JSON.stringify(value)}`);
        this.diaries = value
      },
      error: err => console.error('DiariesComponent.getDiaries: error: ' + err),
      complete: () => console.log('DiariesComponent.getDiaries: complete')
    })
  }

  ngOnDestroy(): void {
    console.log('DiariesComponent.ngOnDestroy')
    if (this.diarySubscription) {
      this.diarySubscription.unsubscribe();
      console.log('DiariesComponent.ngOnDestroy: Unsubscribed from diaryService');
    }
  }

  getRecord(diary: Diary) {
    console.log(`DiariesComponent.getRecord: id: ${diary.id}, path: ${diary.name}`)
    this.router.navigate([`/diary/${diary.id}`]);
  }
}
