import { BehaviorSubject, of } from 'rxjs';

import { AddFragmentRequest, Fragment } from '../model/fragment';
import { Marquee } from '../model/marquee';
import { Rectangle } from '../utilities/rectangle';
import { FragmentComponent } from './fragment.component';
import { ImageViewerComponent } from './image-viewer/image-viewer.component';

describe('MARQUEE Fragment compatibility after ImageFragment authoring', () => {
  const fragment: Fragment = {
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

  const marquee = new Marquee(44, 2, 33, 22, new Rectangle(100, 120, 500, 400));

  it('keeps existing MARQUEE creation on addFragment with no Image identity fields', async () => {
    const created: Fragment = {
      ...fragment,
      id: 34,
      marqueeId: 45,
      sequence: 2000,
      version: 0,
      text: ''
    };
    const rpcService = {
      addFragment$: jasmine.createSpy('addFragment$').and.returnValue(of(created)),
      addImageFragment$: jasmine.createSpy('addImageFragment$')
    };
    const modelContext = {
      selectedFragment$: new BehaviorSubject<Fragment | null>(fragment),
      fragments$: new BehaviorSubject<Fragment[]>([fragment]),
      setFragmentId: jasmine.createSpy('setFragmentId'),
      setMarqueeId: jasmine.createSpy('setMarqueeId')
    };
    const router = { navigate: jasmine.createSpy('navigate'), url: '/diary/11/22/33' };
    const alertService = { info: jasmine.createSpy('info'), error: jasmine.createSpy('error') };

    const component = new ImageViewerComponent(
      router as any,
      rpcService as any,
      alertService as any,
      {} as any,
      modelContext as any,
      {} as any,
      {} as any
    );
    (component as any).diary = { id: 11 };
    (component as any).page = { id: 22, width: 1000, height: 1500 };

    (component as any).onAddButtonClick();
    await Promise.resolve();
    await Promise.resolve();

    expect(rpcService.addFragment$).toHaveBeenCalledTimes(1);
    expect(rpcService.addImageFragment$).not.toHaveBeenCalled();
    const request = rpcService.addFragment$.calls.mostRecent().args[0] as AddFragmentRequest;
    expect(request.pageId).toBe(22);
    expect(request.year).toBe(1830);
    expect(request.month).toBe(2);
    expect(request.day).toBe(3);
    expect(request.sequence).toBe(2000);
    expect(Object.hasOwn(request, 'imageId')).toBeFalse();
    expect(Object.hasOwn(request, 'type')).toBeFalse();
    expect(modelContext.setFragmentId).toHaveBeenCalledOnceWith(34);
    expect(modelContext.setMarqueeId).toHaveBeenCalledOnceWith(45);
  });

  it('keeps existing MARQUEE edit selection on marquee mode and never invokes Image-reference mutation', async () => {
    const selectedFragment$ = new BehaviorSubject<Fragment | null>(fragment);
    const selectedPage$ = new BehaviorSubject<any>({ id: 22, diaryId: 11 });
    const selectedMarquee$ = new BehaviorSubject<Marquee | null>(marquee);
    const modelContext = {
      selectedFragment$,
      selectedPage$,
      selectedMarquee$,
      toggleEditMarqueeMode: jasmine.createSpy('toggleEditMarqueeMode')
    };
    const rpcService = { updateImageFragment$: jasmine.createSpy('updateImageFragment$') };

    const component = new FragmentComponent(
      { snapshot: { paramMap: { get: () => null } } } as any,
      { navigate: jasmine.createSpy('navigate') } as any,
      {} as any,
      {} as any,
      modelContext as any,
      {} as any,
      rpcService as any,
      { error: jasmine.createSpy('error') } as any,
      {} as any,
      {} as any
    );

    await component.onEditMarqueeClick();

    expect(modelContext.toggleEditMarqueeMode).toHaveBeenCalledTimes(1);
    expect(rpcService.updateImageFragment$).not.toHaveBeenCalled();
  });

  it('keeps existing MARQUEE Fragment deletion on deleteFragment and never cascades to deleteImage', async () => {
    const selectedFragment$ = new BehaviorSubject<Fragment | null>(fragment);
    const rpcService = {
      deleteFragment$: jasmine.createSpy('deleteFragment$').and.returnValue(of(33)),
      deleteImage$: jasmine.createSpy('deleteImage$')
    };
    const modelContext = {
      selectedFragment$,
      setFragmentId: jasmine.createSpy('setFragmentId'),
      setMarqueeId: jasmine.createSpy('setMarqueeId')
    };
    const router = { navigate: jasmine.createSpy('navigate'), url: '/diary/11/22/33' };
    const alertService = { info: jasmine.createSpy('info'), error: jasmine.createSpy('error') };
    const fragmentLockService = {
      lockFragmentForEdit: jasmine.createSpy('lockFragmentForEdit').and.resolveTo(true),
      unlockFragmentAfterFailedEdit: jasmine.createSpy('unlockFragmentAfterFailedEdit')
    };

    const component = new ImageViewerComponent(
      router as any,
      rpcService as any,
      alertService as any,
      {} as any,
      modelContext as any,
      {} as any,
      fragmentLockService as any
    );
    (component as any).diary = { id: 11 };
    (component as any).page = { id: 22 };

    await (component as any).deleteSelectedFragment();

    expect(fragmentLockService.lockFragmentForEdit).toHaveBeenCalledOnceWith(33);
    expect(rpcService.deleteFragment$).toHaveBeenCalledOnceWith(33);
    expect(rpcService.deleteImage$).not.toHaveBeenCalled();
    expect(alertService.info).not.toHaveBeenCalledWith(jasmine.stringMatching(/Catalogued Image/));
    expect(modelContext.setMarqueeId).toHaveBeenCalledOnceWith(null);
    expect(modelContext.setFragmentId).toHaveBeenCalledOnceWith(null);
  });
});
