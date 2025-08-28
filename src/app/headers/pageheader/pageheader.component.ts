
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { DomSanitizer } from '@angular/platform-browser';
import { ModelContext } from '../../model/model-context';
import { Subject, switchMap, take, takeUntil } from 'rxjs';
import { Diary } from '../../model/diary';
import { Page } from '../../model/page';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RpcService } from '../../mqtt/rpc.service';
import { FilesListDialogComponent } from '../../files-list-dialog/files-list-dialog.component';

@Component({
  selector: 'app-pageheader',
  standalone: true,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule
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

  title: string = 'Diaries';
  diary: Diary | null = null;
  page: Page | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private modelContext: ModelContext,
    private iconRegistry: MatIconRegistry,
    private sanitizer: DomSanitizer,
    private rpcService: RpcService,
    private dialog: MatDialog
  ) {
    this.iconRegistry.addSvgIcon('hand-pointer', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/hand-pointer.svg'));
    this.iconRegistry.addSvgIcon('select', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/select.svg'));
    this.iconRegistry.addSvgIcon('cross', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/cross.svg'));
    this.iconRegistry.addSvgIcon('upload', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/upload.svg'));
    this.iconRegistry.addSvgIcon('files', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/files.svg'));
    this.iconRegistry.addSvgIcon('delete', this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/delete.svg'));
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
            data: items ?? []
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

    // Option 1: keep your Output if something else also listens:
    this.listFiles.emit();

    // Option 2 (direct): call RPC and open dialog
    this.rpcService.listFiles$().pipe(take(1)).subscribe({
      next: (items) => {
        this.dialog.open(FilesListDialogComponent, {
          width: '980px',
          data: items ?? []
        });
      },
      error: (err) => {
        console.error('List files failed', err);
        // Optional: surface via your AlertService if you prefer
      }
    });
  }

  onDeleteFileClick() {
    console.log('Delete File button clicked');
    this.deleteFile.emit();
  }
}

