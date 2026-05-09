
import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { DomSanitizer } from '@angular/platform-browser';
import { ModelContext } from '../../model/model-context';
import { Subject, switchMap, take, takeUntil } from 'rxjs';
import { Diary } from '../../model/diary';
import { Page } from '../../model/page';
import { Dialog } from '@angular/cdk/dialog';
import { RpcService } from '../../mqtt/rpc.service';
import { FilesListDialogComponent } from '../../files-list-dialog/files-list-dialog.component';
import { Router } from '@angular/router';
import { AlertService } from '../../alerts/alert.service';

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
  @Output() upload = new EventEmitter<void>();
  @Output() listFiles = new EventEmitter<void>();
  @Output() deleteFile = new EventEmitter<void>();
  @Output() editMarquee = new EventEmitter<void>();

  title: string = 'Diaries';
  diary: Diary | null = null;
  page: Page | null = null;

  editMarqueeMode = false;
  hasSelectedMarquee = false;

  private destroy$ = new Subject<void>();

  constructor(
    private modelContext: ModelContext,
    private iconRegistry: MatIconRegistry,
    private sanitizer: DomSanitizer,
    private rpcService: RpcService,
    private dialog: Dialog,
    private router: Router,
    private alertService: AlertService
  ) {
    this.iconRegistry.addSvgIcon('hand-pointer', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/hand-pointer.svg'));
    this.iconRegistry.addSvgIcon('select', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/select.svg'));
    this.iconRegistry.addSvgIcon('cross', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/cross.svg'));
    this.iconRegistry.addSvgIcon('upload', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/upload.svg'));
    this.iconRegistry.addSvgIcon('files', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/files.svg'));
    this.iconRegistry.addSvgIcon('delete', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/delete.svg'));
    this.iconRegistry.addSvgIcon('edit-marquee', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/edit-marquee.svg'));
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

    this.modelContext.editMarqueeMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.editMarqueeMode = value;
      });

    this.modelContext.hasSelectedMarquee$
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.hasSelectedMarquee = value;
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

  onEditMarqueeClick() {
    console.log('Edit Marquee button clicked');
    this.editMarquee.emit();
  }

  onUploadClick() {
    console.log('Upload button clicked');
    this.upload.emit(); // keep existing Output if others listen

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*'; // limit to images; remove/adjust if you allow other types
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { return; }

      this.rpcService.uploadFile$(file).pipe(
        // after upload, refresh the list and show it
        switchMap(() => this.rpcService.listFiles$()),
        take(1)
      ).subscribe({
        next: (items) => {
          this.dialog.open(FilesListDialogComponent, {
            width: '980px',
            data: items ?? [],
            panelClass: 'files-dialog-panel'   // <- custom hook for styling
          });
        },
        error: (err) => {
          console.error('Upload failed:', err);
          // optionally surface via a toast/snackbar
        }
      });
    };
    input.click();
  }


  onListFilesClick() {
    console.log('List Files button clicked');
    this.listFiles.emit();
  }


  onDeleteFileClick() {
    console.log('Delete File button clicked');
    this.deleteFile.emit();
  }

  // centralised helper (same idea as in ImageViewerComponent)
  private handleAuthError(err: any): boolean {
    if (err?.status === 401) {
      const returnUrl = this.router.url; // capture current route+query
      this.router.navigate(['/signin'], { queryParams: { returnUrl } });
      return true;
    }
    return false;
  }
}

