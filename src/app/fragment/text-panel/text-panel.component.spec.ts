import { BehaviorSubject, Subject } from 'rxjs';

import { Fragment } from '../../model/fragment';
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
      updateFragment$: jasmine.createSpy('updateFragment$').and.returnValue(updateResult$)
    };
    const accessTokenService = {
      userId: 7,
      username: 'reader',
      knownAs: 'Reader',
      sessionId: 'session-1',
      clearToken: jasmine.createSpy('clearToken')
    };

    const component = new TextPanelComponent(
      { selectedFragment$, selectedDiary$ } as any,
      rpcService as any,
      { open: jasmine.createSpy('open') } as any,
      accessTokenService as any,
      { clearToken: jasmine.createSpy('clearToken') } as any,
      { url: '/diary/1/2/17', navigateByUrl: jasmine.createSpy('navigateByUrl') } as any,
      {
        lockFragmentForEdit: jasmine.createSpy('lockFragmentForEdit'),
        unlockFragment: jasmine.createSpy('unlockFragment')
      } as any,
      {
        getConfig: jasmine.createSpy('getConfig').and.resolveTo({
          baseUrl: 'https://example.test/diaries-responder',
          files: 'files'
        })
      } as any
    );

    return { component, rpcService, updateResult$, selectedFragment$ };
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
});
