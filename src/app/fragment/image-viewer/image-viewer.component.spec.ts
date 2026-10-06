import { BehaviorSubject, of } from 'rxjs';
import { Fragment } from '../../model/fragment';
import { Page } from '../../model/page';
import { Marquee } from '../../model/marquee';
import { Rectangle } from '../../utilities/rectangle';
import { ImageViewerComponent } from './image-viewer.component';

describe('ImageViewerComponent source heading', () => {
  function createComponent(): ImageViewerComponent {
    return new ImageViewerComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
  }

  it('uses the selected page name without the file extension', () => {
    const component = createComponent();
    (component as any).page = new Page(3, 1, 'img2357', '.jpg', 1200, 1800, 1000, 1);

    expect(component.sourceName).toBe('img2357');
  });

  it('provides a useful fallback before the page is available', () => {
    expect(createComponent().sourceName).toBe('Source page');
  });

  it('zooms around the centre of the source page and can restore the page fit', () => {
    const component = createComponent();
    (component as any).page = new Page(3, 1, 'img2357', '.jpg', 1200, 1800, 1000, 1);

    component.zoomIn();
    expect(component.transformStyle).toBe('translate(-120, -180) scale(1.2)');

    component.fitPage();
    expect(component.transformStyle).toBe('translate(0, 0) scale(1)');
  });

  it('fits the selected marquee centrally with some surrounding context', () => {
    const component = createComponent();
    (component as any).page = new Page(3, 1, 'img2357', '.jpg', 1200, 1800, 1000, 1);
    component.marquee = new Marquee(7, 1, 11, 3, new Rectangle(100, 200, 400, 300));

    component.fitSelection();

    expect(component.transformStyle).toBe('translate(-210, -45) scale(2.7)');
  });

  it('toggles between focus and highlight marquee presentation', () => {
    const component = createComponent();

    expect(component.marqueeDisplayMode).toBe('focus');
    component.toggleMarqueeDisplayMode();
    expect(component.marqueeDisplayMode).toBe('highlight');
    component.toggleMarqueeDisplayMode();
    expect(component.marqueeDisplayMode).toBe('focus');
  });
});

describe('ImageViewerComponent mixed Fragment deletion', () => {
  const imageFragment: Fragment = {
    id: 84,
    pageId: 22,
    type: 'IMAGE',
    imageId: 101,
    marqueeId: null,
    year: 1830,
    month: 2,
    day: 3,
    sequence: 2,
    version: 7,
    text: 'Image transcription'
  };

  function createDeleteHarness(fragment: Fragment | null = imageFragment) {
    const selectedFragment$ = new BehaviorSubject<Fragment | null>(fragment);
    const router = { url: '/diary/11/22/84', navigate: jasmine.createSpy('navigate') };
    const rpcService = {
      deleteFragment$: jasmine.createSpy('deleteFragment$').and.returnValue(of(84)),
      deleteImage$: jasmine.createSpy('deleteImage$')
    };
    const alertService = {
      info: jasmine.createSpy('info'),
      error: jasmine.createSpy('error')
    };
    const modelContext = {
      selectedFragment$,
      setFragmentId: jasmine.createSpy('setFragmentId'),
      setMarqueeId: jasmine.createSpy('setMarqueeId')
    };
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

    return { component, router, rpcService, alertService, modelContext, fragmentLockService };
  }

  it('deletes an IMAGE Fragment through deleteFragment only and explicitly keeps its catalogued Image', async () => {
    const h = createDeleteHarness();

    await (h.component as any).deleteSelectedFragment();

    expect(h.fragmentLockService.lockFragmentForEdit).toHaveBeenCalledOnceWith(84);
    expect(h.rpcService.deleteFragment$).toHaveBeenCalledOnceWith(84);
    expect(h.rpcService.deleteImage$).not.toHaveBeenCalled();
    expect(h.modelContext.setMarqueeId).toHaveBeenCalledOnceWith(null);
    expect(h.modelContext.setFragmentId).toHaveBeenCalledOnceWith(null);
    expect(h.router.navigate).toHaveBeenCalledOnceWith(['/diary', 11, 22]);
    expect(h.alertService.info).toHaveBeenCalledWith(
      'Image Fragment 84 deleted. Catalogued Image 101 and its file were kept.'
    );
  });

  it('allows the generic Ctrl+Delete Fragment shortcut when an IMAGE Fragment has no Marquee', () => {
    const h = createDeleteHarness();
    h.component.marquee = null;
    const deleteSelectedFragment = spyOn<any>(h.component, 'deleteSelectedFragment');
    const event = new KeyboardEvent('keydown', { key: 'Delete', ctrlKey: true, cancelable: true });

    h.component.onKeyDown(event);

    expect(event.defaultPrevented).toBeTrue();
    expect(deleteSelectedFragment).toHaveBeenCalledTimes(1);
  });
});
