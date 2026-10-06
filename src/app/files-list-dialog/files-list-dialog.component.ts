import { Component, DestroyRef, EventEmitter, Inject, OnInit, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DeleteImageConfirmationComponent } from './delete-image-confirmation.component';
import { CdkMenuModule } from '@angular/cdk/menu';
import { CommonModule, DatePipe } from '@angular/common';

import { Router } from '@angular/router';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';

import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { DomSanitizer } from '@angular/platform-browser';
import { FileEntry, hasCatalogueImage } from '../model/FileEntry';
import { CatalogueImage } from '../model/image';
import { ConfigService } from '../config/config.service';
import { RpcService } from '../mqtt/rpc.service';
import {
  BehaviorSubject, EMPTY, Observable, of, combineLatest, defer
} from 'rxjs';
import {
  switchMap, map, catchError, finalize, tap, shareReplay,
  distinctUntilChanged, startWith
} from 'rxjs/operators';

type ViewMode = 'large' | 'medium' | 'small' | 'list' | 'details';

export type FileSelectionMode = 'file' | 'catalogue-image';

export interface FileSelection {
  url: string;
  name: string;
  imageId?: number;
  image?: CatalogueImage | null;
  relativePath?: string;
}

export interface FilesListDialogData {
  path$: BehaviorSubject<string>;
  select?: boolean;
  selectionMode?: FileSelectionMode;
}

export interface ImageDeletionRequest {
  name: string;
  subdir: string;
}

