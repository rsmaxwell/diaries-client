import { NgFor } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Diary } from '../diary';
import { DiaryService } from '../diary.service';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    NgFor,
    RouterOutlet, 
    RouterLink, 
    RouterLinkActive,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {

  diaries: Diary[] = [];

  constructor(private diaryService: DiaryService) { }

  ngOnInit(): void {
    this.getHeroes();
  }

  getHeroes(): void {
    this.diaryService.getDiaries()
      .subscribe(diaries => this.diaries = diaries.slice(1, 5));
  }
}
