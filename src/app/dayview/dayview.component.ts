import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, take, takeUntil } from 'rxjs';
import { ModelContext } from '../model/model-context';
import { Fragment } from '../model/fragment';
import { CommonModule } from '@angular/common';
import { DateFormatter } from '../utilities/DateFormatter';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { RpcService } from '../mqtt/rpc.service';
import { AlertService } from '../alerts/alert.service';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { Router } from '@angular/router';
import { SafeHtmlPipe } from '../utilities/safe-html.pipe';

@Component({
  selector: 'app-diary',
  standalone: true,
  imports: [
    MatTableModule,
    ScrollingModule,
    CommonModule,
    MatCardModule,
    MatButtonModule,
    DragDropModule,
    SafeHtmlPipe
  ],
  templateUrl: './dayview.component.html',
  styleUrl: './dayview.component.scss'
})
export class DayviewComponent implements OnInit, OnDestroy {

  isDateValid: boolean = false;
  dateSelected: boolean = false;
  formattedDate: string = '';
  year: number = 0;
  month: number = 0;
  day: number = 0;

  displayedColumns = ['sequence', 'text'];
  dataSource = new MatTableDataSource<Fragment>();

  private destroy$ = new Subject<void>();

  constructor(
    private rpcService: RpcService,
    private modelContext: ModelContext,
    private alertService: AlertService,
    private router: Router
  ) { }

  ngOnInit(): void {
    console.log(`DayviewComponent.ngOnInit`);

    this.modelContext.fragment$
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(fragment => {
        if (fragment) {
          this.year = fragment.year;
          this.month = fragment.month;
          this.day = fragment.day;

          if (!fragment) {
            this.year = 0;
            this.month = 0;
            this.day = 0;
            this.dateSelected = false;
          }
          else {
            console.log(`DayviewComponent: fragment: ${fragment.id}`);
            this.year = fragment.year;
            this.month = fragment.month;
            this.day = fragment.day;
            this.dateSelected = true;
          }

          let dateFormatter = new DateFormatter(this.year, this.month, this.day);
          this.formattedDate = dateFormatter.formattedDate;
          this.isDateValid = dateFormatter.isDateValid;

          console.log(`DayviewComponent.ngOnInit: year: ${this.year} month: ${this.month} day: ${this.day}`);
        }
      });

    this.modelContext.fragmentsForSelectedDate$
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(fragments => {
        console.log(`DayviewComponent: loaded ${fragments.length} fragments`);
        this.dataSource.data = fragments;
      });
  }

  ngOnDestroy(): void {
    console.log(`DayviewComponent.ngOnDestroy`);
    this.destroy$.next();
    this.destroy$.complete();
  }

  drop(event: CdkDragDrop<Fragment[]>) {
    const updated = [...this.dataSource.data];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.dataSource.data = updated;

    // Get the moved item
    const movedItem = updated[event.currentIndex];

    // Determine surrounding sequence values
    const prevItem = updated[event.currentIndex - 1] ?? null;
    const nextItem = updated[event.currentIndex + 1] ?? null;

    if (prevItem && nextItem) {
      // Middle of the list --> set sequence to average
      movedItem.sequence = (prevItem.sequence + nextItem.sequence) / 2;
    } else if (!prevItem && nextItem) {
      // Moved to the beginning --> less than next
      movedItem.sequence = nextItem.sequence - 1000;
    } else if (prevItem && !nextItem) {
      // Moved to the end --> more than previous
      movedItem.sequence = prevItem.sequence + 1000;
    } else {
      // Only item in the list
      movedItem.sequence = 1000;
    }

    // Trigger table update
    this.dataSource.data = updated;

    // Update the item with the updated "sequence" number
    this.rpcService.updateFragment$(movedItem)
      .pipe(take(1))
      .subscribe({
        next: (n) => {
          console.log(`DayviewComponent.drop: UpdateFragment succeeded: n: ${n}`);

          // Normalise the sequence numbers
          this.rpcService.normaliseFragments$(this.year, this.month, this.day)
            .pipe(take(1))
            .subscribe({
              next: (n) => {
                console.log(`DayviewComponent.drop: NormaliseFragments succeeded: n: ${n}`);
              },
              error: err => this.handleError(err)
            });
        },
        error: err => this.handleError(err)
      });
  }

  /** error handler */
  private handleError(err: any) {
    console.log(`DayviewComponent.handleError: RPC error: ${err}`);

    if (err?.status === 401) {
      // capture the full current URL (path + query) so you can come back here
      const returnUrl = this.router.url;

      // navigate to `/signin?returnUrl=…`
      this.router.navigate(
        ['/signin'],
        { queryParams: { returnUrl } }
      );
    }
    else {
      this.alertService.error(err);
    }
  }

  goToFragment(fragment: Fragment) {
    console.log(`DayviewComponent.goToFragment: fragmentId: ${fragment.id}`);

    const marqueeId = fragment.marqueeId;

    const diaryId = fragment.;
    const pageId = /* get the pageId that this fragment lives on */;

    // If your route is /diary/:diaryId/:pageId/:fragmentId
    this.router.navigate(['/diary', diaryId, pageId, fragment.id]);
  }
}
