import { Component, Input, OnInit } from '@angular/core';
import { Diary } from '../diary';
import { NgFor, NgIf, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DiaryService } from '../diary.service';
import { FullheaderComponent } from "../fullheader/fullheader.component";
import { AlertsComponent } from "../alerts/alerts.component";
import { AlertbuttonsComponent } from "../alertbuttons/alertbuttons.component";
import { FullfooterComponent } from "../fullfooter/fullfooter.component";
import { MatCardModule } from '@angular/material/card';

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
    MatCardModule
  ],
  templateUrl: './diary.component.html',
  styleUrl: './diary.component.scss'
})
export class DiaryComponent implements OnInit {

  @Input() title?: string;
  @Input() diary?: Diary;

  constructor(
    private route: ActivatedRoute,
    private diaryService: DiaryService
  ) { }

  ngOnInit(): void {
    console.log(`DiaryComponent.ngOnInit`)
    this.getDiary();
  }

  getDiary(): void {
    const id = this.route.snapshot.paramMap.get('id');
    console.log(`DiaryComponent.getDiary: id: ${id}`)

    if (id != undefined) {
      this.diaryService.getDiary(Number(id))
        .subscribe(diary => this.diary = diary);
    }
  }
}
