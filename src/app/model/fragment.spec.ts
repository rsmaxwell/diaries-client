import {
  AddImageFragmentRequest,
  effectiveFragmentType,
  Fragment,
  ImageFragment,
  hasAuthoritativePage,
  isMarqueeFragment,
  UpdateFragmentRequest,
  UpdateImageFragmentRequest
} from './fragment';

describe('Fragment compatibility helpers', () => {
  const fragment = (overrides: Partial<Fragment> = {}): Fragment => ({
    id: 1,
    pageId: 2,
    type: 'MARQUEE',
    imageId: null,
    marqueeId: 3,
    year: 1830,
    month: 1,
    day: 1,
    sequence: 1,
    version: 0,
    text: 'text',
    ...overrides
  });

  it('treats a null or absent migration type as legacy MARQUEE', () => {
    expect(effectiveFragmentType(fragment({ type: null }))).toBe('MARQUEE');
    expect(effectiveFragmentType(fragment({ type: undefined }))).toBe('MARQUEE');
    expect(isMarqueeFragment(fragment({ type: null }))).toBeTrue();
  });

  it('does not treat an explicit IMAGE as a MARQUEE', () => {
    expect(effectiveFragmentType(fragment({ type: 'IMAGE' }))).toBe('IMAGE');
    expect(isMarqueeFragment(fragment({ type: 'IMAGE' }))).toBeFalse();
  });

  it('accepts only positive integer page ownership', () => {
    expect(hasAuthoritativePage(fragment({ pageId: 2 }))).toBeTrue();
    expect(hasAuthoritativePage(fragment({ pageId: null }))).toBeFalse();
    expect(hasAuthoritativePage(fragment({ pageId: 0 }))).toBeFalse();
    expect(hasAuthoritativePage(fragment({ pageId: 2.5 }))).toBeFalse();
  });


  it('serializes addImageFragment identity as server-authoritative', () => {
    const withImage = new AddImageFragmentRequest(2, 1830, 1, 1, 2, 'image text', 91);
    expect(JSON.parse(JSON.stringify(withImage))).toEqual({
      pageId: 2,
      year: 1830,
      month: 1,
      day: 1,
      sequence: 2,
      text: 'image text',
      imageId: 91
    });
    expect(Object.hasOwn(withImage, 'id')).toBeFalse();
    expect(Object.hasOwn(withImage, 'type')).toBeFalse();
    expect(Object.hasOwn(withImage, 'marqueeId')).toBeFalse();

    const omitted = new AddImageFragmentRequest(2, 1830, 1, 1, 2, 'image text');
    expect(Object.hasOwn(omitted, 'imageId')).toBeFalse();

    const cleared = new AddImageFragmentRequest(2, 1830, 1, 1, 2, 'image text', null);
    expect(Object.hasOwn(cleared, 'imageId')).toBeTrue();
    expect(cleared.imageId).toBeNull();
  });

  it('keeps ordinary updateFragment requests free of Image identity fields', () => {
    const request = UpdateFragmentRequest.fromFragment(fragment({
      type: 'IMAGE',
      imageId: 91,
      marqueeId: null,
      lock: {
        lockUserId: 42,
        lockUserName: 'editor',
        lockKnownAs: 'Editor',
        lockTimeStamp: 1_798_912_800_000,
        lockSessionId: 'session-1'
      }
    }));

    expect(request).toEqual(new UpdateFragmentRequest(
      1,
      1830,
      1,
      1,
      1,
      0,
      'text'
    ));
    expect(Object.keys(request)).toEqual([
      'id',
      'year',
      'month',
      'day',
      'sequence',
      'version',
      'text'
    ]);
    expect(Object.hasOwn(request, 'pageId')).toBeFalse();
    expect(Object.hasOwn(request, 'type')).toBeFalse();
    expect(Object.hasOwn(request, 'marqueeId')).toBeFalse();
    expect(Object.hasOwn(request, 'imageId')).toBeFalse();
    expect(Object.hasOwn(request, 'lock')).toBeFalse();
  });

  it('serializes deliberate IMAGE reference replacement with a positive imageId', () => {
    const imageFragment = fragment({
      type: 'IMAGE',
      imageId: 91,
      marqueeId: null
    }) as ImageFragment;

    const request = UpdateImageFragmentRequest.fromImageFragment(imageFragment, 102);

    expect(JSON.parse(JSON.stringify(request))).toEqual({
      id: 1,
      year: 1830,
      month: 1,
      day: 1,
      sequence: 1,
      version: 0,
      text: 'text',
      imageId: 102
    });
    expect(Object.hasOwn(request, 'pageId')).toBeFalse();
    expect(Object.hasOwn(request, 'type')).toBeFalse();
    expect(Object.hasOwn(request, 'marqueeId')).toBeFalse();
  });

  it('serializes deliberate IMAGE reference clear with explicit null', () => {
    const imageFragment = fragment({
      type: 'IMAGE',
      imageId: 91,
      marqueeId: null
    }) as ImageFragment;

    const request = UpdateImageFragmentRequest.fromImageFragment(imageFragment, null);

    expect(Object.hasOwn(request, 'marqueeId')).toBeFalse();
    expect(Object.hasOwn(request, 'imageId')).toBeTrue();
    expect(request.imageId).toBeNull();
    expect(JSON.parse(JSON.stringify(request)).imageId).toBeNull();
  });

  it('rejects cross-type or invalid Image-reference mutation requests before RPC', () => {
    expect(() => UpdateImageFragmentRequest.fromImageFragment(
      fragment({ type: 'MARQUEE', imageId: null, marqueeId: 3 }) as unknown as ImageFragment,
      102
    )).toThrowError(/Only an IMAGE Fragment/);

    const imageFragment = fragment({
      type: 'IMAGE',
      imageId: 91,
      marqueeId: null
    }) as ImageFragment;

    expect(() => UpdateImageFragmentRequest.fromImageFragment(imageFragment, 0)).toThrowError(/positive integer/);
    expect(() => UpdateImageFragmentRequest.fromImageFragment(imageFragment, 1.5)).toThrowError(/positive integer/);
  });

});
