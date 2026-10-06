import { BehaviorSubject, of, Subject, throwError } from 'rxjs';

import { RpcError } from '../mqtt/rpc.service';
import { Fragment, ImageFragment } from '../model/fragment';
import { FragmentComponent } from './fragment.component';
import { ImageFragmentActionStateService } from './image-fragment-action-state.service';

describe('Step 12 ImageFragment focused regression', () => {
  const marquee: Fragment = {
    id: 33,
    pageId: 22,
    type: 'MARQUEE',
    imageId: null,
    marqueeId: 44,
    year: 1830,
    month: 2,
    day: 3,
    sequence: 1000,
    version: 4,
    text: 'Marquee transcription'
  };

  const image: ImageFragment = {
    id: 84,
    pageId: 22,
    type: 'IMAGE',
    imageId: 101,
    marqueeId: null,
    year: 1830,
    month: 2,
    day: 3,
    sequence: 1500,
    version: 7,
    text: 'Image transcription'
  };

  it('keeps Image-reference controls disabled for MARQUEE and enables them only for IMAGE state', async () => {
    const selectedFragment$ = new BehaviorSubject<Fragment | null>(marquee);
    const selectedPage$ = new BehaviorSubject<any>({ id: 22, diaryId: 11 });
    const selectedDiary$ = new BehaviorSubject<any>({ id: 11, name: 'diary-1830' });
    const state = new ImageFragmentActionStateService({
      selectedFragment$,
      selectedPage$,
      selectedDiary$
    } as any);

    let canSelect = false;
    let canClear = false;
    const selectSub = state.canSelectOrReplaceImage$.subscribe(value => canSelect = value);
    const clearSub = state.canClearImage$.subscribe(value => canClear = value);

    expect(canSelect).toBeFalse();
    expect(canClear).toBeFalse();

    selectedFragment$.next(image);
    expect(canSelect).toBeTrue();
    expect(canClear).toBeTrue();

    selectedFragment$.next({ ...image, imageId: null });
    expect(canSelect).toBeTrue();
    expect(canClear).toBeFalse();

    selectSub.unsubscribe();
    clearSub.unsubscribe();
  });

  it('uses failed-edit unlock fallback when a confirmed Clear Image update fails', async () => {
    const selectedFragment$ = new BehaviorSubject<Fragment | null>({ ...image });
    const selectedPage$ = new BehaviorSubject<any>({ id: 22, diaryId: 11 });
    const selectedDiary$ = new BehaviorSubject<any>({ id: 11, name: 'diary-1830' });
    const liveFragment$ = new BehaviorSubject<Fragment | null>({
      ...image,
      version: 8,
      lock: {
        lockUserId: 1,
        lockUserName: 'editor',
        lockKnownAs: 'Editor',
        lockTimeStamp: 123456,
        lockSessionId: 'session-1'
      }
    });
    const closed$ = new Subject<boolean>();

    const modelContext = {
      selectedFragment$,
      selectedPage$,
      selectedDiary$,
      fragments$: new BehaviorSubject<Fragment[]>([{ ...image }]),
      getLiveFragment$: jasmine.createSpy('getLiveFragment$').and.returnValue(liveFragment$.asObservable()),
      setPageId: jasmine.createSpy('setPageId'),
      setFragmentId: jasmine.createSpy('setFragmentId'),
      setMarqueeId: jasmine.createSpy('setMarqueeId')
    };
    const dialog = {
      open: jasmine.createSpy('open').and.returnValue({ closed: closed$.asObservable() })
    };
    const rpcService = {
      updateImageFragment$: jasmine.createSpy('updateImageFragment$').and.returnValue(
        throwError(() => new RpcError(409, 'Synthetic lock conflict'))
      )
    };
    const alertService = {
      info: jasmine.createSpy('info'),
      warning: jasmine.createSpy('warning'),
      error: jasmine.createSpy('error')
    };
    const fragmentLockService = {
      lockFragmentForEdit: jasmine.createSpy('lockFragmentForEdit').and.resolveTo(true),
      unlockFragmentAfterFailedEdit: jasmine.createSpy('unlockFragmentAfterFailedEdit').and.resolveTo(undefined),
      unlockFragment: jasmine.createSpy('unlockFragment').and.resolveTo(undefined)
    };
    const actionState = {
      tryBeginImageMutation: jasmine.createSpy('tryBeginImageMutation').and.returnValue(true),
      endImageMutation: jasmine.createSpy('endImageMutation')
    };

    const component = new FragmentComponent(
      { snapshot: { paramMap: { get: () => null } } } as any,
      { navigate: jasmine.createSpy('navigate') } as any,
      {} as any,
      {} as any,
      modelContext as any,
      dialog as any,
      rpcService as any,
      alertService as any,
      fragmentLockService as any,
      actionState as any
    );

    const operation = component.onClearImageForFragmentClick();
    for (let i = 0; i < 4 && !dialog.open.calls.any(); i++) {
      await Promise.resolve();
    }
    expect(dialog.open).toHaveBeenCalledTimes(1);

    closed$.next(true);
    closed$.complete();
    await operation;

    expect(fragmentLockService.lockFragmentForEdit).toHaveBeenCalledOnceWith(84);
    expect(rpcService.updateImageFragment$).toHaveBeenCalledTimes(1);
    expect(rpcService.updateImageFragment$.calls.mostRecent().args[1]).toBeNull();
    expect(fragmentLockService.unlockFragmentAfterFailedEdit).toHaveBeenCalledOnceWith(84);
    expect(fragmentLockService.unlockFragment).not.toHaveBeenCalled();
    expect(selectedFragment$.value?.imageId).toBe(101);
    expect(alertService.error).toHaveBeenCalledWith(
      'The Image reference was not changed because this Fragment is locked or conflicts with another edit. Refresh and try again.'
    );
  });
});
