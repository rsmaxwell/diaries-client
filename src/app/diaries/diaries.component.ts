import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Diary } from '../diary/diary';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FullheaderComponent } from "../headers/fullheader/fullheader.component";
import { FullfooterComponent } from "../headers/fullfooter/fullfooter.component";
import { MatCardModule } from '@angular/material/card';
import { Subscription } from 'rxjs';
import { AlertService } from '../alerts/alert.service';
import { DiariesService } from './diaries.service';

@Component({
  selector: 'app-diaries',
  standalone: true,
  imports: [
    FormsModule,
    MatTableModule,
    ScrollingModule,
    FullheaderComponent,
    FullfooterComponent,
    MatCardModule
],
  templateUrl: './diaries.component.html',
  styleUrl: './diaries.component.scss'
})
export class DiariesComponent implements OnInit, OnDestroy {

  title = "Diaries";
  displayedColumns: string[] = ['id', 'name'];
  diaries: Diary[] = [];
  private subscription?: Subscription;

  constructor(
    private diariesService: DiariesService, 
    private router: Router,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    console.log(`DiariesComponent.ngOnInit`);
    this.getDiaries();
  }

  getDiaries(): void {
    console.log(`DiariesComponent.getDiaries`);

    this.subscription = this.diariesService.getDiaries().subscribe({
      next: value => {
        console.log(`DiariesComponent.getDiaries: JSON.stringify(value): ${JSON.stringify(value)}`);
        this.diaries = value
      },
      error: err => {
        console.error(`DiariesComponent.getDiaries: error:  + ${JSON.stringify(err)}`)
        this.alertService.info(err.message)
     },
      complete: () => console.log('DiariesComponent.getDiaries: complete')
    })
  }

  ngOnDestroy(): void {
    console.log('DiariesComponent.ngOnDestroy')
    if (this.subscription) {
      this.subscription.unsubscribe();
      console.log('DiariesComponent.ngOnDestroy: Unsubscribed from diariesService');
    }
  }

  selectItem(id: number) {
    console.log(`DiariesComponent.selectItem: id: ${id}`)
    this.router.navigate([`/diary/${id}`]);
  }
}
