import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { AlertService } from '../alerts/alert.service';
import { ClientBuildInfoService } from '../build-info/client-build-info.service';
import { Diary } from '../model/diary';
import { ModelContext } from '../model/model-context';
import { RpcService } from '../mqtt/rpc.service';
import { DiariesComponent } from './diaries.component';

describe('DiariesComponent', () => {
  let component: DiariesComponent;
  let fixture: ComponentFixture<DiariesComponent>;
  let router: jasmine.SpyObj<Router>;
  let rpcService: jasmine.SpyObj<RpcService>;
  const diaries$ = new BehaviorSubject<Diary[]>([]);

  beforeEach(async () => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    rpcService = jasmine.createSpyObj<RpcService>('RpcService', [
      'updateDiary$',
      'normaliseDiaries$',
      'getResponderVersion$'
    ]);
    rpcService.updateDiary$.and.returnValue(of(1));
    rpcService.normaliseDiaries$.and.returnValue(of(1));
    rpcService.getResponderVersion$.and.returnValue(of({
      name: 'responder', version: 'responder-test', buildID: 'test', builddate: '',
      gitCommit: '', gitBranch: '', gitURL: ''
    }));

    const modelContext = {
      getDiaries$: () => diaries$,
      cleanupTopicTree: jasmine.createSpy('cleanupTopicTree')
    };

    await TestBed.configureTestingModule({
      imports: [DiariesComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: RpcService, useValue: rpcService },
        { provide: ModelContext, useValue: modelContext },
        { provide: AlertService, useValue: { error: jasmine.createSpy('error'), getAlerts: () => of([]) } },
        { provide: ClientBuildInfoService, useValue: { getBuildInfo: () => of({ version: 'client-test' }) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DiariesComponent);
    component = fixture.componentInstance;
  });

  it('renders diaries as reader navigation with prominent wrapping names and metadata', () => {
    diaries$.next([
      new Diary(7, 0, 1000, 'A diary name long enough to wrap naturally without being clipped')
    ]);
    fixture.detectChanges();

    const item = fixture.nativeElement.querySelector('.reader-item') as HTMLElement;
    const name = item.querySelector('.item-name') as HTMLElement;

    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
    expect(name.textContent?.trim()).toContain('A diary name long enough');
    expect(getComputedStyle(name).overflowWrap).toBe('anywhere');
    expect(item.querySelector('.item-metadata')?.textContent).toContain('Diary 7');
    expect(item.querySelector('.item-metadata')?.textContent).toContain('Position 1000');
  });

  it('keeps navigation separate from the accessible drag handle', () => {
    diaries$.next([new Diary(7, 0, 1000, 'Travel diary')]);
    fixture.detectChanges();

    const handle = fixture.nativeElement.querySelector('.drag-handle') as HTMLButtonElement;
    const link = fixture.nativeElement.querySelector('.reader-link') as HTMLButtonElement;

    expect(handle.getAttribute('aria-label')).toBe('Drag to reorder Travel diary');
    expect(handle.closest('.reader-link')).toBeNull();

    link.click();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/diary/7']);
  });

  it('preserves diary resequencing without triggering navigation', () => {
    const diaries = [
      new Diary(1, 0, 1000, 'First'),
      new Diary(2, 0, 2000, 'Second'),
      new Diary(3, 0, 3000, 'Third')
    ];
    diaries$.next(diaries);
    fixture.detectChanges();

    component.drop(dropEvent(2, 0));

    expect(component.dataSource.data.map(diary => diary.id)).toEqual([3, 1, 2]);
    expect(rpcService.updateDiary$).toHaveBeenCalledOnceWith(diaries[2]);
    expect(diaries[2].sequence).toBe(0);
    expect(rpcService.normaliseDiaries$).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  function dropEvent(previousIndex: number, currentIndex: number): CdkDragDrop<Diary[]> {
    return { previousIndex, currentIndex } as CdkDragDrop<Diary[]>;
  }
});
