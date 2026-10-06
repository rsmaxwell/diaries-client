import { BehaviorSubject } from 'rxjs';

import { Fragment } from '../model/fragment';
import { CatalogueImage } from '../model/image';
import { ImageFragmentReferenceComponent } from './image-fragment-reference.component';

describe('ImageFragmentReferenceComponent', () => {
  const image: CatalogueImage = {
    id: 101,
    version: 2,
    relativePath: 'diary-1830/images/scan 1.jpg',
    mimeType: 'image/jpeg',
    originalFilename: 'scan 1.jpg',
    width: 1200,
    height: 1800,
    checksum: 'abc',
    caption: 'Map',
    altText: 'A map'
  };

  function createHarness(fragment: Fragment | null, selectedImage: CatalogueImage | null) {
    const selectedFragment$ = new BehaviorSubject<Fragment | null>(fragment);
    const selectedImage$ = new BehaviorSubject<CatalogueImage | null>(selectedImage);
    const canSelectOrReplaceImage$ = new BehaviorSubject<boolean>(fragment?.type === 'IMAGE');
    const canClearImage$ = new BehaviorSubject<boolean>(
      fragment?.type === 'IMAGE' && Number.isInteger(fragment.imageId) && (fragment.imageId as number) > 0
    );
    const imageMutationInFlight$ = new BehaviorSubject<boolean>(false);
    const component = new ImageFragmentReferenceComponent(
      { selectedFragment$, selectedImage$ } as any,
      { getConfig: () => Promise.resolve({ baseUrl: 'http://localhost:8081', files: 'files' }) } as any,
      { canSelectOrReplaceImage$, canClearImage$, imageMutationInFlight$ } as any
    );
    return {
      component, selectedFragment$, selectedImage$,
      canSelectOrReplaceImage$, canClearImage$, imageMutationInFlight$
    };
  }

  it('is absent for a MARQUEE Fragment', async () => {
    const h = createHarness({
      id: 1, pageId: 2, type: 'MARQUEE', imageId: null, marqueeId: 3,
      year: 1830, month: 1, day: 1, sequence: 1000, version: 0, text: ''
    }, null);
    const value = await new Promise<any>(resolve => h.component.viewModel$.subscribe(resolve));
    expect(value).toBeNull();
  });

  it('shows an unattached IMAGE Fragment without manufacturing a URL', async () => {
    const h = createHarness({
      id: 84, pageId: 22, type: 'IMAGE', imageId: null, marqueeId: null,
      year: 1830, month: 1, day: 1, sequence: 1000, version: 0, text: ''
    }, null);
    const value = await new Promise<any>(resolve => h.component.viewModel$.subscribe(v => v && resolve(v)));
    expect(value.hasImageReference).toBeFalse();
    expect(value.imageUrl).toBeNull();
    expect(value.unresolved).toBeFalse();
  });

  it('derives a static Files URL only from retained catalogue metadata', async () => {
    const h = createHarness({
      id: 84, pageId: 22, type: 'IMAGE', imageId: 101, marqueeId: null,
      year: 1830, month: 1, day: 1, sequence: 1000, version: 0, text: ''
    }, image);
    const value = await new Promise<any>(resolve => h.component.viewModel$.subscribe(v => v?.imageUrl && resolve(v)));
    expect(value.imageId).toBe(101);
    expect(value.image).toEqual(image);
    expect(value.imageUrl).toBe('http://localhost:8081/files/diary-1830/images/scan%201.jpg');
    expect(value.unresolved).toBeFalse();
  });

  it('shows an unresolved state after retained Image metadata tombstones', async () => {
    const h = createHarness({
      id: 84, pageId: 22, type: 'IMAGE', imageId: 101, marqueeId: null,
      year: 1830, month: 1, day: 1, sequence: 1000, version: 0, text: ''
    }, image);
    const values: any[] = [];
    const sub = h.component.viewModel$.subscribe(v => values.push(v));
    await Promise.resolve();
    h.selectedImage$.next(null);
    await Promise.resolve();
    const latest = values[values.length - 1];
    expect(latest.imageId).toBe(101);
    expect(latest.image).toBeNull();
    expect(latest.imageUrl).toBeNull();
    expect(latest.unresolved).toBeTrue();
    expect(latest.hasImageReference).toBeTrue();
    sub.unsubscribe();
  });
  it('projects deterministic action availability and busy state into the view model', async () => {
    const h = createHarness({
      id: 84, pageId: 22, type: 'IMAGE', imageId: 101, marqueeId: null,
      year: 1830, month: 1, day: 1, sequence: 1000, version: 0, text: ''
    }, image);
    const values: any[] = [];
    const sub = h.component.viewModel$.subscribe(v => values.push(v));
    await Promise.resolve();

    expect(values[values.length - 1].canSelectOrReplace).toBeTrue();
    expect(values[values.length - 1].canClear).toBeTrue();
    expect(values[values.length - 1].mutationInFlight).toBeFalse();

    h.imageMutationInFlight$.next(true);
    h.canSelectOrReplaceImage$.next(false);
    h.canClearImage$.next(false);
    await Promise.resolve();
    expect(values[values.length - 1].mutationInFlight).toBeTrue();
    expect(values[values.length - 1].canSelectOrReplace).toBeFalse();
    expect(values[values.length - 1].canClear).toBeFalse();
    sub.unsubscribe();
  });

});
