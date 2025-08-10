
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { DomSanitizer } from '@angular/platform-browser';
import { ModelContext } from '../../model/model-context';
import { Subject, takeUntil } from 'rxjs';
import { Diary } from '../../model/diary';
import { Page } from '../../model/page';

@Component({
  selector: 'app-pageheader',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './pageheader.component.html',
  styleUrl: './pageheader.component.scss'
})
export class PageheaderComponent implements OnInit, OnDestroy {

  @Output() add = new EventEmitter<void>();
  @Output() view = new EventEmitter<void>();
  @Output() select = new EventEmitter<void>();

  title: string = 'Diaries';
  diary: Diary | null = null;
  page: Page | null = null;  

  private destroy$ = new Subject<void>();

  constructor(
    private modelContext: ModelContext,
    private iconRegistry: MatIconRegistry,
    private sanitizer: DomSanitizer
  ) {
    this.iconRegistry.addSvgIcon('hand-pointer', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/hand-pointer.svg'));
    this.iconRegistry.addSvgIcon('select', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/select.svg'));
    this.iconRegistry.addSvgIcon('cross', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/cross.svg'));
  }

  ngOnInit(): void {
    console.log(`PageheaderComponent.ngOnInit`);

    this.modelContext.selectedDiary$
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(diary => {
        console.log(`PageheaderComponent.ngOnInit: diary: ${JSON.stringify(diary)}`);
        this.diary = diary;
        this.title = `${this.diary.name} - ${this.page?.name} `;
      });

    this.modelContext.selectedPage$
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe(page => {
        console.log(`PageheaderComponent.ngOnInit: page: ${JSON.stringify(page)}`);
        this.page = page;
        this.title = `${this.diary?.name} - ${this.page.name} `;
      });      
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onMenuClick() {
    console.log('Menu button clicked');
  }

  onViewClick() {
    console.log('View button clicked');
    this.view.emit();
  }

  onSelectClick() {
    console.log('Select button clicked');
    this.select.emit();
  }

  onAddClick() {
    console.log('Add button clicked');
    this.add.emit();
  }
}

