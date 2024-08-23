import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf, UpperCasePipe } from '@angular/common';
import { Diary } from '../diary';
import { DiaryService } from '../diary.service';
import { DiaryComponent } from "../diary/diary.component";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FullheaderComponent } from "../fullheader/fullheader.component";
import { FullfooterComponent } from "../fullfooter/fullfooter.component";
import { AlertpanelComponent } from "../alertpanel/alertpanel.component";
import { AlertbuttonsComponent } from "../alertbuttons/alertbuttons.component";
import { AlertService } from '../alert.service';

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
    AlertpanelComponent,
    AlertbuttonsComponent
  ],
  templateUrl: './diaries.component.html',
  styleUrl: './diaries.component.scss'
})
export class DiariesComponent implements OnInit {

  @Input() title?: string;
  
  displayedColumns: string[] = ['id', 'path'];
  diaries: Diary[] = [];

  constructor(
    private diaryService: DiaryService, 
    private router: Router,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.getDiaries();
  }

  getDiaries(): void {
    this.diaryService.getDiaries().subscribe({
      next: value => {
        console.log(`DiariesComponent.getDiaries: value: ${JSON.stringify(value)}`)
        this.alertService.infoDump(`DiariesComponent.getDiaries`, JSON.stringify(value))
        this.diaries = value
      },
      error: err => console.error('DiariesComponent.getDiaries: error: ' + err),
      complete: () => console.log('DiariesComponent.getDiaries: complete')
    })
  }

  ngOnDestroy(): void {
    console.log('DiariesComponent.getDiaries: ngOnDestroy')
  }

  getRecord(diary: Diary) {
    console.log(`DiariesComponent.getRecord: diary: ${JSON.stringify(diary)}`)
    this.alertService.info(`DiariesComponent.getRecord: diary: ${JSON.stringify(diary)}`)
    // this.router.navigate([`/diary/${diary.id}`]);
  }
}
