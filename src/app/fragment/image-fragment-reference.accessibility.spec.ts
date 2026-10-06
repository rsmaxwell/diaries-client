import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';

import { ConfigService } from '../config/config.service';
import { Fragment } from '../model/fragment';
import { CatalogueImage } from '../model/image';
import { ModelContext } from '../model/model-context';
import { ImageFragmentActionStateService } from './image-fragment-action-state.service';
import { ImageFragmentReferenceComponent } from './image-fragment-reference.component';

describe('ImageFragmentReferenceComponent accessibility/action state', () => {
  let fixture: ComponentFixture<ImageFragmentReferenceComponent>;
  const fragment: Fragment = {
    id: 84, pageId: 22, type: 'IMAGE', imageId: 101, marqueeId: null,
    year: 1830, month: 1, day: 1, sequence: 1000, version: 0, text: ''
  };
  const image: CatalogueImage = {
    id: 101,
    version: 0,
    relativePath: 'diary/images/scan.jpg',
    mimeType: 'image/jpeg',
    originalFilename: 'scan.jpg',
    width: 1600,
    height: 1200,
    checksum: 'ab'.repeat(32),
    caption: '',
    altText: ''
  };
  const selectedFragment$ = new BehaviorSubject<Fragment | null>(fragment);
  const selectedImage$ = new BehaviorSubject<CatalogueImage | null>(image);
  const canSelectOrReplaceImage$ = new BehaviorSubject(true);
  const canClearImage$ = new BehaviorSubject(true);
  const imageMutationInFlight$ = new BehaviorSubject(false);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageFragmentReferenceComponent],
      providers: [
        { provide: ModelContext, useValue: { selectedFragment$, selectedImage$ } },
        { provide: ConfigService, useValue: { getConfig: () => Promise.resolve({ baseUrl: 'http://localhost', files: 'files' }) } },
        {
          provide: ImageFragmentActionStateService,
          useValue: { canSelectOrReplaceImage$, canClearImage$, imageMutationInFlight$ }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ImageFragmentReferenceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('gives both Image authoring actions accessible labels and explanatory titles', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons).toHaveSize(2);
    expect(buttons.every(button => Boolean(button.getAttribute('aria-label')))).toBeTrue();
    expect(buttons.every(button => Boolean(button.getAttribute('title')))).toBeTrue();
  });

  it('disables both actions and exposes polite busy state during a mutation workflow', async () => {
    imageMutationInFlight$.next(true);
    canSelectOrReplaceImage$.next(false);
    canClearImage$.next(false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons.every(button => button.disabled)).toBeTrue();
    expect(buttons.every(button => button.getAttribute('aria-busy') === 'true')).toBeTrue();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain('Image reference edit in progress');
  });
});
