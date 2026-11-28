import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';
import { catchError, combineLatest, from, map, Observable, of, shareReplay, startWith, Subject, take, takeUntil } from 'rxjs';
import { ModelContext } from '../model/model-context';
import { effectiveFragmentType, Fragment, hasAuthoritativePage, safeImageLinkUrl } from '../model/fragment';
import { CatalogueImage } from '../model/image';
import { CommonModule } from '@angular/common';
import { DateFormatter } from '../utilities/DateFormatter';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatTableDataSource } from '@angular/material/table';
import { RpcService } from '../mqtt/rpc.service';
import { AlertService } from '../alerts/alert.service';
import { Router } from '@angular/router';
import { SafeHtmlPipe } from '../utilities/safe-html.pipe';
import { FragmentReorderService } from '../fragment/fragment-reorder.service';
import { ConfigService } from '../config/config.service';
import { buildLegacyImageBaseUrl, LegacyFragmentHtmlPipe } from '../utilities/legacy-fragment-html.pipe';
import { buildCatalogueImageUrl } from '../utilities/catalogue-image-url';

interface ReaderImagePreview {
  url: string | null;
  alt: string;
}


@Component({
  selector: 'app-diary',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    SafeHtmlPipe,
    LegacyFragmentHtmlPipe
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

  dataSource = new MatTableDataSource<Fragment>();
  reorderInFlight = false;
  selectedFragmentId: number | null = null;
  legacyImageBaseUrl = '';
  private readonly readerImageCache = new Map<number, Observable<ReaderImagePreview>>();

  @ViewChildren('fragmentItem', { read: ElementRef })
  private fragmentItems!: QueryList<ElementRef<HTMLElement>>;

  private destroy$ = new Subject<void>();

  constructor(
    private rpcService: RpcService,
    private modelContext: ModelContext,
    private alertService: AlertService,
    private router: Router,
    private fragmentReorderService: FragmentReorderService,
    private configService: ConfigService
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

        this.scrollSelectedFragmentIntoView();
      });

    combineLatest([
      this.modelContext.selectedDiary$,
      from(this.configService.getConfig())
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([diary, config]) => {
        this.legacyImageBaseUrl = buildLegacyImageBaseUrl(
          config.baseUrl,
          config.files,
          diary.name
        );
      });

    this.modelContext.selectedFragment$
      .pipe(takeUntil(this.destroy$))
      .subscribe(fragment => {
        this.selectedFragmentId = fragment?.id ?? null;
        this.scrollSelectedFragmentIntoView();
      });
  }

  ngOnDestroy(): void {
    console.log(`DayviewComponent.ngOnDestroy`);
    this.destroy$.next();
    this.destroy$.complete();
  }

  async drop(event: CdkDragDrop<Fragment[]>): Promise<void> {
    if (this.reorderInFlight) return;
    const plan = this.fragmentReorderService.plan(this.dataSource.data, event.previousIndex, event.currentIndex);
    if (!plan) return;

    this.reorderInFlight = true;
    try {
      const saved = await this.fragmentReorderService.persist(plan, items => this.dataSource.data = items);
      if (!saved) this.dataSource.data = plan.original;
    } catch (err) {
      this.dataSource.data = plan.original;
      this.handleError(err);
    } finally {
      this.reorderInFlight = false;
    }
  }


  fragmentTypeLabel(fragment: Fragment): 'TEXT' | 'MARQUEE' | 'IMAGE' {
    return effectiveFragmentType(fragment);
  }

  imageReferenceLabel(fragment: Fragment): string | null {
    if (effectiveFragmentType(fragment) !== 'IMAGE') {
      return null;
    }

    return Number.isInteger(fragment.imageId) && (fragment.imageId as number) > 0
      ? `Image ID: ${fragment.imageId}`
      : 'No Image selected';
  }

  /** Resolve each day-list IMAGE independently of the selected editor fragment. */
  imagePreview$(fragment: Fragment): Observable<ReaderImagePreview> | null {
    if (effectiveFragmentType(fragment) !== 'IMAGE' ||
        !Number.isInteger(fragment.imageId) || (fragment.imageId as number) <= 0) {
      return null;
    }

    const imageId = fragment.imageId as number;
    const cached = this.readerImageCache.get(imageId);
    if (cached) return cached;

    const preview$ = combineLatest([
      this.modelContext.getLiveImage$(imageId).pipe(startWith(null)),
      from(this.configService.getConfig()).pipe(catchError(() => of(null)))
    ]).pipe(
      map(([candidate, config]): ReaderImagePreview => {
        const image: CatalogueImage | null = candidate?.id === imageId ? candidate : null;
        return {
          url: image && config
            ? buildCatalogueImageUrl(config.baseUrl, config.files, image.relativePath)
            : null,
          alt: image?.altText || image?.originalFilename || `Image ${imageId}`
        };
      }),
      catchError(() => of({ url: null, alt: `Image ${imageId}` })),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    this.readerImageCache.set(imageId, preview$);
    return preview$;
  }

  safeExternalImageLink(fragment: Fragment): string | null {
    return effectiveFragmentType(fragment) === 'IMAGE'
      ? safeImageLinkUrl(fragment.imageLinkUrl)
      : null;
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

    this.modelContext.setFragmentId(fragment.id);
    // ModelContext is the single authority for Fragment -> Marquee selection.
    // A MARQUEE Fragment resolves its matching retained Marquee; an IMAGE
    // Fragment resolves to no Marquee. Clearing here would erase valid MARQUEE
    // selection before that relationship can be applied.

    if (!hasAuthoritativePage(fragment)) {
      this.alertService.error(`Fragment ${fragment.id} has no authoritative source page`);
      return;
    }

    const pageId = fragment.pageId;
    this.modelContext.getLivePage$(pageId)
      .pipe(take(1))
      .subscribe({
        next: (page) => {
          if (!page) {
            this.alertService.error(`Source page ${pageId} is unavailable`);
            return;
          }

          this.router.navigate(['/diary', page.diaryId, pageId, fragment.id]);
        },
        error: err => this.handleError(err)
      });
  }

  private scrollSelectedFragmentIntoView(): void {
    queueMicrotask(() => {
      const selectedId = this.selectedFragmentId;
      if (!Number.isFinite(selectedId) || !this.fragmentItems) {
        return;
      }

      const selected = this.fragmentItems.find(item =>
        Number(item.nativeElement.dataset['fragmentId']) === selectedId
      );
      selected?.nativeElement.scrollIntoView({ block: 'nearest' });
    });
  }
}