@Component({
  selector: 'app-files-list-dialog',
  standalone: true,
  imports: [
    CommonModule,
    CdkMenuModule,
    DatePipe,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule
  ],
  templateUrl: './files-list-dialog.component.html',
  styleUrls: ['./files-list-dialog.component.scss'],
})
export class FilesListDialogComponent implements OnInit {
  private readonly dialogs = inject(Dialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh$ = new BehaviorSubject(0);
  confirmingDeletion = false;
  deleting = false;
  deletionError?: string;

  @Output() readonly deleteImageRequested = new EventEmitter<ImageDeletionRequest>();

  canRequestImageDeletion(file: FileEntry): boolean {
    // UI affordance only. The responder's catalogue lookup remains authoritative.
    return !file.dir && /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(file.name);
  }

  requestImageDeletion(file: FileEntry): void {
    if (this.confirmingDeletion || this.deleting || this.loading || !this.canRequestImageDeletion(file)) return;
    const request = { name: file.name, subdir: this.subdirPath.replace(/^\/+/, '') };
    this.confirmingDeletion = true;
    this.deleteImageRequested.emit(request);
    const confirmation = this.dialogs.open<boolean>(DeleteImageConfirmationComponent, {
      data: [request.subdir, request.name].filter(Boolean).join('/'),
      ariaLabelledBy: 'delete-image-title', autoFocus: 'first-tabbable', width: '420px', maxWidth: '90vw'
    });
    const unregister = this.destroyRef.onDestroy(() => confirmation.close());
    confirmation.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      unregister();
      this.confirmingDeletion = false;
      if (confirmed !== true) return;
      this.deleting = true;
      this.deletionError = undefined;
      const previousDisableClose = this.ref.disableClose;
      this.ref.disableClose = true;
      defer(() => this.rpc.deleteImage$(request.name, request.subdir)).pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => { this.deleting = false; this.ref.disableClose = previousDisableClose; })
      ).subscribe({
        next: () => this.refreshDirectory(),
        error: err => {
          const messages: Record<number, string> = {
            400: 'The image path is invalid.',
            401: 'You need to sign in with an active editor account to delete images.',
            404: 'This image is no longer in the catalogue. Refresh the folder to check its current state.',
            500: 'Deletion could not be confirmed. Refresh the folder and ask an administrator to check before retrying.'
          };
          this.deletionError = err?.status === 409
            ? this.imageDeletionConflictMessage(err)
            : messages[err?.status] ?? 'Deletion could not be confirmed. Refresh the folder to check before retrying.';
        }
      });
    });
  }

  private imageDeletionConflictMessage(err: any): string {
    try {
      const payloadText = err?.payload?.toString?.();
      const payload = payloadText ? JSON.parse(payloadText) : null;
      if (typeof payload === 'string' && /referenced/i.test(payload)) {
        return 'This Image is still referenced by one or more Fragments. Clear or delete every Fragment reference before deleting the Image.';
      }
      if (typeof payload === 'string' && /missing/i.test(payload)) {
        return 'This Image cannot be deleted because its catalogued file is missing. Refresh and reconcile the Image catalogue before retrying.';
      }
    } catch {
      // The responder status remains authoritative even if its optional payload cannot be decoded.
    }

    return 'This Image cannot be deleted because it is still referenced by a Fragment or its catalogued file is missing.';
  }

  refreshDirectory(): void { this.refresh$.next(this.refresh$.value + 1); }

  loading = false;
  error?: string;
  subdirPath = '/';
  fileBaseUrl = '';
  viewMode: ViewMode = 'medium';

  items$!: Observable<FileEntry[]>;
  isEmpty$!: Observable<boolean>;
  fileCount$!: Observable<number>;

  readonly modes: Array<{ value: ViewMode; label: string; icon: string }> = [
    { value: 'large', label: 'Large', icon: 'large' },
    { value: 'medium', label: 'Medium', icon: 'medium' },
    { value: 'small', label: 'Small', icon: 'small' },
    { value: 'details', label: 'Details', icon: 'details' },
    { value: 'list', label: 'List', icon: 'list' },
  ];

  readonly modesByValue: Record<ViewMode, { label: string; icon: string }> =
    this.modes.reduce((acc, m) => { acc[m.value] = { label: m.label, icon: m.icon }; return acc; }, {} as Record<ViewMode, { label: string; icon: string }>);

  constructor(
    @Inject(DIALOG_DATA)
    public data: FilesListDialogData,
    private ref: DialogRef<FileSelection, FilesListDialogComponent>,
    private configService: ConfigService,
    private rpc: RpcService,
    private iconRegistry: MatIconRegistry,
    private sanitizer: DomSanitizer,
    private router: Router,
  ) {

    this.iconRegistry.addSvgIcon(
      'large',
      this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/large.svg')
    );
    this.iconRegistry.addSvgIcon(
      'medium',
      this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/medium.svg')
    );
    this.iconRegistry.addSvgIcon(
      'small',
      this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/small.svg')
    );
    this.iconRegistry.addSvgIcon(
      'details',
      this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/details.svg')
    );
    this.iconRegistry.addSvgIcon(
      'list',
      this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/list.svg')
    );
    this.iconRegistry.addSvgIcon(
      'folder',
      this.sanitizer.bypassSecurityTrustResourceUrl('assets/icons/folder.svg')
    );
  }

  get isCatalogueImageSelectionMode(): boolean {
    return this.data?.select === true && this.data.selectionMode === 'catalogue-image';
  }

  canSelectFile(file: FileEntry): boolean {
    if (!this.data?.select || file.dir) return false;
    return !this.isCatalogueImageSelectionMode || hasCatalogueImage(file);
  }

  selectionTitle(file: FileEntry): string {
    if (this.isCatalogueImageSelectionMode && !hasCatalogueImage(file)) {
      return `${file.name} — not registered in the Image catalogue`;
    }
    return file.name;
  }

  fileAriaLabel(file: FileEntry): string {
    if (this.isCatalogueImageSelectionMode) {
      return hasCatalogueImage(file)
        ? `Select catalogued Image ${file.name}`
        : `${file.name}, not registered in the Image catalogue`;
    }
    return this.data?.select ? `Select file ${file.name}` : file.name;
  }

  onFileSpace(file: FileEntry, ev: Event): void {
    if (!this.data?.select || !this.canSelectFile(file)) return;
    ev.preventDefault();
    this.onFileClick(file, ev);
  }

  // add a click helper
  onFileClick(file: FileEntry, ev?: Event): void {
    if (this.deleting) { ev?.preventDefault(); return; }
    if (!this.data?.select) return;         // normal open-in-new-tab behaviour
    ev?.preventDefault();
    ev?.stopPropagation();
    if (!this.canSelectFile(file)) return;

    const url = this.resolveUrl(file.url ?? undefined);
    if (!this.isCatalogueImageSelectionMode) {
      // Preserve the historical generic-file selection contract exactly.
      this.ref.close({ url, name: file.name });
      return;
    }

    this.ref.close({
      url,
      name: file.name,
      imageId: file.imageId as number,
      image: file.image ?? null,
      ...(file.image?.relativePath ? { relativePath: file.image.relativePath } : {})
    });
  }

  async ngOnInit(): Promise<void> {
    const cfg = await this.configService.getConfig();
    this.fileBaseUrl = cfg.baseUrl.replace(/\/+$/, '') + '/';

    this.items$ = combineLatest([this.data.path$.pipe(distinctUntilChanged()), this.refresh$]).pipe(
      tap(() => { this.loading = true; this.error = undefined; }),
      switchMap(([path]) =>
        this.rpc.listFiles$(path).pipe(
          tap(res => this.subdirPath = res.subdir || '/'),
          map(res => res.items),
//          tap(items => {
//            console.group('FilesListDialog');
//            console.log('Subdir:', this.subdirPath, 'Total:', items.length);
//            if (items.length) console.table(items);
//            console.groupEnd();
//          }),
          catchError(err => {
            // 1) If it's a 401, redirect to signin and stop this load
            if (this.handleAuthError(err)) {
              this.ref.close();       // close the dialog before navigating
              return EMPTY;           // completes inner stream, triggers finalize()
            }

            // 2) Otherwise, surface an error and keep the UI alive
            this.error = String(err?.message ?? err);
            return of([] as FileEntry[]);
          }),
          finalize(() => { this.loading = false; })
        )
      ),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.isEmpty$ = this.items$.pipe(
      map(items => !this.loading && items.length === 0),
      startWith(false)
    );

    this.fileCount$ = this.items$.pipe(
      map(items => items.filter(i => !i.dir).length),
      startWith(0)
    );
  }



  private handleAuthError(err: any): boolean {
    if (err?.status === 401) {
      const returnUrl = this.router.url;
      this.router.navigate(['/signin'], { queryParams: { returnUrl } });
      return true;
    }
    return false;
  }

  // ---- Directory navigation ----
  navigateTo(nameOrAbs: string): void {
    const next = nameOrAbs.startsWith('/') ? this.normalize(nameOrAbs) : this.join(this.subdirPath, nameOrAbs);
    if (next !== this.data.path$.value) this.data.path$.next(next);
  }
  navigateUp(): void { this.data.path$.next(this.parentOf(this.subdirPath)); }

  // ---- View mode helpers ----
  setView(mode: ViewMode): void { this.viewMode = mode; }
  isActive(mode: ViewMode): boolean { return this.viewMode === mode; }
  onModeSelect(val: unknown): void { this.setView(val as ViewMode); } // wire from (selectionChange)

  // ---- URL helpers ----
  resolveUrl(u?: string | null): string {
    if (!u) return '';
    // ListFiles paths are relative to the responder, including its proxy prefix.
    try { return new URL(u.replace(/^\/(?!\/)/, ''), this.fileBaseUrl).toString(); }
    catch { return ''; }
  }



  
  // ---- Path helpers ----
  private normalize(p: string): string {
    if (!p) return '/';

    // Trim + normalize slashes
    let s = p.trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/');

    // Ensure leading slash
    if (!s.startsWith('/')) s = '/' + s;

    // Resolve dot segments
    const out: string[] = [];
    for (const seg of s.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') { if (out.length) out.pop(); continue; }
      out.push(seg);
    }
    return out.length ? '/' + out.join('/') : '/';
  }

  private join(base: string, child: string): string {
    base = this.normalize(base);
    child = child.replace(/^\/+/, ''); // make child relative
    return this.normalize((base === '/' ? '' : base) + '/' + child);
  }

  private parentOf(p: string): string {
    p = this.normalize(p);
    if (p === '/') return '/';
    const parts = p.split('/'); // ["", "a", "b", "c"]
    const up = '/' + parts.slice(1, -1).join('/');
    return up === '' ? '/' : up;
  }

  trackByName = (_: number, it: FileEntry) => it.name;

  get parentSubdir(): string | null {
    const up = this.parentOf(this.subdirPath);
    return up === this.subdirPath ? null : up;
  }

  // Keep image error logging
  onImgError(ev: Event, item: FileEntry): void {
    const img = ev.target as HTMLImageElement;
    console.warn('Preview failed:', { requested: item.url, resolved: this.resolveUrl(item.url), src: img?.src });
  }

  close(): void { if (!this.deleting) this.ref.close(); }
}


