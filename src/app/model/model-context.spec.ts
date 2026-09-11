import { Fragment } from './fragment';
import { Marquee } from './marquee';
import { matchingMarqueeForFragment } from './model-context';

describe('ModelContext fragment marquee relationship', () => {
  const fragment = (overrides: Partial<Fragment> = {}): Fragment => ({
    id: 10,
    pageId: 20,
    type: 'MARQUEE',
    marqueeId: 30,
    year: 1830,
    month: 1,
    day: 1,
    sequence: 1,
    version: 0,
    text: 'text',
    ...overrides
  });

  const marquee = (overrides: Partial<Marquee> = {}): Marquee => ({
    id: 30,
    version: 0,
    fragmentId: 10,
    pageId: 20,
    rectangle: { x: 1, y: 2, width: 3, height: 4 },
    ...overrides
  } as Marquee);

  it('matches by fragment and authoritative page ownership', () => {
    expect(matchingMarqueeForFragment(fragment(), [marquee()])?.id).toBe(30);
    expect(matchingMarqueeForFragment(fragment(), [marquee({ pageId: 21 })])).toBeNull();
    expect(matchingMarqueeForFragment(fragment(), [marquee({ fragmentId: 11 })])).toBeNull();
  });

  it('rejects explicit images and unresolved pages', () => {
    expect(matchingMarqueeForFragment(fragment({ type: 'IMAGE' }), [marquee()])).toBeNull();
    expect(matchingMarqueeForFragment(fragment({ pageId: null }), [marquee()])).toBeNull();
  });

  it('does not use the compatibility marqueeId as relationship authority', () => {
    expect(matchingMarqueeForFragment(fragment({ marqueeId: null }), [marquee()])?.id).toBe(30);
    expect(matchingMarqueeForFragment(fragment({ marqueeId: 31 }), [marquee()])?.id).toBe(30);
  });

  it('remains unresolved until an independently arriving valid marquee is present', () => {
    const wrongPage = marquee({ id: 31, pageId: 21 });

    expect(matchingMarqueeForFragment(fragment(), [])).toBeNull();
    expect(matchingMarqueeForFragment(fragment(), [wrongPage])).toBeNull();
    expect(matchingMarqueeForFragment(fragment(), [wrongPage, marquee()])?.id).toBe(30);
  });
});
