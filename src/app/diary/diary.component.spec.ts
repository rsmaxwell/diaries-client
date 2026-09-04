import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { AlertService } from '../alerts/alert.service';
import { ClientBuildInfoService } from '../build-info/client-build-info.service';
import { Diary } from '../model/diary';
import { ModelContext } from '../model/model-context';
import { Page } from '../model/page';
import { RpcService } from '../mqtt/rpc.service';
import { DiaryComponent } from './diary.component';

describe('DiaryComponent', () => {
  let component: DiaryComponent;
  let fixture: ComponentFixture<DiaryComponent>;
  let router: jasmine.SpyObj<Router>;
  let rpcService: jasmine.SpyObj<RpcService>;
  const diary$ = new BehaviorSubject<Diary>(new Diary(7, 0, 1000, 'Travel diary'));
  const pages$ = new BehaviorSubject<Page[]>([]);

  beforeEach(async () => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    rpcService = jasmine.createSpyObj<RpcService>('RpcService', [
      'updatePage$',
      'normalisePages$',
      'getResponderVersion$'
    ]);
    rpcService.updatePage$.and.returnValue(of(1));
    rpcService.normalisePages$.and.returnValue(of(1));
    rpcService.getResponderVersion$.and.returnValue(of({
      name: 'responder', version: 'responder-test', buildID: 'test', builddate: '',
      gitCommit: '', gitBranch: '', gitURL: ''
    }));

    const modelContext = {
      selectedDiary$: diary$,
      pages$: pages$,
      setDiaryId: jasmine.createSpy('setDiaryId'),
      cleanupTopicTree: jasmine.createSpy('cleanupTopicTree')
    };

    await TestBed.configureTestingModule({
      imports: [DiaryComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ diaryId: '7' })) } },
        { provide: RpcService, useValue: rpcService },
        { provide: ModelContext, useValue: modelContext },
        { provide: AlertService, useValue: { error: jasmine.createSpy('error'), getAlerts: () => of([]) } },
        { provide: ClientBuildInfoService, useValue: { getBuildInfo: () => of({ version: 'client-test' }) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DiaryComponent);
    component = fixture.componentInstance;
  });

  it('renders the diary heading and pages as reader navigation', () => {
    pages$.next([page(11, 1000, 'A page name long enough to wrap naturally without being clipped')]);
    fixture.detectChanges();

    const name = fixture.nativeElement.querySelector('.item-name') as HTMLElement;

    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    expect(fixture.nativeElement.querySelector('h1').textContent.trim()).toBe('Travel diary');
    expect(name.textContent?.trim()).toContain('A page name long enough');
    expect(getComputedStyle(name).overflowWrap).toBe('anywhere');
    expect(fixture.nativeElement.querySelector('.item-metadata').textContent).toContain('Page 11');
  });

  it('keeps page navigation separate from the accessible drag handle', () => {
    pages$.next([page(11, 1000, 'January 1')]);
    fixture.detectChanges();

    const handle = fixture.nativeElement.querySelector('.drag-handle') as HTMLButtonElement;
    const link = fixture.nativeElement.querySelector('.reader-link') as HTMLButtonElement;

    expect(handle.getAttribute('aria-label')).toBe('Drag to reorder January 1');
    expect(handle.closest('.reader-link')).toBeNull();

    link.click();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/diary/7/11']);
  });

  it('preserves page resequencing without triggering navigation', () => {
    const pages = [page(11, 1000, 'First'), page(12, 2000, 'Second'), page(13, 3000, 'Third')];
    pages$.next(pages);
    fixture.detectChanges();

    component.drop(dropEvent(2, 0));

    expect(component.dataSource.data.map(pageItem => pageItem.id)).toEqual([13, 11, 12]);
    expect(rpcService.updatePage$).toHaveBeenCalledOnceWith(pages[2]);
    expect(pages[2].sequence).toBe(0);
    expect(rpcService.normalisePages$).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  function page(id: number, sequence: number, name: string): Page {
    return new Page(id, 7, name, 'jpg', 1200, 900, sequence, 0);
  }

  function dropEvent(previousIndex: number, currentIndex: number): CdkDragDrop<Page[]> {
    return { previousIndex, currentIndex } as CdkDragDrop<Page[]>;
  }
});
