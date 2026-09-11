import {
  effectiveFragmentType,
  Fragment,
  hasAuthoritativePage,
  isMarqueeFragment
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
});
