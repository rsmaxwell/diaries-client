import { Fragment, contentFragmentType, isMarqueeFragment } from './fragment';
import { annualTopicFilter, orderedAnnualFragments, ownershipErrors } from './annual-fragments';

describe('0029 annual Fragment contract', () => {
  const sample = (patch: Partial<Fragment> = {}): Fragment => ({
    id: 1, diaryId: 4, pageId: null, placement: 'PREAMBLE', type: 'TEXT',
    imageId: null, marqueeId: null, year: 1832, month: 1, day: 1,
    sequence: 2, version: 0, text: '<p>Introduction</p>', ...patch
  });
  it('validates annual ownership without inventing a Page', () => {
    expect(ownershipErrors(sample())).toEqual([]);
    expect(ownershipErrors(sample({ pageId: 972 }))).toContain('Annual Fragment must not belong to a Page');
    expect(ownershipErrors(sample({ diaryId: null }))).toContain('Annual Fragment requires a valid Diary');
    expect(ownershipErrors(sample({ marqueeId: 15 }))).toContain('Annual Fragment must not have a Marquee');
  });
  it('validates ordinary Page ownership and IMAGE references', () => {
    expect(ownershipErrors(sample({ placement: 'DATED', pageId: 972, diaryId: null }))).toEqual([]);
    expect(ownershipErrors(sample({ placement: 'DATED' }))).toContain('DATED Fragment requires a valid Page');
    expect(ownershipErrors(sample({ type: 'IMAGE', imageId: null }))).toContain('IMAGE Fragment must reference a Catalogue Image');
    expect(ownershipErrors(sample({ type: 'IMAGE', imageId: 85 }))).toEqual([]);
  });
  it('keeps TEXT and old MARQUEE content semantically equivalent', () => {
    expect(contentFragmentType(sample())).toBe('TEXT');
    expect(contentFragmentType(sample({ type: 'MARQUEE' }))).toBe('TEXT');
    expect(isMarqueeFragment(sample({ type: 'TEXT' }))).toBeTrue();
  });
  it('creates diary-scoped annual MQTT filters', () => {
    expect(annualTopicFilter(4, 1832, 'PREAMBLE')).toBe('diaries/years/4/1832/preamble/+');
    expect(annualTopicFilter(4, 1832, 'POSTAMBLE')).toBe('diaries/years/4/1832/postamble/+');
  });
  it('orders only the requested year and placement, with ID tie breaks', () => {
    const result = orderedAnnualFragments([
      sample({ id: 3, sequence: 2 }), sample({ id: 4, sequence: 1 }),
      sample({ id: 2, sequence: 2 }), sample({ id: 5, year: 1833 }),
      sample({ id: 6, placement: 'POSTAMBLE' }), sample({ id: 7, diaryId: 5 })
    ], 4, 1832, 'PREAMBLE');
    expect(result.map(f => f.id)).toEqual([4, 2, 3]);
  });
});
