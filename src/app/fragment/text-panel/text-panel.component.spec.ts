import { BehaviorSubject, Subject } from 'rxjs';

import { Fragment, UpdateFragmentRequest } from '../../model/fragment';
import { TextPanelComponent } from './text-panel.component';

describe('TextPanelComponent', () => {
  const fragment = (overrides: Partial<Fragment> = {}): Fragment => ({
    id: 17,
    marqueeId: 23,
    year: 1942,
    month: 8,
    day: 9,
    sequence: 1000,
    version: 4,
    text: '<p>Original text</p>',
    lock: {
      lockUserId: 7,
      lockUserName: 'reader',
      lockKnownAs: 'Reader',
      lockTimeStamp: 1,
      lockSessionId: 'session-1'
    },
    ...overrides
  });

  function createComponent(updateResult$ = new Subject<Fragment>()) {
    const selectedFragment$ = new BehaviorSubject<Fragment | null>(null);
    const selectedDiary$ = new BehaviorSubject({ id: 3, version: 1, sequence: 3, name: 'diary-1831' });
    const rpcService = {
      updateFragment$: jasmine.createSpy('updateFragment$').and.returnValue(updateResult$),
      updateImageFragment$: jasmine.createSpy('updateImageFragment$').and.returnValue(updateResult$)
    };
    const accessTokenService = {
      userId: 7,
      username: 'reader',
      knownAs: 'Reader',
      sessionId: 'session-1',
      clearToken: jasmine.createSpy('clearToken')
    };

    const fragmentLockService = {
      lockFragmentForEdit: jasmine.createSpy('lockFragmentForEdit').and.resolveTo(true),
      unlockFragment: jasmine.createSpy('unlockFragment').and.resolveTo(true),
      unlockFragmentAfterFailedEdit: jasmine.createSpy('unlockFragmentAfterFailedEdit').and.resolveTo()
    };

    const component = new TextPanelComponent(
      { selectedFragment$, selectedDiary$ } as any,
      rpcService as any,
      { open: jasmine.createSpy('open') } as any,
      accessTokenService as any,
      { clearToken: jasmine.createSpy('clearToken') } as any,
      { url: '/diary/1/2/17', navigateByUrl: jasmine.createSpy('navigateByUrl') } as any,
      fragmentLockService as any,
      {
        getConfig: jasmine.createSpy('getConfig').and.resolveTo({
          baseUrl: 'https://example.test/diaries-responder',
          files: 'files'
        })
      } as any
    );

    return { component, rpcService, updateResult$, selectedFragment$, fragmentLockService };
  }

  it('distinguishes a lock owned by another session for read-only presentation', () => {
    const { component } = createComponent();
    component.fragment = fragment({
      lock: {
        lockUserId: 8,
        lockUserName: 'archivist',
        lockKnownAs: 'Archivist',
        lockTimeStamp: 2,
        lockSessionId: 'session-2'
      }
    });

    expect(component.isLockedByMe).toBeFalse();
    expect(component.isLockedByOther).toBeTrue();
    expect(component.lockButtonText).toBe('Locked by Archivist');
  });

  it('exposes save progress and prevents a duplicate update request', () => {
    const { component, rpcService, updateResult$ } = createComponent();
    component.fragment = fragment();
    (component as any).currentFragment = component.fragment;
    (component as any).originalYear = component.fragment.year;
    (component as any).originalMonth = component.fragment.month;
    (component as any).originalDay = component.fragment.day;
    component.form.get('body')!.setValue('<p>Edited text</p>');

    component.onSave();
    component.onSave();

    expect(component.saveInFlight).toBeTrue();
    expect(rpcService.updateFragment$).toHaveBeenCalledTimes(1);

    updateResult$.next(component.fragment);
    updateResult$.complete();

    expect(component.saveInFlight).toBeFalse();
    expect(component.fragment?.lock).toBeNull();
  });

  it('resolves legacy images for editing and restores the legacy URL when saving', async () => {
    const { component, rpcService, updateResult$, selectedFragment$ } = createComponent();
    component.ngOnInit();
    selectedFragment$.next(fragment({
      text: '<figure><img src="images/img2753-image-white-swan-alnwick.png"></figure>'
    }));
    await Promise.resolve();

    const editorText = component.form.get('body')!.value as string;
    expect(editorText).toContain(
      'https://example.test/diaries-responder/files/diary-1831/images/img2753-image-white-swan-alnwick.png'
    );
    expect(component.hasEdits).toBeFalse();

    component.form.get('body')!.setValue(editorText.replace('</figure>', '<figcaption>White Swan</figcaption></figure>'));
    component.onSave();

    const payload = rpcService.updateFragment$.calls.mostRecent().args[0] as Fragment;
    expect(payload.text).toContain('src="images/img2753-image-white-swan-alnwick.png"');
    expect(payload.text).toContain('<figcaption>White Swan</figcaption>');

    updateResult$.next(payload);
    updateResult$.complete();
    component.ngOnDestroy();
  });

  it('keeps IMAGE text saves on the ordinary preserve path with imageId omitted on the wire request', () => {
    const { component, rpcService } = createComponent();
    component.fragment = fragment({
      pageId: 12,
      type: 'IMAGE',
      imageId: 101,
      marqueeId: null
    });
    (component as any).currentFragment = component.fragment;
    (component as any).originalYear = component.fragment.year;
    (component as any).originalMonth = component.fragment.month;
    (component as any).originalDay = component.fragment.day;
    component.form.get('body')!.setValue('<p>Edited IMAGE text</p>');

    component.onSave();

    expect(rpcService.updateFragment$).toHaveBeenCalledTimes(1);
    expect(rpcService.updateImageFragment$).not.toHaveBeenCalled();

    const payload = rpcService.updateFragment$.calls.mostRecent().args[0] as Fragment;
    expect(payload.type).toBe('IMAGE');
    expect(payload.imageId).toBe(101);

    const wireRequest = UpdateFragmentRequest.fromFragment(payload);
    expect(Object.hasOwn(wireRequest, 'marqueeId')).toBeFalse();
    expect(Object.hasOwn(wireRequest, 'imageId')).toBeFalse();
  });


  it('locks an IMAGE Fragment for body editing and preserves its Image identity', async () => {
    const { component, fragmentLockService } = createComponent();
    const image = fragment({
      pageId: 12,
      type: 'IMAGE',
      imageId: 101,
      marqueeId: null,
      lock: null
    });
    component.fragment = image;

    await (component as any).lockCurrentFragmentForBodyEdit(image.id);

    expect(fragmentLockService.lockFragmentForEdit).toHaveBeenCalledOnceWith(image.id);
    expect(component.fragment?.type).toBe('IMAGE');
    expect(component.fragment?.imageId).toBe(101);
    expect(component.isLockedByMe).toBeTrue();
  });

  it('unlocks the original IMAGE Fragment if its body lock completes after selection switches type', async () => {
    let resolveLock!: (value: boolean) => void;
    const pendingLock = new Promise<boolean>(resolve => resolveLock = resolve);
    const { component, fragmentLockService } = createComponent();
    fragmentLockService.lockFragmentForEdit.and.returnValue(pendingLock);

    const image = fragment({
      id: 17,
      pageId: 12,
      type: 'IMAGE',
      imageId: 101,
      marqueeId: null,
      lock: null
    });
    const marquee = fragment({ id: 18, type: 'MARQUEE', imageId: null, marqueeId: 24, lock: null });
    component.fragment = image;

    const acquiring = (component as any).lockCurrentFragmentForBodyEdit(image.id) as Promise<void>;
    component.fragment = marquee;
    resolveLock(true);
    await acquiring;

    expect(fragmentLockService.unlockFragment).toHaveBeenCalledOnceWith(
      image.id,
      'body edit lock completed after fragment switch'
    );
    expect(component.fragment?.id).toBe(marquee.id);
    expect(component.fragment?.type).toBe('MARQUEE');
    expect(component.fragment?.lock).toBeNull();
  });

  it('releases a late IMAGE body lock if the editor is destroyed while lock acquisition is in flight', async () => {
    let resolveLock!: (value: boolean) => void;
    const pendingLock = new Promise<boolean>(resolve => resolveLock = resolve);
    const { component, fragmentLockService } = createComponent();
    fragmentLockService.lockFragmentForEdit.and.returnValue(pendingLock);

    const image = fragment({
      pageId: 12,
      type: 'IMAGE',
      imageId: 101,
      marqueeId: null,
      lock: null
    });
    component.fragment = image;

    const acquiring = (component as any).lockCurrentFragmentForBodyEdit(image.id) as Promise<void>;
    component.ngOnDestroy();
    resolveLock(true);
    await acquiring;

    expect(fragmentLockService.unlockFragment).toHaveBeenCalledOnceWith(
      image.id,
      'body edit lock completed after editor destroy'
    );
    expect(component.isLockedByMe).toBeFalse();
  });

  it('edits an IMAGE Fragment date through the ordinary update path and preserves imageId', async () => {
    const { component, rpcService, fragmentLockService } = createComponent();
    const image = fragment({
      pageId: 12,
      type: 'IMAGE',
      imageId: 101,
      marqueeId: null,
      lock: null
    });
    component.fragment = image;
    (component as any).currentFragment = image;
    (component as any).originalYear = image.year;
    (component as any).originalMonth = image.month;
    (component as any).originalDay = image.day;
    (component as any).editorServerText = image.text;
    component.form.get('body')!.setValue(image.text, { emitEvent: false });
    component.picker = { open: jasmine.createSpy('open') } as any;

    await component.editDate();
    component.onDateSelected({ value: new Date(1943, 0, 2) } as any);
    component.onSave();

    expect(fragmentLockService.lockFragmentForEdit).toHaveBeenCalledOnceWith(image.id);
    expect(rpcService.updateFragment$).toHaveBeenCalledTimes(1);
    expect(rpcService.updateImageFragment$).not.toHaveBeenCalled();

    const payload = rpcService.updateFragment$.calls.mostRecent().args[0] as Fragment;
    expect(payload.year).toBe(1943);
    expect(payload.month).toBe(1);
    expect(payload.day).toBe(2);
    expect(payload.imageId).toBe(101);
    const wireRequest = UpdateFragmentRequest.fromFragment(payload);
    expect(Object.hasOwn(wireRequest, 'marqueeId')).toBeFalse();
    expect(Object.hasOwn(wireRequest, 'imageId')).toBeFalse();
  });

  it('releases an IMAGE date-edit lock when the picker closes without changes', async () => {
    const { component, fragmentLockService } = createComponent();
    const image = fragment({
      pageId: 12,
      type: 'IMAGE',
      imageId: 101,
      marqueeId: null,
      lock: null
    });
    component.fragment = image;
    (component as any).originalYear = image.year;
    (component as any).originalMonth = image.month;
    (component as any).originalDay = image.day;
    (component as any).editorServerText = image.text;
    component.form.get('body')!.setValue(image.text, { emitEvent: false });
    component.picker = { open: jasmine.createSpy('open') } as any;

    await component.editDate();
    component.onDatePickerClosed();
    await Promise.resolve();

    expect(fragmentLockService.unlockFragment).toHaveBeenCalledOnceWith(
      image.id,
      'date picker closed without edits'
    );
  });

  it('does not unlock or rewrite the newly selected Fragment when an earlier save succeeds', async () => {
    const saveResult$ = new Subject<number>();
    const { component, selectedFragment$, fragmentLockService } = createComponent(saveResult$ as any);
    component.ngOnInit();

    const image = fragment({ pageId: 12, type: 'IMAGE', imageId: 101, marqueeId: null });
    const marquee = fragment({
      id: 18,
      type: 'MARQUEE',
      imageId: null,
      marqueeId: 24,
      lock: {
        lockUserId: 7,
        lockUserName: 'reader',
        lockKnownAs: 'Reader',
        lockTimeStamp: 2,
        lockSessionId: 'session-1'
      }
    });

    selectedFragment$.next(image);
    await Promise.resolve();
    await Promise.resolve();
    component.form.get('body')!.setValue('<p>IMAGE save in flight</p>', { emitEvent: false });
    component.onSave();

    selectedFragment$.next(marquee);
    await Promise.resolve();
    expect(fragmentLockService.unlockFragment).not.toHaveBeenCalledWith(image.id, 'switching fragment');

    saveResult$.next(17);
    saveResult$.complete();

    expect(component.fragment?.id).toBe(marquee.id);
    expect(component.fragment?.type).toBe('MARQUEE');
    expect(component.fragment?.lock?.lockSessionId).toBe('session-1');
    component.ngOnDestroy();
  });

  it('does not race an in-flight IMAGE save with a destroy-time unlock', () => {
    const saveResult$ = new Subject<number>();
    const { component, fragmentLockService } = createComponent(saveResult$ as any);
    const image = fragment({ pageId: 12, type: 'IMAGE', imageId: 101, marqueeId: null });
    component.fragment = image;
    (component as any).currentFragment = image;
    (component as any).originalYear = image.year;
    (component as any).originalMonth = image.month;
    (component as any).originalDay = image.day;
    (component as any).editorServerText = image.text;
    component.form.get('body')!.setValue('<p>IMAGE save in flight</p>', { emitEvent: false });

    component.onSave();
    component.ngOnDestroy();

    expect(fragmentLockService.unlockFragment).not.toHaveBeenCalledWith(image.id, 'destroy');

    saveResult$.next(image.id);
    saveResult$.complete();
    expect(fragmentLockService.unlockFragmentAfterFailedEdit).not.toHaveBeenCalled();
  });

  it('keeps a new selection intact and unlocks the original Fragment when an earlier save fails', async () => {
    const saveResult$ = new Subject<number>();
    const { component, selectedFragment$, fragmentLockService } = createComponent(saveResult$ as any);
    component.ngOnInit();

    const image = fragment({ pageId: 12, type: 'IMAGE', imageId: 101, marqueeId: null });
    const marquee = fragment({ id: 18, type: 'MARQUEE', imageId: null, marqueeId: 24, lock: null });

    selectedFragment$.next(image);
    await Promise.resolve();
    await Promise.resolve();
    component.form.get('body')!.setValue('<p>IMAGE save in flight</p>', { emitEvent: false });
    component.onSave();

    selectedFragment$.next(marquee);
    await Promise.resolve();
    saveResult$.error(new Error('update failed'));

    expect(component.fragment?.id).toBe(marquee.id);
    expect(component.fragment?.type).toBe('MARQUEE');
    expect(fragmentLockService.unlockFragmentAfterFailedEdit).toHaveBeenCalledOnceWith(image.id);
    component.ngOnDestroy();
  });

  it('rolls back the same IMAGE Fragment and invokes failed-edit unlock after an update failure', () => {
    const saveResult$ = new Subject<number>();
    const { component, fragmentLockService, rpcService } = createComponent(saveResult$ as any);
    const image = fragment({ pageId: 12, type: 'IMAGE', imageId: 101, marqueeId: null });
    component.fragment = image;
    (component as any).currentFragment = image;
    (component as any).originalYear = image.year;
    (component as any).originalMonth = image.month;
    (component as any).originalDay = image.day;
    (component as any).editorServerText = image.text;
    component.form.get('body')!.setValue('<p>Edited IMAGE text</p>', { emitEvent: false });

    component.onSave();
    saveResult$.error(new Error('update failed'));

    expect(component.fragment?.id).toBe(image.id);
    expect(component.fragment?.imageId).toBe(101);
    expect(component.fragment?.text).toBe(image.text);
    expect(fragmentLockService.unlockFragmentAfterFailedEdit).toHaveBeenCalledOnceWith(image.id);
    expect(rpcService.updateImageFragment$).not.toHaveBeenCalled();
  });

});
