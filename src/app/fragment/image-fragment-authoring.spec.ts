import { Diary } from '../model/diary';
import { Fragment } from '../model/fragment';
import { Page } from '../model/page';
import { canAddImageFragment, nextFragmentSequence } from './image-fragment-authoring';

describe('ImageFragment authoring helpers', () => {
  const diary = new Diary(11, 0, 1, 'diary-1830');
  const page = new Page(22, 11, 'page-1', '.jpg', 1000, 1500, 1, 0);
  const selected: Fragment = {
    id: 33,
    pageId: 22,
    type: 'IMAGE',
    imageId: 101,
    marqueeId: null,
    year: 1830,
    month: 2,
    day: 3,
    sequence: 1000,
    version: 2,
    text: ''
  };

  it('accepts either Fragment type when diary/page/day context is authoritative', () => {
    expect(canAddImageFragment(diary, page, selected)).toBeTrue();
    expect(canAddImageFragment(diary, page, { ...selected, type: 'MARQUEE', imageId: null, marqueeId: 44 })).toBeTrue();
  });

  it('rejects missing or mismatched authoring context', () => {
    expect(canAddImageFragment(diary, page, null)).toBeFalse();
    expect(canAddImageFragment(diary, { ...page, id: 23 }, selected)).toBeFalse();
    expect(canAddImageFragment({ ...diary, id: 12 }, page, selected)).toBeFalse();
    expect(canAddImageFragment(diary, page, { ...selected, month: 0 })).toBeFalse();
  });

  it('inserts between the selected Fragment and its successor in the common chronology', () => {
    const fragments: Fragment[] = [
      selected,
      { ...selected, id: 34, sequence: 2000 },
      { ...selected, id: 35, sequence: 3000, type: 'MARQUEE', imageId: null, marqueeId: 55 }
    ];

    expect(nextFragmentSequence(fragments, selected.sequence)).toBe(1500);
  });

  it('uses the existing +1000 fallback after the final selected Fragment', () => {
    expect(nextFragmentSequence([selected], selected.sequence)).toBe(2000);
    expect(nextFragmentSequence([], selected.sequence)).toBe(1000);
  });
});
