import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ImageItem } from '../model/image-item';
import { ConfigService } from '../config/config.service';

@Component({
  selector: 'app-files-list-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    DatePipe
  ],
  templateUrl: './files-list-dialog.component.html',
  styleUrls: ['./files-list-dialog.component.scss']
})
export class FilesListDialogComponent implements OnInit {

  fileOrigin = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ImageItem[] | null,
    private ref: MatDialogRef<FilesListDialogComponent>,
    private configService: ConfigService
  ) {}

  async ngOnInit(): Promise<void> {
    console.group('FilesListDialog items');

    const cfg = await this.configService.getConfig(); // or getConfig$().pipe(take(1)).toPromise()
    // Use only the origin so /uploads/... works regardless of base path
    this.fileOrigin = new URL(cfg.baseUrl).origin;


    console.log('Total:', this.data?.length ?? 0);
    if (this.data?.length) {
      console.table(this.data); // shows name, url, size, mtime
      this.data.forEach((it, i) => console.log(`[${i}] url:`, it.url));
    }
    console.groupEnd();
  }

  resolveUrl(u: string): string {
    try {
      // Works for absolute ("http…"), root-relative ("/uploads/…"), or relative paths
      return new URL(u, this.fileOrigin).toString();
    } catch {
      return u; // fallback
    }
  }

  // Logs *which* image failed to load
  onImgError(ev: Event, item: ImageItem) {
    const img = ev.target as HTMLImageElement;
    console.warn('Preview failed:', { src: img?.src, item });
  }

  close() { this.ref.close(); }
}
