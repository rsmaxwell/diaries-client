import { Subject, BehaviorSubject, of, throwError } from 'rxjs';

import { FragmentComponent } from './fragment.component';
import { AddImageFragmentRequest, Fragment, ImageFragment } from '../model/fragment';
import { RpcError } from '../mqtt/rpc.service';
import { ImageFragmentActionStateService } from './image-fragment-action-state.service';

describe('FragmentComponent responsive layout', () => {
  function createComponent(): FragmentComponent {
    return new FragmentComponent(
      { snapshot: { paramMap: { get: () => null } } } as any,
      { navigate: jasmine.createSpy('navigate') } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
  }

  it('uses a side-by-side editor on wide viewports', () => {
    const config = (createComponent() as any).createLayoutConfig(false);

    expect(config.root.type).toBe('row');
    expect(config.root.content[0].componentType).toBe('ImageViewer');
    expect(config.root.content[1].type).toBe('stack');
  });

  it('stacks the source page above the editor on narrow viewports', () => {
    const config = (createComponent() as any).createLayoutConfig(true);

    expect(config.root.type).toBe('column');
    expect(config.root.content[0].height).toBe(45);
    expect(config.root.content[1].height).toBe(55);
  });
});

describe('FragmentComponent Add Image Fragment workflow', () => {
  const sourceFragment: Fragment = {
    id: 33,
    pageId: 22,
    type: 'MARQUEE',
    imageId: null,
    marqueeId: 44,
    year: 1830,
    month: 2,
    day: 3,
    sequence: 1000,
    version: 7,
    text: 'Source'
  };

  const followingFragment: Fragment = {
    ...sourceFragment,
    id: 34,
    type: 'IMAGE',
    imageId: 102,
    marqueeId: null,
    sequence: 2000
  };

  const createdFragment: ImageFragment = {
    id: 84,
    pageId: 22,
    type: 'IMAGE',
    imageId: 101,
    marqueeId: null,
    year: 1830,
    month: 2,
    day: 3,
    sequence: 1500,
    version: 0,
    text: ''
  };

  function createHarness() {
    const selectedFragment$ = new BehaviorSubject<Fragment | null>({ ...sourceFragment });
    const selectedPage$ = new BehaviorSubject<any>({
      id: 22, diaryId: 11, name: 'page-1', extension: '.jpg', width: 1000, height: 1500, sequence: 1, version: 0
    });
    const selectedDiary$ = new BehaviorSubject<any>({ id: 11, version: 0, sequence: 1, name: 'diary-1830' });
    const fragments$ = new BehaviorSubject<Fragment[]>([{ ...sourceFragment }, { ...followingFragment }]);
    const closed$ = new Subject<any>();

    const modelContext = {
      selectedFragment$,
      selectedPage$,
      selectedDiary$,
      fragments$,
      setPageId: jasmine.createSpy('setPageId'),
      setFragmentId: jasmine.createSpy('setFragmentId'),
      setMarqueeId: jasmine.createSpy('setMarqueeId')
    };
    const dialog = {
      open: jasmine.createSpy('open').and.returnValue({ closed: closed$.asObservable() })
    };
    const rpcService = {
      addImageFragment$: jasmine.createSpy('addImageFragment$').and.returnValue(of({ ...createdFragment }))
    };
    const alertService = {
      info: jasmine.createSpy('info'),
      warning: jasmine.createSpy('warning'),
      error: jasmine.createSpy('error')
    };
    const router = {
      navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true))
    };
    const fragmentLockService = {
      lockFragmentForEdit: jasmine.createSpy('lockFragmentForEdit'),
      unlockFragmentAfterFailedEdit: jasmine.createSpy('unlockFragmentAfterFailedEdit')
    };
    const imageFragmentActionState = new ImageFragmentActionStateService(modelContext as any);

    const component = new FragmentComponent(
      { snapshot: { paramMap: { get: () => null } } } as any,
      router as any,
      {} as any,
      {} as any,
      modelContext as any,
      dialog as any,
      rpcService as any,
      alertService as any,
      fragmentLockService as any,
      imageFragmentActionState
    );

    return {
      component,
      selectedFragment$,
      selectedPage$,
      selectedDiary$,
      fragments$,
      closed$,
      modelContext,
      dialog,
      rpcService,
      alertService,
      router,
      fragmentLockService,
      imageFragmentActionState
    };
  }

  async function waitForDialogOpen(harness: ReturnType<typeof createHarness>): Promise<void> {
    for (let i = 0; i < 4 && !harness.dialog.open.calls.any(); i++) {
      await Promise.resolve();
    }
    expect(harness.dialog.open).toHaveBeenCalledTimes(1);
  }

  it('selects a catalogued Image first, creates after the source Fragment and navigates to the reply', async () => {
    const h = createHarness();
    const action = h.component.onAddImageFragmentClick();
    await waitForDialogOpen(h);

    const [, options] = h.dialog.open.calls.mostRecent().args;
    expect(options.data.path$.value).toBe('/diary-1830/images');
    expect(options.data.select).toBeTrue();
    expect(options.data.selectionMode).toBe('catalogue-image');
    expect(options.ariaLabel).toContain('Choose a catalogued Image');
    expect(options.autoFocus).toBe('first-tabbable');
    expect(options.restoreFocus).toBeTrue();
    expect(h.fragmentLockService.lockFragmentForEdit).not.toHaveBeenCalled();
    expect(h.rpcService.addImageFragment$).not.toHaveBeenCalled();

    h.closed$.next({
      url: 'http://localhost/files/diary-1830/images/image.png',
      name: 'image.png',
      imageId: 101
    });
    h.closed$.complete();
    await action;

    expect(h.rpcService.addImageFragment$).toHaveBeenCalledTimes(1);
    const request = h.rpcService.addImageFragment$.calls.mostRecent().args[0] as AddImageFragmentRequest;
    expect(request).toEqual(new AddImageFragmentRequest(22, 1830, 2, 3, 1500, '', 101));
    expect(h.fragmentLockService.lockFragmentForEdit).not.toHaveBeenCalled();
    expect(h.modelContext.setPageId).toHaveBeenCalledOnceWith(22);
    expect(h.modelContext.setFragmentId).toHaveBeenCalledOnceWith(84);
    expect(h.modelContext.setMarqueeId).toHaveBeenCalledOnceWith(null);
    expect(h.router.navigate).toHaveBeenCalledOnceWith(['/diary', 11, 22, 84]);
    expect(h.alertService.info).toHaveBeenCalledWith('Image Fragment 84 added');
  });

  it('sends no RPC and changes no selection when the chooser is cancelled', async () => {
    const h = createHarness();
    const action = h.component.onAddImageFragmentClick();
    await waitForDialogOpen(h);

    h.closed$.next(undefined);
    h.closed$.complete();
    await action;

    expect(h.rpcService.addImageFragment$).not.toHaveBeenCalled();
    expect(h.modelContext.setPageId).not.toHaveBeenCalled();
    expect(h.modelContext.setFragmentId).not.toHaveBeenCalled();
    expect(h.modelContext.setMarqueeId).not.toHaveBeenCalled();
  });

  it('suppresses duplicate Add Image Fragment clicks while the chooser/RPC workflow is active', async () => {
    const h = createHarness();
    const first = h.component.onAddImageFragmentClick();
    await waitForDialogOpen(h);

    await h.component.onAddImageFragmentClick();
    expect(h.dialog.open).toHaveBeenCalledTimes(1);
    expect(h.rpcService.addImageFragment$).not.toHaveBeenCalled();

    h.closed$.next(undefined);
    h.closed$.complete();
    await first;
  });

  it('distinguishes authentication failure from a disabled authoring gate', async () => {
    const h = createHarness();
    h.rpcService.addImageFragment$.and.returnValue(
      throwError(() => new RpcError(401, 'Unauthorized'))
    );
    const action = h.component.onAddImageFragmentClick();
    await waitForDialogOpen(h);

    h.closed$.next({ url: '/files/image.png', name: 'image.png', imageId: 101 });
    h.closed$.complete();
    await action;

    expect(h.alertService.error).toHaveBeenCalledWith(
      'Your sign-in is no longer valid. Sign in again before adding an Image Fragment.'
    );
    expect(h.alertService.error).not.toHaveBeenCalledWith(
      'ImageFragment authoring is disabled in this environment.'
    );
  });

  it('aborts if the active Fragment changes while the chooser is open', async () => {
    const h = createHarness();
    const action = h.component.onAddImageFragmentClick();
    await waitForDialogOpen(h);

    h.selectedFragment$.next({ ...sourceFragment, id: 99 });
    h.closed$.next({ url: '/files/image.png', name: 'image.png', imageId: 101 });
    h.closed$.complete();
    await action;

    expect(h.rpcService.addImageFragment$).not.toHaveBeenCalled();
    expect(h.alertService.warning).toHaveBeenCalledWith(
      'The active fragment or page changed while choosing the image. No Image Fragment was created.'
    );
  });

  it('surfaces a specific authoring-disabled message for responder 403 without retrying', async () => {
    const h = createHarness();
    h.rpcService.addImageFragment$.and.returnValue(
      throwError(() => new RpcError(403, 'ImageFragment writes disabled'))
    );
    const action = h.component.onAddImageFragmentClick();
    await waitForDialogOpen(h);

    h.closed$.next({ url: '/files/image.png', name: 'image.png', imageId: 101 });
    h.closed$.complete();
    await action;

    expect(h.rpcService.addImageFragment$).toHaveBeenCalledTimes(1);
    expect(h.alertService.error).toHaveBeenCalledWith(
      'ImageFragment authoring is disabled in this environment.'
    );
  });

  it('does not automatically retry an ambiguous creation failure', async () => {
    const h = createHarness();
    h.rpcService.addImageFragment$.and.returnValue(
      throwError(() => new RpcError(500, 'Synthetic publication failure'))
    );
    const action = h.component.onAddImageFragmentClick();
    await waitForDialogOpen(h);

    h.closed$.next({ url: '/files/image.png', name: 'image.png', imageId: 101 });
    h.closed$.complete();
    await action;

    expect(h.rpcService.addImageFragment$).toHaveBeenCalledTimes(1);
    expect(h.alertService.error).toHaveBeenCalledWith(
      'Could not confirm whether the Image Fragment was created. Refresh before retrying.'
    );
  });
});

