import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { AlertService } from '../alerts/alert.service';
import { ConfigService } from '../config/config.service';
import { Diary } from '../model/diary';
import { CatalogueImage } from '../model/image';
import { FragmentLockService } from '../fragment/fragment-lock.service';
import { Fragment, UpdateFragmentRequest } from '../model/fragment';
import { ModelContext } from '../model/model-context';
import { RpcService } from '../mqtt/rpc.service';
import { DayviewComponent } from './dayview.component';

describe('DayviewComponent', () => {
  let component: DayviewComponent;
  let fixture: ComponentFixture<DayviewComponent>;
  let rpcService: jasmine.SpyObj<RpcService>;
  let fragmentLockService: jasmine.SpyObj<FragmentLockService>;
  let alertService: jasmine.SpyObj<AlertService>;
  let router: jasmine.SpyObj<Router>;
  let modelContext: jasmine.SpyObj<ModelContext>;
  let fragments$: BehaviorSubject<Fragment[]>;
  let selectedFragment$: BehaviorSubject<Fragment | null>;
  let selectedDiary$: BehaviorSubject<Diary>;
  let catalogueImages: Map<number, BehaviorSubject<CatalogueImage | null>>;

  beforeEach(async () => {
    fragments$ = new BehaviorSubject<Fragment[]>([]);
    selectedFragment$ = new BehaviorSubject<Fragment | null>(null);
    selectedDiary$ = new BehaviorSubject<Diary>({
      id: 5,
      version: 0,
      name: 'diary one',
      sequence: 1
    });
    catalogueImages = new Map();
    rpcService = jasmine.createSpyObj<RpcService>('RpcService', ['updateFragment$', 'updateImageFragment$']);
    fragmentLockService = jasmine.createSpyObj<FragmentLockService>('FragmentLockService', [
      'lockFragmentForEdit',
      'unlockFragmentAfterFailedEdit'
    ]);
    alertService = jasmine.createSpyObj<AlertService>('AlertService', ['error']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/day' });
    modelContext = jasmine.createSpyObj<ModelContext>(
      'ModelContext',
      ['getLivePage$', 'getLiveImage$', 'setFragmentId', 'setMarqueeId'],
      {
        selectFragmentsForDate$: fragments$,
        selectedFragment$,
        selectedDiary$
      }
    );

    modelContext.getLiveImage$.and.callFake(id => {
      if (!catalogueImages.has(id)) {
        catalogueImages.set(id, new BehaviorSubject<CatalogueImage | null>(null));
      }
      return catalogueImages.get(id)!.asObservable();
    });

    await TestBed.configureTestingModule({
      imports: [DayviewComponent],
      providers: [
        { provide: RpcService, useValue: rpcService },
        { provide: ModelContext, useValue: modelContext },
        { provide: AlertService, useValue: alertService },
        { provide: Router, useValue: router },
        { provide: FragmentLockService, useValue: fragmentLockService },
        {
          provide: ConfigService,
          useValue: {
            getConfig: () => Promise.resolve({
              baseUrl: 'http://localhost:8081',
              files: 'files'
            })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DayviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders a formatted reader heading and rich fragment content without a table', () => {
    fragments$.next([
      fragment(1, 1, `<p>A paragraph with <strong>emphasis</strong> and https://example.test/${'x'.repeat(100)}</p>
        <ul><li>A list item</li></ul>
        <p><img alt="Diary scan" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="></p>`)
    ]);
    fixture.detectChanges();

    const editor = fixture.nativeElement.querySelector('.ql-editor--viewer') as HTMLElement;
    const image = editor.querySelector('img') as HTMLImageElement;

    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    expect(fixture.nativeElement.querySelector('h1').textContent.trim()).toBe('1830 February 1');
    expect(editor.querySelector('strong')?.textContent).toBe('emphasis');
    expect(editor.querySelector('li')?.textContent).toBe('A list item');
    expect(getComputedStyle(editor).overflowWrap).toBe('anywhere');
    expect(getComputedStyle(editor).lineHeight).toBe('25.6px');
    expect(getComputedStyle(image).maxWidth).toBe('100%');
  });

  it('explains an invalid stored date with text as well as styling', () => {
    fragments$.next([fragment(1, 1, '<p>Invalid date fragment</p>', 1830, 2, 31)]);
    fixture.detectChanges();

    const warning = fixture.nativeElement.querySelector('.date-warning') as HTMLElement;

    expect(component.isDateValid).toBeFalse();
    expect(fixture.nativeElement.querySelector('h1').textContent.trim()).toBe('1830-02-31');
    expect(warning.getAttribute('role')).toBe('alert');
    expect(warning.textContent).toContain('not a valid calendar date');
  });

  it('shows an explanatory state when no diary date is selected', () => {
    expect(fixture.nativeElement.querySelector('#no-date-heading').textContent.trim()).toBe('Choose a diary day');
    expect(fixture.nativeElement.textContent).toContain('Select a fragment');
  });

  it('presents MARQUEE and IMAGE Fragments in one ordered list with explicit type metadata', () => {
    const imageWithReference: Fragment = {
      ...fragment(2, 2, '<p>Image entry</p>'),
      type: 'IMAGE',
      imageId: 101,
      marqueeId: null
    };
    const imageWithoutReference: Fragment = {
      ...fragment(3, 3, '<p>Unattached image entry</p>'),
      type: 'IMAGE',
      imageId: null,
      marqueeId: null
    };

    // Deliberately publish out of order: the day reader remains one chronology
    // sorted solely by Fragment.sequence regardless of Fragment type.
    fragments$.next([imageWithoutReference, fragment(1, 1), imageWithReference]);
    fixture.detectChanges();

    const items = Array.from(fixture.nativeElement.querySelectorAll('.fragment-item')) as HTMLElement[];
    expect(items).toHaveSize(3);
    expect(items.map(item => item.dataset['fragmentId'])).toEqual(['1', '2', '3']);
    expect(items.map(item => item.querySelector('.fragment-type')?.textContent?.trim())).toEqual([
      'MARQUEE', 'IMAGE', 'IMAGE'
    ]);
    expect(items[1].querySelector('.fragment-image-reference')?.textContent?.trim()).toBe('Image ID: 101');
    expect(items[2].querySelector('.fragment-image-reference')?.textContent?.trim()).toBe('No Image selected');
    expect(items[1].querySelector('.fragment-link')?.getAttribute('aria-label')).toBe('Open IMAGE fragment 2');
  });

  it('renders each catalogued IMAGE immediately under its header, independently of selection', async () => {
    const first: Fragment = { ...fragment(23, 2, '<p>First caption</p>'),
      type: 'IMAGE', imageId: 101, marqueeId: null };
    const second: Fragment = { ...fragment(24, 3, '<p>Second caption</p>'),
      type: 'IMAGE', imageId: 202, marqueeId: null };
    fragments$.next([fragment(22, 1, '<p>Legacy transcription</p>'), second, first]);
    fixture.detectChanges();
    catalogueImages.get(101)!.next(catalogueImage(101, 'diary-one/images/first map.jpg'));
    catalogueImages.get(202)!.next(catalogueImage(202, 'diary-one/images/second.png'));
    await fixture.whenStable();
    fixture.detectChanges();

    const items = Array.from(fixture.nativeElement.querySelectorAll('.fragment-item')) as HTMLElement[];
    expect(items.map(item => item.dataset['fragmentId'])).toEqual(['22', '23', '24']);
    expect(items[0].querySelector('.fragment-image-media')).toBeNull();

    const firstImage = items[1].querySelector('.fragment-image-media img') as HTMLImageElement;
    const secondImage = items[2].querySelector('.fragment-image-media img') as HTMLImageElement;
    expect(firstImage.src).toBe('http://localhost:8081/files/diary-one/images/first%20map.jpg');
    expect(secondImage.src).toBe('http://localhost:8081/files/diary-one/images/second.png');
    expect(firstImage.alt).toBe('Image alt 101');
    expect(items[1].querySelector('.fragment-image-reference')?.textContent?.trim()).toBe('Image ID: 101');
    expect(items[1].querySelector('.fragment-metadata')!.compareDocumentPosition(firstImage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(firstImage.compareDocumentPosition(items[1].querySelector('.fragment-content')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(modelContext.getLiveImage$).toHaveBeenCalledWith(101);
    expect(modelContext.getLiveImage$).toHaveBeenCalledWith(202);

    // Retained catalogue metadata updates must refresh the image without
    // changing the selected Fragment or rebinding the entire day list.
    catalogueImages.get(101)!.next(catalogueImage(101, 'diary-one/images/updated.jpg'));
    fixture.detectChanges();
    expect(firstImage.src).toBe('http://localhost:8081/files/diary-one/images/updated.jpg');
  });

  it('keeps an external image click separate from fragment navigation', async () => {
    const entry: Fragment = {
      ...fragment(23, 1, '<p>Link test</p>'), type: 'IMAGE', imageId: 101,
      imageLinkUrl: 'https://example.org/map?x=1&y=2#part', marqueeId: null
    };
    fragments$.next([entry]);
    fixture.detectChanges();
    catalogueImages.get(101)!.next(catalogueImage(101, 'diary-one/images/map.jpg'));
    await fixture.whenStable();
    fixture.detectChanges();

    const anchor = fixture.nativeElement.querySelector('.fragment-image-media a') as HTMLAnchorElement;
    expect(anchor.href).toBe('https://example.org/map?x=1&y=2#part');
    anchor.addEventListener('click', event => event.preventDefault());
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    anchor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    expect(modelContext.setFragmentId).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not make an IMAGE clickable when its stored external URL is unsafe', async () => {
    const entry: Fragment = {
      ...fragment(23, 1), type: 'IMAGE', imageId: 101,
      imageLinkUrl: 'javascript:alert(1)', marqueeId: null
    };
    fragments$.next([entry]);
    fixture.detectChanges();
    catalogueImages.get(101)!.next(catalogueImage(101, 'diary-one/images/map.png'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.fragment-image-media img')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.fragment-image-media a')).toBeNull();
  });

  it('shows a non-clickable unavailable state for an unresolved catalogue reference', async () => {
    fragments$.next([{
      ...fragment(23, 1, '<p>Keep this text</p>'), type: 'IMAGE', imageId: 999,
      marqueeId: null
    }]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.fragment-image-media img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.fragment-image-media__unavailable')?.textContent)
      .toContain('Image 999 preview unavailable');
    expect(fixture.nativeElement.querySelector('.fragment-content')?.textContent)
      .toContain('Keep this text');
  });

  it('keeps fragment navigation separate from the accessible drag handle', () => {
    fragments$.next([fragment(1, 1)]);
    modelContext.getLivePage$.and.returnValue(of({ diaryId: 5 } as any));
    fixture.detectChanges();

    const handle = fixture.nativeElement.querySelector('.drag-handle') as HTMLButtonElement;
    const link = fixture.nativeElement.querySelector('.fragment-link') as HTMLElement;

    expect(handle.getAttribute('aria-label')).toBe('Drag to reorder fragment 1');
    expect(handle.closest('.fragment-link')).toBeNull();

    link.click();
    expect(modelContext.getLivePage$).toHaveBeenCalledOnceWith(77);
    expect(router.navigate).toHaveBeenCalledOnceWith(['/diary', 5, 77, 1]);
    expect(modelContext.setFragmentId).toHaveBeenCalledWith(1);
    expect(modelContext.setMarqueeId).not.toHaveBeenCalled();
  });

  it('marks the selected fragment and resolves its legacy image URL', async () => {
    const selected = fragment(7, 1, '<img src="images/map.png">');
    fragments$.next([selected]);
    selectedFragment$.next(selected);
    await fixture.whenStable();
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('.fragment-item') as HTMLElement;
    const image = fixture.nativeElement.querySelector('.fragment-content img') as HTMLImageElement;

    expect(item.classList).toContain('is-selected');
    expect(item.getAttribute('aria-current')).toBe('true');
    expect(image.src).toBe('http://localhost:8081/files/diary%20one/images/map.png');
  });

  it('keeps an unresolved legacy fragment selected without guessing its source page', () => {
    const legacyImage = { ...fragment(7, 1), pageId: null, marqueeId: null } as Fragment;

    component.goToFragment(legacyImage);

    expect(modelContext.setFragmentId).toHaveBeenCalledOnceWith(7);
    expect(modelContext.setMarqueeId).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(alertService.error).toHaveBeenCalledWith('Fragment 7 has no authoritative source page');
  });

  it('navigates an IMAGE Fragment by authoritative pageId and delegates Marquee state to ModelContext', () => {
    const imageFragment: Fragment = {
      ...fragment(84, 2),
      pageId: 99,
      type: 'IMAGE',
      imageId: 101,
      marqueeId: null
    };
    modelContext.getLivePage$.and.returnValue(of({ diaryId: 12 } as any));

    component.goToFragment(imageFragment);

    expect(modelContext.setFragmentId).toHaveBeenCalledOnceWith(84);
    expect(modelContext.setMarqueeId).not.toHaveBeenCalled();
    expect(modelContext.getLivePage$).toHaveBeenCalledOnceWith(99);
    expect(router.navigate).toHaveBeenCalledOnceWith(['/diary', 12, 99, 84]);
  });

  it('navigates a page-owned fragment even when it has no marquee', () => {
    const withoutMarquee = { ...fragment(7, 1), marqueeId: null } as Fragment;
    modelContext.getLivePage$.and.returnValue(of({ diaryId: 5 } as any));

    component.goToFragment(withoutMarquee);

    expect(modelContext.getLivePage$).toHaveBeenCalledOnceWith(77);
    expect(router.navigate).toHaveBeenCalledOnceWith(['/diary', 5, 77, 7]);
  });

  it('locks the fragment and sends a cloned temporary sequence when moving bottom to top', async () => {
    const fragments = [fragment(1, 1), fragment(2, 2), fragment(3, 3)];
    component.dataSource.data = fragments;
    fragmentLockService.lockFragmentForEdit.and.resolveTo(true);
    rpcService.updateFragment$.and.returnValue(of(3));

    await component.drop(dropEvent(2, 0));

    expect(fragmentLockService.lockFragmentForEdit).toHaveBeenCalledOnceWith(3);
    expect(rpcService.updateFragment$).toHaveBeenCalledTimes(1);

    const update = rpcService.updateFragment$.calls.mostRecent().args[0];
    expect(update).not.toBe(fragments[2]);
    expect(update.sequence).toBe(-999);
    expect(fragments[2].sequence).toBe(3);
    expect(component.dataSource.data.map(item => item.id)).toEqual([3, 1, 2]);
    expect(component.dataSource.data.map(item => item.sequence)).toEqual([1, 2, 3]);
    expect(fragmentLockService.unlockFragmentAfterFailedEdit).not.toHaveBeenCalled();
    expect(component.reorderInFlight).toBeFalse();
  });


  it('reorders an IMAGE Fragment through the ordinary preserve path with imageId omitted on the wire request', async () => {
    const imageFragment: Fragment = {
      ...fragment(3, 3),
      type: 'IMAGE',
      imageId: 101,
      marqueeId: null
    };
    const fragments = [fragment(1, 1), fragment(2, 2), imageFragment];
    component.dataSource.data = fragments;
    fragmentLockService.lockFragmentForEdit.and.resolveTo(true);
    rpcService.updateFragment$.and.returnValue(of(3));

    await component.drop(dropEvent(2, 0));

    expect(rpcService.updateFragment$).toHaveBeenCalledTimes(1);
    expect(rpcService.updateImageFragment$).not.toHaveBeenCalled();

    const payload = rpcService.updateFragment$.calls.mostRecent().args[0];
    expect(payload.type).toBe('IMAGE');
    expect(payload.imageId).toBe(101);
    expect(payload.sequence).toBe(-999);

    const wireRequest = UpdateFragmentRequest.fromFragment(payload);
    expect(Object.hasOwn(wireRequest, 'marqueeId')).toBeFalse();
    expect(Object.hasOwn(wireRequest, 'imageId')).toBeFalse();
  });

  it('accepts retained normalisation for mixed MARQUEE/IMAGE chronology without changing Image references', async () => {
    const imageA: Fragment = {
      ...fragment(2, 2),
      type: 'IMAGE',
      imageId: 101,
      marqueeId: null,
      version: 4
    };
    const marquee = fragment(1, 1);
    const imageB: Fragment = {
      ...fragment(3, 3),
      type: 'IMAGE',
      imageId: 202,
      marqueeId: null,
      version: 8
    };

    fragments$.next([marquee, imageA, imageB]);
    fragmentLockService.lockFragmentForEdit.and.resolveTo(true);
    rpcService.updateFragment$.and.returnValue(of(imageB.id));

    await component.drop(dropEvent(2, 0));

    const wireRequest = UpdateFragmentRequest.fromFragment(
      rpcService.updateFragment$.calls.mostRecent().args[0]
    );
    expect(Object.hasOwn(wireRequest, 'marqueeId')).toBeFalse();
    expect(Object.hasOwn(wireRequest, 'imageId')).toBeFalse();

    const retainedNormalised: Fragment[] = [
      { ...imageB, sequence: 1, version: 9, lock: null },
      { ...marquee, sequence: 2, version: 1, lock: null },
      { ...imageA, sequence: 3, version: 5, lock: null }
    ];
    fragments$.next(retainedNormalised);

    expect(component.dataSource.data.map(item => [item.id, item.sequence, item.version, item.imageId ?? null])).toEqual([
      [imageB.id, 1, 9, 202],
      [marquee.id, 2, 1, null],
      [imageA.id, 3, 5, 101]
    ]);
    expect(fragmentLockService.unlockFragmentAfterFailedEdit).not.toHaveBeenCalled();
  });

  it('keeps the original order when the fragment cannot be locked', async () => {
    const fragments = [fragment(1, 1), fragment(2, 2), fragment(3, 3)];
    component.dataSource.data = fragments;
    fragmentLockService.lockFragmentForEdit.and.resolveTo(false);

    await component.drop(dropEvent(2, 0));

    expect(rpcService.updateFragment$).not.toHaveBeenCalled();
    expect(component.dataSource.data).toEqual(fragments);
    expect(component.dataSource.data.map(item => item.sequence)).toEqual([1, 2, 3]);
    expect(fragmentLockService.unlockFragmentAfterFailedEdit).not.toHaveBeenCalled();
    expect(component.reorderInFlight).toBeFalse();
  });

  it('restores the original order and unlocks after an update failure', async () => {
    const fragments = [fragment(1, 1), fragment(2, 2), fragment(3, 3)];
    const error = new Error('update failed');
    component.dataSource.data = fragments;
    fragmentLockService.lockFragmentForEdit.and.resolveTo(true);
    fragmentLockService.unlockFragmentAfterFailedEdit.and.resolveTo();
    rpcService.updateFragment$.and.returnValue(throwError(() => error));

    await component.drop(dropEvent(2, 0));

    expect(fragmentLockService.unlockFragmentAfterFailedEdit).toHaveBeenCalledOnceWith(3);
    expect(component.dataSource.data).toEqual(fragments);
    expect(component.dataSource.data.map(item => item.sequence)).toEqual([1, 2, 3]);
    expect(alertService.error).toHaveBeenCalledTimes(1);
    expect(alertService.error.calls.mostRecent().args[0] as unknown).toBe(error);
    expect(component.reorderInFlight).toBeFalse();
  });

  it('blocks duplicate drops and disables drag handles while a reorder is in flight', async () => {
    fragments$.next([fragment(1, 1), fragment(2, 2)]);
    component.reorderInFlight = true;
    fixture.detectChanges();

    await component.drop(dropEvent(1, 0));

    const handles = Array.from(fixture.nativeElement.querySelectorAll('.drag-handle')) as HTMLButtonElement[];
    expect(handles.every(handle => handle.disabled)).toBeTrue();
    expect(fragmentLockService.lockFragmentForEdit).not.toHaveBeenCalled();
    expect(rpcService.updateFragment$).not.toHaveBeenCalled();
  });

  function catalogueImage(id: number, relativePath: string): CatalogueImage {
    return {
      id, version: 0, relativePath, mimeType: 'image/jpeg',
      originalFilename: `photo-${id}.jpg`, width: 800, height: 600,
      checksum: 'synthetic', caption: '', altText: `Image alt ${id}`
    };
  }

  function fragment(
    id: number,
    sequence: number,
    text = `fragment ${id}`,
    year = 1830,
    month = 2,
    day = 1
  ): Fragment {
    return {
      id,
      pageId: 77,
      type: 'MARQUEE',
      marqueeId: id + 100,
      year,
      month,
      day,
      sequence,
      version: 0,
      text,
      lock: null
    };
  }

  function dropEvent(previousIndex: number, currentIndex: number): CdkDragDrop<Fragment[]> {
    return { previousIndex, currentIndex } as CdkDragDrop<Fragment[]>;
  }
});
