// src/app/components/files-list-dialog/files-list-dialog.component.ts
import { Component, Inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ImageItem } from '../model/image-item';


@Component({
  selector: 'app-files-list-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, DatePipe],
  template: `
    <div class="p-4" style="max-width: 960px;">
      <h2 class="mb-3">Server uploads ({{data?.length ?? 0}})</h2>

      <div *ngIf="!data?.length" class="opacity-70">No files found.</div>

      <div class="grid"
           style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">
        <a *ngFor="let f of data"
           [href]="f.url" target="_blank" rel="noopener"
           style="display:block;text-decoration:none;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <img [src]="f.url"
               alt="{{f.name}}"
               style="width:100%;height:140px;object-fit:cover;background:#f5f5f5;">
          <div style="padding:.5rem 0.75rem;">
            <div title="{{f.name}}"
                 style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              {{f.name}}
            </div>
            <div style="font-size:12px;opacity:.75">
              {{ f.size | number }} bytes · {{ f.mtime | date:'medium' }}
            </div>
          </div>
        </a>
      </div>

      <div style="text-align:right;margin-top:1rem;">
        <button mat-button (click)="close()">Close</button>
      </div>
    </div>
  `
})
export class FilesListDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ImageItem[] | null,
    private ref: MatDialogRef<FilesListDialogComponent>
  ) {}
  close() { this.ref.close(); }
}
