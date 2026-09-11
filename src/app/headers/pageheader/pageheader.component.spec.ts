import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from '@angular/cdk/dialog';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { AlertService } from '../../alerts/alert.service';
import { ModelContext } from '../../model/model-context';
import { RpcService } from '../../mqtt/rpc.service';
import { PageheaderComponent } from './pageheader.component';

describe('PageheaderComponent', () => {
  let component: PageheaderComponent;
  let fixture: ComponentFixture<PageheaderComponent>;

  const selectedFragment$ = new BehaviorSubject<any>({
    id: 33, pageId: 22, type: 'MARQUEE', marqueeId: 44
  });
  const selectedPage$ = new BehaviorSubject<any>({ id: 22 });
  const selectedMarquee$ = new BehaviorSubject<any>({ id: 44, fragmentId: 33, pageId: 22 });
  const modelContext = {
    hasSelectedPage$: new BehaviorSubject(true),
    hasSelectedFragment$: new BehaviorSubject(true),
    hasSelectedMarquee$: new BehaviorSubject(true),
    selectedDiary$: new BehaviorSubject<any>({ id: 11, name: 'Diary' }),
    selectedPage$,
    selectedFragment$,
    selectedMarquee$,
    editMarqueeMode$: new BehaviorSubject(false)
  };

  beforeEach(async () => {
    selectedFragment$.next({ id: 33, pageId: 22, type: 'MARQUEE', marqueeId: 44 });
    selectedPage$.next({ id: 22 });
    selectedMarquee$.next({ id: 44, fragmentId: 33, pageId: 22 });

    await TestBed.configureTestingModule({
      imports: [PageheaderComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ModelContext, useValue: modelContext },
        { provide: RpcService, useValue: { uploadFile$: () => of(null), listFiles$: () => of({}) } },
        { provide: Dialog, useValue: jasmine.createSpyObj<Dialog>('Dialog', ['open']) },
        { provide: Router, useValue: { url: '/fragment', navigate: jasmine.createSpy('navigate') } },
        AlertService
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PageheaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('preserves all editing action outputs', () => {
    const createMarquee = spyOn(component.createMarquee, 'emit');
    const editMarquee = spyOn(component.editMarquee, 'emit');
    const deleteMarquee = spyOn(component.deleteMarquee, 'emit');
    const add = spyOn(component.add, 'emit');
    const deleteFragment = spyOn(component.delete, 'emit');
    const listFiles = spyOn(component.listFiles, 'emit');

    component.onCreateMarqueeClick();
    component.onEditMarqueeClick();
    component.onDeleteMarqueeClick();
    component.onAddClick();
    component.onDeleteClick();
    component.onListFilesClick();

    expect(createMarquee).toHaveBeenCalled();
    expect(editMarquee).toHaveBeenCalled();
    expect(deleteMarquee).toHaveBeenCalled();
    expect(add).toHaveBeenCalled();
    expect(deleteFragment).toHaveBeenCalled();
    expect(listFiles).toHaveBeenCalled();
  });

  it('gives every toolbar action an accessible name', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

    expect(buttons.length).toBe(8);
    expect(buttons.every(button => Boolean(button.getAttribute('aria-label')))).toBeTrue();
  });

  it('disables all marquee controls for an explicit image fragment', async () => {
    selectedFragment$.next({ id: 33, pageId: 22, type: 'IMAGE', marqueeId: null });
    selectedMarquee$.next(null);
    await fixture.whenStable();
    fixture.detectChanges();

    const controls = Array.from(
      fixture.nativeElement.querySelectorAll(
        '[aria-label="Add marquee to selected fragment"], ' +
        '[aria-label="Move or resize selected marquee"], ' +
        '[aria-label="Delete marquee from selected fragment"]'
      )
    ) as HTMLButtonElement[];
    expect(controls).toHaveSize(3);
    expect(controls.every(button => button.disabled)).toBeTrue();
  });
});
