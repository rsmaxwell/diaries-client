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
      { selectedFragment$ } as any,
      rpcService as any,
      { open: jasmine.createSpy('open') } as any,
      accessTokenService as any,
      { clearToken: jasmine.createSpy('clearToken') } as any,
      { url: '/diary/1/2/17', navigateByUrl: jasmine.createSpy('navigateByUrl') } as any,
      {
        lockFragmentForEdit: jasmine.createSpy('lockFragmentForEdit'),
        unlockFragment: jasmine.createSpy('unlockFragment')
      } as any
    );

    return { component, rpcService, updateResult$ };
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
});
