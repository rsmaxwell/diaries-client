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
  for (const baseUrl of ['http://localhost:8081', 'https://example.test/diaries-responder', 'https://example.test/diaries-responder/']) {
    for (const additions of [false, true]) {
      it(`renders captured folders/images, dates and selection (baseUrl=${baseUrl}, additions=${additions})`, async () => {
        const expectedUrl = baseUrl.replace(/\/$/, '') + '/files/dated.jpg';
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
            { provide: ConfigService, useValue: { getConfig: () => Promise.resolve({ baseUrl }) } },
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
        expect(images[0].href).toBe(expectedUrl);
        expect(images[1].textContent).toContain('plain.png');
        expect(images[0].textContent).toContain('2020 Jan 02');
        images[0].click();
        expect(close).toHaveBeenCalledOnceWith({ url: expectedUrl, name: 'dated.jpg' });
        fixture.componentInstance.viewMode = 'medium';
        fixture.detectChanges();
        expect(element.querySelector<HTMLImageElement>('a.file-card img')!.src).toBe(expectedUrl);
        // The generic file picker still shows the date, even when optional
        // catalogue metadata is available in the listFiles response.
        expect(element.querySelector('a.file-card .file-sub')?.textContent).toContain('2020 Jan 02');
        expect(element.querySelector('a.file-card .catalogue-image-id')).toBeNull();
        expect(fixture.componentInstance.resolveUrl('https://images.example.test/image.jpg'))
          .toBe('https://images.example.test/image.jpg');
        expect(fixture.componentInstance.resolveUrl('/files/a%20b%23c.jpg'))
          .toBe(baseUrl.replace(/\/$/, '') + '/files/a%20b%23c.jpg');
        (element.querySelector('button.file-card.dir') as HTMLButtonElement).click();
        expect(path$.value).toBe('/alpha');
        fixture.destroy();
      });
    }
  }

  it('shows Image IDs for catalogued files in the ordinary List files browser across all five views', async () => {
    const reply: any = structuredClone(fileRpcBaseline.find(c => c.caseId === 'list-populated-root')!.payload);
    const catalogued = reply.items.find((item: any) => item.name === 'dated.jpg');
    catalogued.imageId = 3;
    catalogued.image = { id: 3, originalFilename: 'dated.jpg' };
    const path$ = new BehaviorSubject('/');
    const close = jasmine.createSpy('close');
    await TestBed.configureTestingModule({
      imports: [FilesListDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { path$, select: true } },
        { provide: DialogRef, useValue: { close } },
        { provide: ConfigService, useValue: { getConfig: () => Promise.resolve({ baseUrl: 'http://localhost:8081' }) } },
        { provide: RpcService, useValue: { listFiles$: () => of(reply) } },
        { provide: MatIconRegistry, useValue: {
          addSvgIcon: () => {},
          getNamedSvgIcon: () => of(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
        } },
        { provide: Router, useValue: {} }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(FilesListDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    for (const viewMode of ['large', 'medium', 'small', 'list', 'details'] as const) {
      fixture.componentInstance.viewMode = viewMode;
      fixture.detectChanges();
      const cards = Array.from(element.querySelectorAll<HTMLAnchorElement>('a.file-card'));
      const imageCard = cards.find(card => card.textContent?.includes('dated.jpg'))!;
      const unregisteredCard = cards.find(card => card.textContent?.includes('plain.png'))!;
      expect(imageCard.textContent).withContext(viewMode).toContain('Image ID: 3');
      expect(imageCard.title).withContext(viewMode).toContain('Image ID: 3');
      expect(imageCard.getAttribute('aria-label')).withContext(viewMode).toContain('Image ID 3');
      expect(unregisteredCard.textContent).withContext(viewMode).not.toContain('Image ID:');
    }
    const selected = Array.from(element.querySelectorAll<HTMLAnchorElement>('a.file-card'))
      .find(card => card.textContent?.includes('dated.jpg'))!;
    selected.click();
    expect(close).toHaveBeenCalledOnceWith({ url: 'http://localhost:8081/files/dated.jpg', name: 'dated.jpg' });
    fixture.destroy();
  });

  it('returns persisted catalogue identity in catalogue-image selection mode and blocks uncatalogued files', async () => {
    const baseUrl = 'http://localhost:8081';
    const reply: any = structuredClone(fileRpcBaseline.find(c => c.caseId === 'list-populated-root')!.payload);
    const catalogued = reply.items.find((item: any) => item.name === 'dated.jpg');
    const uncatalogued = reply.items.find((item: any) => item.name === 'plain.png');
    catalogued.imageId = 101;
    catalogued.image = {
      id: 101, version: 0, relativePath: 'dated.jpg', mimeType: 'image/jpeg',
      originalFilename: 'dated.jpg', width: 16, height: 12, checksum: 'ab'.repeat(32), caption: '', altText: ''
    };
    const path$ = new BehaviorSubject('/');
    const close = jasmine.createSpy('close');
    await TestBed.configureTestingModule({
      imports: [FilesListDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { path$, select: true, selectionMode: 'catalogue-image' } },
        { provide: DialogRef, useValue: { close } },
        { provide: ConfigService, useValue: { getConfig: () => Promise.resolve({ baseUrl }) } },
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
    const cards = Array.from(element.querySelectorAll<HTMLAnchorElement>('a.file-card'));
    const datedCard = cards.find(card => card.textContent?.includes('dated.jpg'))!;
    const plainCard = cards.find(card => card.textContent?.includes('plain.png'))!;
    expect(datedCard.getAttribute('aria-disabled')).toBeNull();
    expect(datedCard.getAttribute('aria-label')).toBe('Select catalogued Image dated.jpg, Image ID 101');
    expect(datedCard.title).toBe('dated.jpg — Image ID: 101');
    expect(datedCard.querySelector('.catalogue-image-id')?.textContent?.trim()).toBe('Image ID: 101');
    expect(plainCard.querySelector('.catalogue-image-id')).toBeNull();
    expect(datedCard.tabIndex).toBe(0);
    expect(plainCard.getAttribute('aria-disabled')).toBe('true');
    expect(plainCard.getAttribute('aria-label')).toContain('not registered in the Image catalogue');
    expect(plainCard.getAttribute('tabindex')).toBe('-1');
    expect(plainCard.hasAttribute('href')).toBeFalse();
    expect(plainCard.classList).toContain('selection-disabled');
    expect(plainCard.title).toContain('not registered in the Image catalogue');

    // All chooser display modes show the ID beneath a catalogued filename.
    for (const mode of ['large', 'medium', 'small', 'list'] as const) {
      fixture.componentInstance.viewMode = mode;
      fixture.detectChanges();
      const modeCard = Array.from(element.querySelectorAll<HTMLAnchorElement>('a.file-card'))
        .find(card => card.textContent?.includes('dated.jpg'))!;
      expect(modeCard.querySelector('.catalogue-image-id')?.textContent?.trim())
        .withContext(`Image ID in ${mode} mode`).toBe('Image ID: 101');
      expect(modeCard.querySelector('.file-sub')?.textContent).not.toContain('2020 Jan 02');
    }
    fixture.componentInstance.viewMode = 'details';
    fixture.detectChanges();
    const [restoredDatedCard, restoredPlainCard] = Array.from(
      element.querySelectorAll<HTMLAnchorElement>('a.file-card'));

    restoredPlainCard.click();
    expect(close).not.toHaveBeenCalled();
    restoredDatedCard.click();
    expect(close).toHaveBeenCalledOnceWith({
      url: `${baseUrl}/files/dated.jpg`,
      name: 'dated.jpg',
      imageId: 101,
      image: catalogued.image,
      relativePath: 'dated.jpg'
    });

    close.calls.reset();
    restoredDatedCard.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(close).toHaveBeenCalledOnceWith({
      url: `${baseUrl}/files/dated.jpg`,
      name: 'dated.jpg',
      imageId: 101,
      image: catalogued.image,
      relativePath: 'dated.jpg'
    });
    fixture.destroy();
  });

});
