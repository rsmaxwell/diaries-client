import { BehaviorSubject, firstValueFrom, take } from 'rxjs';

import { Fragment } from '../model/fragment';
import { ImageFragmentActionStateService } from './image-fragment-action-state.service';

describe('ImageFragmentActionStateService', () => {
  const marquee: Fragment = {
    id: 33, pageId: 22, type: 'MARQUEE', imageId: null, marqueeId: 44,
    year: 1830, month: 2, day: 3, sequence: 1000, version: 0, text: ''
  };
  const image: Fragment = {
    id: 84, pageId: 22, type: 'IMAGE', imageId: 101, marqueeId: null,
    year: 1830, month: 2, day: 3, sequence: 1500, version: 0, text: ''
  };

  function createHarness(fragment: Fragment | null = marquee) {
    const selectedFragment$ = new BehaviorSubject<Fragment | null>(fragment);
    const selectedPage$ = new BehaviorSubject<any>({ id: 22, diaryId: 11 });
    const selectedDiary$ = new BehaviorSubject<any>({ id: 11, name: 'diary-1830' });
    const service = new ImageFragmentActionStateService({
      selectedFragment$,
      selectedPage$,
      selectedDiary$
    } as any);
    return { service, selectedFragment$, selectedPage$, selectedDiary$ };
  }

  it('derives selected IMAGE and attached-Image state from retained Fragment truth', () => {
    const h = createHarness(image);
    let selectedIsImage = false;
    let selectedHasImage = false;

    const subscriptions = [
      h.service.selectedFragmentIsImage$.subscribe(value => selectedIsImage = value),
      h.service.selectedImageHasAttachedImage$.subscribe(value => selectedHasImage = value)
    ];

    try {
      // The service deliberately startWith(null), so assert the latest synchronous
      // derived state rather than the first transient "no retained selection" value.
      expect(selectedIsImage).toBeTrue();
      expect(selectedHasImage).toBeTrue();

      h.selectedFragment$.next({ ...image, imageId: null });
      expect(selectedHasImage).toBeFalse();

      h.selectedFragment$.next(marquee);
      expect(selectedIsImage).toBeFalse();
    } finally {
      subscriptions.forEach(subscription => subscription.unsubscribe());
    }
  });

  it('derives Add Image Fragment availability from authoritative diary/page/day context', async () => {
    const h = createHarness(marquee);
    expect(await firstValueFrom(h.service.canAddImageFragment$.pipe(take(1)))).toBeTrue();

    h.selectedPage$.next({ id: 23, diaryId: 11 });
    expect(await firstValueFrom(h.service.canAddImageFragment$.pipe(take(1)))).toBeFalse();
  });

  it('suppresses all duplicate Image authoring actions while Add is active', async () => {
    const h = createHarness(image);

    expect(h.service.tryBeginAddImageFragment()).toBeTrue();
    expect(h.service.tryBeginAddImageFragment()).toBeFalse();
    expect(h.service.tryBeginImageMutation()).toBeFalse();
    expect(await firstValueFrom(h.service.canAddImageFragment$.pipe(take(1)))).toBeFalse();
    expect(await firstValueFrom(h.service.canSelectOrReplaceImage$.pipe(take(1)))).toBeFalse();
    expect(await firstValueFrom(h.service.canClearImage$.pipe(take(1)))).toBeFalse();

    h.service.endAddImageFragment();
    expect(await firstValueFrom(h.service.canSelectOrReplaceImage$.pipe(take(1)))).toBeTrue();
    expect(await firstValueFrom(h.service.canClearImage$.pipe(take(1)))).toBeTrue();
  });

  it('suppresses duplicate select/clear actions while an Image mutation workflow is active', async () => {
    const h = createHarness(image);

    expect(h.service.tryBeginImageMutation()).toBeTrue();
    expect(h.service.tryBeginImageMutation()).toBeFalse();
    expect(h.service.tryBeginAddImageFragment()).toBeFalse();
    expect(await firstValueFrom(h.service.imageMutationInFlight$.pipe(take(1)))).toBeTrue();

    h.service.endImageMutation();
    expect(await firstValueFrom(h.service.imageMutationInFlight$.pipe(take(1)))).toBeFalse();
  });
});
