import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf, UpperCasePipe } from '@angular/common';
import { Diary } from '../diary';
import { DiaryService } from '../diary.service';
import { DiaryComponent } from "../diary/diary.component";
import { MessageService } from '../message.service';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

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
    DiaryComponent
],
  templateUrl: './diaries.component.html',
  styleUrl: './diaries.component.scss'
})
export class DiariesComponent implements OnInit {

  diaries: Diary[] = [];

  constructor(private diaryService: DiaryService, private messageService: MessageService) {}

  ngOnInit(): void {
    this.getDiaries();
  }

  getDiaries(): void {
    
    this.diaryService.getDiaries()
        .subscribe(diaries => this.diaries = diaries);
  }
}
