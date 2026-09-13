import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { MatIconRegistry } from '@angular/material/icon';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { FilesListDialogComponent } from './files-list-dialog.component';
import { ConfigService } from '../config/config.service';
import { RpcService } from '../mqtt/rpc.service';
import { fileRpcBaseline } from '../testing/file-rpc-baseline.fixture';

describe('FilesListDialog captured additive compatibility', () => {
  for (const additions of [false, true]) {
    it(`renders captured folders/images, dates and selection (additions=${additions})`, async () => {
      const reply: any = structuredClone(fileRpcBaseline.find(c => c.caseId === 'list-populated-root')!.payload);
      if (additions) {
        reply.catalogueVersion = 1;
        reply.items.forEach((item: any) => {
          item.imageId = item.dir ? null : 101;
          item.image = item.dir ? null : { id: 101, caption: 'Future caption', altText: 'Future alt' };
        });
      }
      const path$ = new BehaviorSubject('/');
      const close = jasmine.createSpy('close');
      await TestBed.configureTestingModule({
        imports: [FilesListDialogComponent],
        providers: [
          { provide: DIALOG_DATA, useValue: { path$, select: true } },
          { provide: DialogRef, useValue: { close } },
          { provide: ConfigService, useValue: { getConfig: () => Promise.resolve({ baseUrl: 'http://localhost/diaries/' }) } },
          { provide: RpcService, useValue: { listFiles$: () => of(reply) } },
          { provide: MatIconRegistry, useValue: {
            addSvgIcon: () => {},
            getNamedSvgIcon: () => of(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
          } },
          { provide: Router, useValue: {} }
        ]
      }).compileComponents();
      const fixture = TestBed.createComponent(FilesListDialogComponent);
      fixture.componentInstance.viewMode = 'details';
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelectorAll('button.file-card.dir').length).toBe(3);
      const images = Array.from(element.querySelectorAll<HTMLAnchorElement>('a.file-card'));
      expect(images.length).toBe(2);
      expect(images[0].href).toBe('http://localhost/files/dated.jpg');
      expect(images[1].textContent).toContain('plain.png');
      expect(images[0].textContent).toContain('2020 Jan 02');
      images[0].click();
      expect(close).toHaveBeenCalledOnceWith({ url: 'http://localhost/files/dated.jpg', name: 'dated.jpg' });
      (element.querySelector('button.file-card.dir') as HTMLButtonElement).click();
      expect(path$.value).toBe('/alpha');
      fixture.destroy();
    });
  }
});
