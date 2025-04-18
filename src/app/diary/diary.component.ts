import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Diary } from './diary';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DiaryService } from './diary.service';
import { FullheaderComponent } from "../headers/fullheader/fullheader.component";
import { AlertsComponent } from "../alerts/alerts.component";
import { MatTableModule } from '@angular/material/table';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FullfooterComponent } from "../headers/fullfooter/fullfooter.component";
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Subscription } from 'rxjs';
import { AlertService } from '../alerts/alert.service';
import { Page } from '../page/page';


@Component({
  selector: 'app-diary',
  standalone: true,
  imports: [
    FormsModule,
    NgIf,
    FullheaderComponent,
    AlertsComponent,
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

  @Input() title?: string;

  displayedColumns: string[] = ['id', 'name'];
  diary: Diary = new Diary();
  private subscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private diaryService: DiaryService,
    private alertService: AlertService
  ) { }

  ngOnInit(): void {
    console.log(`DiaryComponent.ngOnInit`)
    this.getDiary()
  }


  getDiary(): void {
    const idstring = this.route.snapshot.paramMap.get('diaryId');
    console.log(`DiaryComponent.getDiary: id: ${idstring}`);
    const id = Number(idstring);
  
    this.subscription = this.diaryService.getDiary(id).subscribe({
      next: (value: unknown) => {
        console.log(`DiaryComponent.getDiary: JSON.stringify(value): ${JSON.stringify(value)}`);
  
        if (
          typeof value === 'object' &&
          value !== null &&
          'diary' in value &&
          'pages' in value &&
          Array.isArray((value as any).pages)
        ) {
          const response = value as {
            diary: { id: number; name: string };
            pages: Page[];
          };
  
          // ✅ Combine diary + pages in one assignment
          this.diary = {
            ...response.diary,
            pages: response.pages
          };
  
          this.displayedColumns = ['id', 'name']; // Optional: set if using material table
        } else {
          console.error('DiaryComponent.getDiary: Invalid response structure', value);
          this.alertService.error('Unexpected response from server');
        }
      },
      error: err => {
        console.error(`DiaryComponent.getDiary: error: ${err}`);
        this.alertService.error(err);
      },
      complete: () => console.log('DiaryComponent.getDiary: complete')
    });
  }
  

  ngOnDestroy(): void {
    console.log('DiaryComponent.ngOnDestroy')

    if (this.subscription) {
      this.subscription.unsubscribe();
      console.log('DiaryComponent.ngOnDestroy: Unsubscribed from diaryService');
    }
  }

  selectItem(id: number) {
    console.log(`DiaryComponent.selectItem: id: ${id}`)
    if (this.diary != null) {
      this.router.navigate([`/diary/${this.diary.id}/${id}`]);
    }
  }
}