describe('FragmentComponent Image reference editing workflow', () => {
  const imageFragment: ImageFragment = {
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

  function createEditHarness() {
    const selectedFragment$ = new BehaviorSubject<Fragment | null>({ ...imageFragment });
    const selectedPage$ = new BehaviorSubject<any>({ id: 22, diaryId: 11, name: 'page-1' });
    const selectedDiary$ = new BehaviorSubject<any>({ id: 11, name: 'diary-1830' });
    const liveFragment$ = new BehaviorSubject<Fragment | null>({
      ...imageFragment,
      version: 8,
      lock: {
        lockUserId: 1,
        lockUserName: 'editor',
        lockKnownAs: 'Editor',
        lockTimeStamp: 123456,
        lockSessionId: 'session-1'
      }
    });
    const closed$ = new Subject<any>();

    const modelContext = {
      selectedFragment$,
      selectedPage$,
      selectedDiary$,
      fragments$: new BehaviorSubject<Fragment[]>([{ ...imageFragment }]),
      getLiveFragment$: jasmine.createSpy('getLiveFragment$').and.callFake(() => liveFragment$.asObservable()),
      setPageId: jasmine.createSpy('setPageId'),
      setFragmentId: jasmine.createSpy('setFragmentId'),
      setMarqueeId: jasmine.createSpy('setMarqueeId')
    };
    const dialog = {
      open: jasmine.createSpy('open').and.returnValue({ closed: closed$.asObservable() })
    };
    const rpcService = {
      addImageFragment$: jasmine.createSpy('addImageFragment$'),
      updateImageFragment$: jasmine.createSpy('updateImageFragment$').and.returnValue(of(84))
    };
    const alertService = {
      info: jasmine.createSpy('info'),
      warning: jasmine.createSpy('warning'),
      error: jasmine.createSpy('error')
    };
    const fragmentLockService = {
      lockFragmentForEdit: jasmine.createSpy('lockFragmentForEdit').and.returnValue(Promise.resolve(true)),
      unlockFragment: jasmine.createSpy('unlockFragment').and.returnValue(Promise.resolve(true)),
      unlockFragmentAfterFailedEdit: jasmine.createSpy('unlockFragmentAfterFailedEdit').and.returnValue(Promise.resolve())
    };
    const router = { navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)) };
    const imageFragmentActionState = new ImageFragmentActionStateService(modelContext as any);

    const component = new FragmentComponent(
      { snapshot: { paramMap: { get: () => null } } } as any,
      router as any,
      {} as any,
      {} as any,
      modelContext as any,
      dialog as any,
      rpcService as any,
      alertService as any,
      fragmentLockService as any,
      imageFragmentActionState
    );

    return {
      component,
      selectedFragment$,
      selectedPage$,
      selectedDiary$,
      liveFragment$,
      closed$,
      modelContext,
      dialog,
      rpcService,
      alertService,
      fragmentLockService,
      imageFragmentActionState
    };
  }

  async function waitForDialogOpen(h: ReturnType<typeof createEditHarness>): Promise<void> {
    for (let i = 0; i < 4 && !h.dialog.open.calls.any(); i++) {
      await Promise.resolve();
    }
    expect(h.dialog.open).toHaveBeenCalledTimes(1);
  }

  it('opens the catalogue before locking, then replaces using the latest retained Fragment and no extra unlock', async () => {
    const h = createEditHarness();
    const action = h.component.onSelectImageForFragmentClick();
    await waitForDialogOpen(h);

    const [, options] = h.dialog.open.calls.mostRecent().args;
    expect(options.data.path$.value).toBe('/diary-1830/images');
    expect(options.data.selectionMode).toBe('catalogue-image');
    expect(options.ariaLabel).toContain('Choose a catalogued Image');
    expect(options.autoFocus).toBe('first-tabbable');
    expect(options.restoreFocus).toBeTrue();
    expect(h.fragmentLockService.lockFragmentForEdit).not.toHaveBeenCalled();

    h.closed$.next({ url: '/files/new.png', name: 'new.png', imageId: 202 });
    h.closed$.complete();
    await action;

    expect(h.fragmentLockService.lockFragmentForEdit).toHaveBeenCalledOnceWith(84);
    expect(h.modelContext.getLiveFragment$).toHaveBeenCalledOnceWith(84);
    const [updatedFragment, newImageId] = h.rpcService.updateImageFragment$.calls.mostRecent().args;
    expect(updatedFragment.version).toBe(8);
    expect(updatedFragment.id).toBe(84);
    expect(newImageId).toBe(202);
    expect(h.fragmentLockService.unlockFragmentAfterFailedEdit).not.toHaveBeenCalled();
    expect(h.fragmentLockService.unlockFragment).not.toHaveBeenCalled();
  });

  it('suppresses duplicate Image-reference actions while the chooser workflow is active', async () => {
    const h = createEditHarness();
    const first = h.component.onSelectImageForFragmentClick();
    await waitForDialogOpen(h);

    await h.component.onClearImageForFragmentClick();
    expect(h.dialog.open).toHaveBeenCalledTimes(1);
    expect(h.fragmentLockService.lockFragmentForEdit).not.toHaveBeenCalled();

    h.closed$.next(undefined);
    h.closed$.complete();
    await first;
  });

  it('does not lock or send an RPC when the selected Image is unchanged', async () => {
    const h = createEditHarness();
    const action = h.component.onSelectImageForFragmentClick();
    await waitForDialogOpen(h);

    h.closed$.next({ url: '/files/current.png', name: 'current.png', imageId: 101 });
    h.closed$.complete();
    await action;

    expect(h.fragmentLockService.lockFragmentForEdit).not.toHaveBeenCalled();
    expect(h.rpcService.updateImageFragment$).not.toHaveBeenCalled();
  });

  it('does not lock or send an RPC when Image selection is cancelled', async () => {
    const h = createEditHarness();
    const action = h.component.onSelectImageForFragmentClick();
    await waitForDialogOpen(h);

    h.closed$.next(undefined);
    h.closed$.complete();
    await action;

    expect(h.fragmentLockService.lockFragmentForEdit).not.toHaveBeenCalled();
    expect(h.rpcService.updateImageFragment$).not.toHaveBeenCalled();
  });

  it('aborts without locking if selection changed while the chooser was open', async () => {
    const h = createEditHarness();
    const action = h.component.onSelectImageForFragmentClick();
    await waitForDialogOpen(h);

    h.selectedFragment$.next({ ...imageFragment, id: 85 });
    h.closed$.next({ url: '/files/new.png', name: 'new.png', imageId: 202 });
    h.closed$.complete();
    await action;

    expect(h.fragmentLockService.lockFragmentForEdit).not.toHaveBeenCalled();
    expect(h.rpcService.updateImageFragment$).not.toHaveBeenCalled();
  });

  it('uses failed-edit unlock fallback when responder rejects the Image mutation', async () => {
    const h = createEditHarness();
    h.rpcService.updateImageFragment$.and.returnValue(
      throwError(() => new RpcError(400, 'Stale update'))
    );
    const action = h.component.onSelectImageForFragmentClick();
    await waitForDialogOpen(h);

    h.closed$.next({ url: '/files/new.png', name: 'new.png', imageId: 202 });
    h.closed$.complete();
    await action;

    expect(h.fragmentLockService.unlockFragmentAfterFailedEdit).toHaveBeenCalledOnceWith(84);
    expect(h.alertService.error).toHaveBeenCalledWith(
      'The Image reference was not changed because the Fragment or Image state is stale or invalid. Refresh and try again.'
    );
  });

  it('surfaces an unconfirmed mutation failure without optimistically changing the retained Image reference', async () => {
    const h = createEditHarness();
    h.rpcService.updateImageFragment$.and.returnValue(
      throwError(() => new RpcError(500, 'Synthetic internal failure'))
    );
    const action = h.component.onSelectImageForFragmentClick();
    await waitForDialogOpen(h);

    h.closed$.next({ url: '/files/new.png', name: 'new.png', imageId: 202 });
    h.closed$.complete();
    await action;

    expect(h.selectedFragment$.value?.imageId).toBe(101);
    expect(h.fragmentLockService.unlockFragmentAfterFailedEdit).toHaveBeenCalledOnceWith(84);
    expect(h.alertService.error).toHaveBeenCalledWith(
      'Could not confirm whether the Image reference was changed. Refresh the Fragment before retrying.'
    );
  });

  it('confirms Clear Image before locking and sends explicit null without a redundant unlock', async () => {
    const h = createEditHarness();
    const action = h.component.onClearImageForFragmentClick();
    await waitForDialogOpen(h);

    expect(h.fragmentLockService.lockFragmentForEdit).not.toHaveBeenCalled();
    const [, options] = h.dialog.open.calls.mostRecent().args;
    expect(options.data).toEqual({ fragmentId: 84, imageId: 101 });
    expect(options.autoFocus).toBe('first-tabbable');
    expect(options.restoreFocus).toBeTrue();

    h.closed$.next(true);
    h.closed$.complete();
    await action;

    expect(h.fragmentLockService.lockFragmentForEdit).toHaveBeenCalledOnceWith(84);
    const [, newImageId] = h.rpcService.updateImageFragment$.calls.mostRecent().args;
    expect(newImageId).toBeNull();
    expect(h.fragmentLockService.unlockFragmentAfterFailedEdit).not.toHaveBeenCalled();
    expect(h.fragmentLockService.unlockFragment).not.toHaveBeenCalled();
  });

  it('does nothing when Clear Image confirmation is cancelled', async () => {
    const h = createEditHarness();
    const action = h.component.onClearImageForFragmentClick();
    await waitForDialogOpen(h);

    h.closed$.next(false);
    h.closed$.complete();
    await action;

    expect(h.fragmentLockService.lockFragmentForEdit).not.toHaveBeenCalled();
    expect(h.rpcService.updateImageFragment$).not.toHaveBeenCalled();
  });

  it('aborts Clear Image if the reference changes during confirmation', async () => {
    const h = createEditHarness();
    const action = h.component.onClearImageForFragmentClick();
    await waitForDialogOpen(h);

    h.selectedFragment$.next({ ...imageFragment, imageId: 202 });
    h.closed$.next(true);
    h.closed$.complete();
    await action;

    expect(h.fragmentLockService.lockFragmentForEdit).not.toHaveBeenCalled();
    expect(h.rpcService.updateImageFragment$).not.toHaveBeenCalled();
  });

  it('releases an acquired lock if retained state already has the requested Image', async () => {
    const h = createEditHarness();
    h.liveFragment$.next({ ...h.liveFragment$.value!, imageId: 202, version: 8 });
    const action = h.component.onSelectImageForFragmentClick();
    await waitForDialogOpen(h);

    h.closed$.next({ url: '/files/new.png', name: 'new.png', imageId: 202 });
    h.closed$.complete();
    await action;

    // The pre-lock selected Fragment still had 101, so a lock was acquired. The
    // post-lock retained value already had 202, so no update is sent.
    expect(h.fragmentLockService.lockFragmentForEdit).toHaveBeenCalledOnceWith(84);
    expect(h.rpcService.updateImageFragment$).not.toHaveBeenCalled();
    expect(h.fragmentLockService.unlockFragment).toHaveBeenCalledOnceWith(84, 'Image reference already current');
  });
});
