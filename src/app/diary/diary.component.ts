import { Component, Input } from '@angular/core';
import { Diary } from '../diary';
import { NgFor, NgIf, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { DiaryService } from '../diary.service';

@Component({
  selector: 'app-diary',
  standalone: true,
  imports: [
    FormsModule,
    NgIf,
    NgFor,
    UpperCasePipe
  ],
  templateUrl: './diary.component.html',
  styleUrl: './diary.component.scss'
})
export class DiaryComponent {

  constructor(
    private route: ActivatedRoute,
    private diaryService: DiaryService,
    private location: Location
  ) {}

  @Input() diary?: Diary;

  ngOnInit(): void {
    this.getDiary();
  }
  
  getDiary(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.diaryService.getDiary(id)
      .subscribe(diary => this.diary = diary);
  }

  goBack(): void {
    this.location.back();
  }
}
