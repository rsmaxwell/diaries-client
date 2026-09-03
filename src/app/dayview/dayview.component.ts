import { Component, OnDestroy, OnInit } from '@angular/core';
import { firstValueFrom, Subject, take, takeUntil } from 'rxjs';
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
import { FragmentLockService } from '../fragment/fragment-lock.service';

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

  displayedColumns = ['id', 'sequence', 'text'];
  dataSource = new MatTableDataSource<Fragment>();
  reorderInFlight = false;

  private destroy$ = new Subject<void>();

  constructor(
    private rpcService: RpcService,
    private modelContext: ModelContext,
    private alertService: AlertService,
    private router: Router,
    private fragmentLockService: FragmentLockService
  ) { }

  ngOnInit(): void {
    console.log(`DayviewComponent.ngOnInit`);

    this.modelContext.selectFragmentsForDate$
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(fragments => {
        console.log("DayviewComponent.<subscribe fragments>: fragments:", fragments.map(f => f.id));

        const sorted = fragments.slice().sort((a, b) => a.sequence - b.sequence);
        this.dataSource.data = sorted;

        const first = fragments[0];
        if (first) {
          this.year = first.year;
          this.month = first.month;
          this.day = first.day;
          this.dateSelected = true;

          const dateFormatter = new DateFormatter(this.year, this.month, this.day);
          this.formattedDate = dateFormatter.formattedDate;
          this.isDateValid = dateFormatter.isDateValid;
        } else {
          this.dateSelected = false;
          this.formattedDate = '';
          this.isDateValid = false;
        }
      });
  }

  ngOnDestroy(): void {
    console.log(`DayviewComponent.ngOnDestroy`);
    this.destroy$.next();
    this.destroy$.complete();
  }

  async drop(event: CdkDragDrop<Fragment[]>): Promise<void> {
    if (this.reorderInFlight || event.previousIndex === event.currentIndex) {
      return;
    }

    const original = [...this.dataSource.data];
    const reordered = [...original];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);

    // Clone the moved fragment before assigning its temporary sort key. The
    // fragments supplied by ModelContext are shared live-model objects and must
    // not be mutated optimistically.
    const movedItem = { ...reordered[event.currentIndex] };
    reordered[event.currentIndex] = movedItem;

    const prevItem = reordered[event.currentIndex - 1] ?? null;
    const nextItem = reordered[event.currentIndex + 1] ?? null;

    if (prevItem && nextItem) {
      movedItem.sequence = (prevItem.sequence + nextItem.sequence) / 2;
    } else if (!prevItem && nextItem) {
      movedItem.sequence = nextItem.sequence - 1000;
    } else if (prevItem && !nextItem) {
      movedItem.sequence = prevItem.sequence + 1000;
    } else {
      movedItem.sequence = 1;
    }

    this.reorderInFlight = true;
    let lockAcquired = false;

    try {
      lockAcquired = await this.fragmentLockService.lockFragmentForEdit(movedItem.id);
      if (!lockAcquired) {
        this.dataSource.data = original;
        return;
      }

      // Present the intended final order without exposing the temporary sort
      // key. Retained MQTT updates will replace these optimistic values with the
      // responder's canonical, versioned fragments.
      this.dataSource.data = reordered.map((fragment, index) => ({
        ...fragment,
        sequence: index + 1
      }));

      const n = await firstValueFrom(
        this.rpcService.updateFragment$(movedItem).pipe(take(1))
      );
      console.log(`DayviewComponent.drop: UpdateFragment succeeded: n: ${n}`);

      // UpdateFragment releases the lock and normalises the date atomically.
      lockAcquired = false;

    } catch (err) {
      this.dataSource.data = original;

      if (lockAcquired) {
        await this.fragmentLockService.unlockFragmentAfterFailedEdit(movedItem.id);
      }

      this.handleError(err);

    } finally {
      this.reorderInFlight = false;
    }
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
    if (!marqueeId) {
      console.warn(`No marqueeId for fragment ${fragment.id}`);
      return;
    }

    this.modelContext.getLiveMarquee$(marqueeId)
      .pipe(take(1))
      .subscribe({
        next: (marquee) => {
          if (!marquee) {
            console.warn(`No marquee found for id ${marqueeId}`);
            return;
          }

          const pageId = marquee.pageId;

          this.modelContext.getLivePage$(pageId)
            .pipe(take(1))
            .subscribe({
              next: (page: { diaryId: any; }) => {
                if (!page) {
                  console.warn(`No page found for id ${pageId}`);
                  return;
                }

                const diaryId = page.diaryId;
                this.router.navigate(['/diary', diaryId, pageId, fragment.id]);
              },
              error: (err: any) => this.handleError(err)
            });
        },
        error: err => this.handleError(err)
      });
  }
}
