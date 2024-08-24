import { NgFor } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { Diary } from '../diary';
import { DiaryService } from '../diary.service';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FullheaderComponent } from "../fullheader/fullheader.component";
import { FullfooterComponent } from "../fullfooter/fullfooter.component";
import { AlertsComponent } from "../alerts/alerts.component";
import { AlertbuttonsComponent } from "../alertbuttons/alertbuttons.component";

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    NgFor,
    RouterOutlet, 
    RouterLink, 
    RouterLinkActive,
    FullheaderComponent,
    FullfooterComponent,
    AlertsComponent,
    AlertbuttonsComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {

  @Input() title?: string;
  
  diaries: Diary[] = [];

  constructor(private diaryService: DiaryService) { }

  ngOnInit(): void {
    this.getDiaries();
  }

  getDiaries(): void {
    this.diaryService.getDiaries()
      .subscribe(diaries => this.diaries = diaries.slice(1, 5));
  }
}
