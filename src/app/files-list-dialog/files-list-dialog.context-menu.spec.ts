import { TestBed, ComponentFixture } from '@angular/core/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatIconRegistry } from '@angular/material/icon';
import { Router } from '@angular/router';
import { BehaviorSubject, of, scheduled, asapScheduler, Subject } from 'rxjs';
import { FilesListDialogComponent } from './files-list-dialog.component';
import { ConfigService } from '../config/config.service';
import { RpcService } from '../mqtt/rpc.service';

describe('Files dialog image context menu', () => {
  let fixture: ComponentFixture<FilesListDialogComponent>;
  let overlay: HTMLElement;
  let close: jasmine.Spy;
  let rpc: { listFiles$: jasmine.Spy; deleteImage$: jasmine.Spy };
  const entries = [
    { name: 'folder.jpg', dir: true },
    { name: 'photo.JPG', dir: false },
    { name: 'second.png', dir: false },
    { name: 'notes.txt', dir: false }
  ].map(file => ({ ...file, size: 1, mtime: 0, dateTaken: 0, url: 'data:,' }));

  beforeEach(async () => {
    close = jasmine.createSpy('close');
    rpc = {
      listFiles$: jasmine.createSpy('listFiles$').and.returnValue(scheduled([{ subdir: 'Diary with spaces/images', items: entries }], asapScheduler)),
      deleteImage$: jasmine.createSpy('deleteImage$')
    };
    await TestBed.configureTestingModule({
      imports: [FilesListDialogComponent],
      providers: [
        { provide: DIALOG_DATA, useValue: { path$: new BehaviorSubject('/Diary with spaces/images'), select: true } },
        { provide: DialogRef, useValue: { close } },
        { provide: ConfigService, useValue: { getConfig: () => Promise.resolve({ baseUrl: 'http://localhost/' }) } },
        { provide: RpcService, useValue: rpc },
        { provide: MatIconRegistry, useValue: {
          addSvgIcon: () => {},
          getNamedSvgIcon: () => of(document.createElementNS('http://www.w3.org/2000/svg', 'svg'))
        } },
        { provide: Router, useValue: {} }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(FilesListDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    overlay = TestBed.inject(OverlayContainer).getContainerElement();
  });

  function open(selector = 'a.file-card'): MouseEvent {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 50 });
    fixture.nativeElement.querySelector(selector).dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }

  for (const mode of ['large', 'medium', 'small', 'list', 'details'] as const) {
    it(`offers Delete image in ${mode} without selecting or deleting`, () => {
      fixture.componentInstance.setView(mode);
      fixture.detectChanges();
      expect(open().defaultPrevented).toBeTrue();
      expect(overlay.querySelector('[role="menuitem"]')?.textContent).toContain('Delete image');
      expect(close).not.toHaveBeenCalled();
      expect(rpc.deleteImage$).not.toHaveBeenCalled();
    });
  }

  it('leaves directories and non-images with their native context menu', () => {
    expect(open('button.dir:not(.parent)').defaultPrevented).toBeFalse();
    expect(overlay.querySelector('[role="menu"]')).toBeNull();
    expect(open('a.file-card:last-of-type').defaultPrevented).toBeFalse();
    expect(overlay.querySelector('[role="menu"]')).toBeNull();
  });

  it('emits the current file and raw directory once when the action is chosen', () => {
    const requested = jasmine.createSpy('requested');
    fixture.componentInstance.deleteImageRequested.subscribe(requested);
    open();
    (overlay.querySelector('[role="menuitem"]') as HTMLElement).click();
    expect(requested).toHaveBeenCalledOnceWith({ name: 'photo.JPG', subdir: 'Diary with spaces/images' });
    expect(close).not.toHaveBeenCalled();
    expect(rpc.deleteImage$).not.toHaveBeenCalled();
    expect(overlay.querySelector('[role="menu"]')).toBeNull();
  });

  it('dismisses with Escape without requesting deletion', () => {
    const requested = jasmine.createSpy('requested');
    fixture.componentInstance.deleteImageRequested.subscribe(requested);
    open();
    overlay.querySelector('[role="menuitem"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    fixture.detectChanges();
    expect(requested).not.toHaveBeenCalled();
    expect(overlay.querySelector('[role="menu"]')).toBeNull();
  });

  it('normalizes the root request and guards ineligible items', () => {
    const requested = jasmine.createSpy('requested');
    fixture.componentInstance.deleteImageRequested.subscribe(requested);
    fixture.componentInstance.subdirPath = '/';
    fixture.componentInstance.requestImageDeletion(entries[0]);
    fixture.componentInstance.requestImageDeletion(entries[3]);
    fixture.componentInstance.requestImageDeletion(entries[2]);
    expect(requested).toHaveBeenCalledOnceWith({ name: 'second.png', subdir: '' });
  });

  function chooseDelete(): void {
    open();
    (overlay.querySelector('[role="menuitem"]') as HTMLElement).click();
    fixture.detectChanges();
  }

  function answer(label: string): void {
    const button = Array.from(overlay.querySelectorAll('button')).find(b => b.textContent?.trim() === label)!;
    button.click();
    fixture.detectChanges();
  }

  it('shows the exact image path and cancellation leaves data unchanged', () => {
    chooseDelete();
    expect(overlay.textContent).toContain('Diary with spaces/images/photo.JPG');
    answer('Cancel');
    expect(rpc.deleteImage$).not.toHaveBeenCalled();
    expect(rpc.listFiles$).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.confirmingDeletion).toBeFalse();
    expect(close).not.toHaveBeenCalled();
  });

  it('treats Escape dismissal of confirmation as cancellation', () => {
    chooseDelete();
    overlay.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    fixture.detectChanges();
    expect(rpc.deleteImage$).not.toHaveBeenCalled();
    expect(fixture.componentInstance.confirmingDeletion).toBeFalse();
  });

  it('closes an outstanding confirmation when the Files dialog is destroyed', () => {
    chooseDelete();
    fixture.destroy();
    expect(overlay.querySelector('[role="dialog"]')).toBeNull();
    expect(rpc.deleteImage$).not.toHaveBeenCalled();
  });

  it('confirms once, blocks duplicate requests, and refreshes the same directory after success', async () => {
    const operation = new Subject<any>();
    rpc.deleteImage$.and.returnValue(operation);
    chooseDelete();
    fixture.componentInstance.requestImageDeletion(entries[2]);
    expect(overlay.querySelectorAll('[role="dialog"]').length).toBe(1);
    answer('Delete image');
    expect(rpc.deleteImage$).toHaveBeenCalledOnceWith('photo.JPG', 'Diary with spaces/images');
    expect(fixture.componentInstance.deleting).toBeTrue();
    fixture.componentInstance.requestImageDeletion(entries[2]);
    fixture.componentInstance.close();
    expect(close).not.toHaveBeenCalled();
    expect(rpc.deleteImage$).toHaveBeenCalledTimes(1);
    rpc.listFiles$.and.returnValue(scheduled([{ subdir: 'Diary with spaces/images', items: entries.filter(e => e.name !== 'photo.JPG') }], asapScheduler));
    operation.next({ id: 85, relativePath: 'Diary with spaces/images/photo.JPG', deleted: true });
    operation.complete();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(rpc.listFiles$).toHaveBeenCalledTimes(2);
    expect(rpc.listFiles$.calls.mostRecent().args).toEqual(['/Diary with spaces/images']);
    expect(fixture.nativeElement.textContent).not.toContain('photo.JPG');
    expect(fixture.componentInstance.deleting).toBeFalse();
    expect(close).not.toHaveBeenCalled();
  });

  it('explains a 409 referenced-Image conflict without exposing server internals', () => {
    const operation = new Subject<any>();
    rpc.deleteImage$.and.returnValue(operation);
    chooseDelete();
    answer('Delete image');
    operation.error({
      status: 409,
      payload: { toString: () => JSON.stringify('Image is referenced by a Fragment. Remove its references before deleting it.') }
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('still referenced by one or more Fragments');
    expect(fixture.nativeElement.textContent).toContain('Clear or delete every Fragment reference');
    expect(rpc.listFiles$).toHaveBeenCalledTimes(1);
  });

  it('keeps the distinct missing-file 409 explanation', () => {
    const operation = new Subject<any>();
    rpc.deleteImage$.and.returnValue(operation);
    chooseDelete();
    answer('Delete image');
    operation.error({
      status: 409,
      payload: { toString: () => JSON.stringify('Image file is missing.') }
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('catalogued file is missing');
  });

  for (const status of [400, 401, 404, 409, 500, undefined]) {
    it(`keeps the dialog usable after deletion error ${status}`, () => {
      const operation = new Subject<any>();
      rpc.deleteImage$.and.returnValue(operation);
      chooseDelete();
      answer('Delete image');
      operation.error({ status, message: 'private server path' });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('private server path');
      expect(fixture.componentInstance.deleting).toBeFalse();
      expect(rpc.deleteImage$).toHaveBeenCalledTimes(1);
      expect(rpc.listFiles$).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      fixture.componentInstance.close();
      expect(close).toHaveBeenCalledTimes(1);
    });
  }
});
