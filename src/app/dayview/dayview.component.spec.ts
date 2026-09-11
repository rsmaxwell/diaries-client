import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { AlertService } from '../alerts/alert.service';
import { ConfigService } from '../config/config.service';
import { Diary } from '../model/diary';
import { FragmentLockService } from '../fragment/fragment-lock.service';
import { Fragment } from '../model/fragment';
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

  beforeEach(async () => {
    fragments$ = new BehaviorSubject<Fragment[]>([]);
    selectedFragment$ = new BehaviorSubject<Fragment | null>(null);
    selectedDiary$ = new BehaviorSubject<Diary>({
      id: 5,
      version: 0,
      name: 'diary one',
      sequence: 1
    });
    rpcService = jasmine.createSpyObj<RpcService>('RpcService', ['updateFragment$']);
    fragmentLockService = jasmine.createSpyObj<FragmentLockService>('FragmentLockService', [
      'lockFragmentForEdit',
      'unlockFragmentAfterFailedEdit'
    ]);
    alertService = jasmine.createSpyObj<AlertService>('AlertService', ['error']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/day' });
    modelContext = jasmine.createSpyObj<ModelContext>(
      'ModelContext',
      ['getLiveMarquee$', 'getLivePage$', 'setFragmentId', 'setMarqueeId'],
      {
        selectFragmentsForDate$: fragments$,
        selectedFragment$,
        selectedDiary$
      }
    );

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
    expect(fixture.nativeElement.textContent).toContain('Select a marquee');
  });

  it('keeps fragment navigation separate from the accessible drag handle', () => {
    fragments$.next([fragment(1, 1)]);
    modelContext.getLiveMarquee$.and.returnValue(of({ id: 101, pageId: 77 } as any));
    modelContext.getLivePage$.and.returnValue(of({ diaryId: 5 } as any));
    fixture.detectChanges();

    const handle = fixture.nativeElement.querySelector('.drag-handle') as HTMLButtonElement;
    const link = fixture.nativeElement.querySelector('.fragment-link') as HTMLElement;

    expect(handle.getAttribute('aria-label')).toBe('Drag to reorder fragment 1');
    expect(handle.closest('.fragment-link')).toBeNull();

    link.click();
    expect(modelContext.getLiveMarquee$).toHaveBeenCalledOnceWith(101);
    expect(modelContext.getLivePage$).toHaveBeenCalledOnceWith(77);
    expect(router.navigate).toHaveBeenCalledOnceWith(['/diary', 5, 77, 1]);
    expect(modelContext.setFragmentId).toHaveBeenCalledWith(1);
    expect(modelContext.setMarqueeId).toHaveBeenCalledWith(101);
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

  it('selects a marquee-less legacy image fragment without changing the source page', () => {
    const legacyImage = { ...fragment(7, 1), marqueeId: null } as Fragment;

    component.goToFragment(legacyImage);

    expect(modelContext.setFragmentId).toHaveBeenCalledOnceWith(7);
    expect(modelContext.setMarqueeId).toHaveBeenCalledOnceWith(null);
    expect(router.navigate).not.toHaveBeenCalled();
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
