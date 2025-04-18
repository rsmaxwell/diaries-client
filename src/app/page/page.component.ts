import { Component, Input } from '@angular/core';
import { FullheaderComponent } from "../headers/fullheader/fullheader.component";
import { FullfooterComponent } from "../headers/fullfooter/fullfooter.component";
import { AlertsComponent } from "../alerts/alerts.component";
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Diary } from '../diary/diary';
import { Page } from './page';
import { ActivatedRoute } from '@angular/router';
import { DiaryService } from '../diary/diary.service';


@Component({
  selector: 'app-pages',
  standalone: true,
  imports: [
    FullheaderComponent,
    FullfooterComponent,
    AlertsComponent,
    MatSlideToggleModule,
  ],
  templateUrl: './page.component.html',
  styleUrl: './page.component.scss'
})
export class PageComponent {

  @Input() title?: string;

  diary?: Diary;
  page?: Page;

  constructor(private route: ActivatedRoute, private diaryService: DiaryService) { }

  ngOnInit(): void {
    const diaryId = Number(this.route.snapshot.paramMap.get('diaryId'));
    const pageId = Number(this.route.snapshot.paramMap.get('pageId'));

    this.diaryService.getDiary(diaryId).subscribe(response => {
      // this.diary = response.diary;
      this.page = response.pages.find(p => p.id === pageId);
    });
  }
}
