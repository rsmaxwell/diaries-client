import { Diary } from '../model/diary';
import { Fragment, hasAuthoritativePage } from '../model/fragment';
import { Page } from '../model/page';

/**
 * True when the current editor context contains enough stable information to
 * create an IMAGE Fragment on the selected Fragment's day and owning page.
 */
export function canAddImageFragment(
  diary: Diary | null | undefined,
  page: Page | null | undefined,
  fragment: Fragment | null | undefined
): boolean {
  return !!diary &&
    Number.isInteger(diary.id) && diary.id > 0 &&
    !!diary.name?.trim() &&
    !!page &&
    Number.isInteger(page.id) && page.id > 0 &&
    page.diaryId === diary.id &&
    hasAuthoritativePage(fragment) &&
    fragment.pageId === page.id &&
    Number.isInteger(fragment.year) && fragment.year > 0 &&
    Number.isInteger(fragment.month) && fragment.month >= 1 && fragment.month <= 12 &&
    Number.isInteger(fragment.day) && fragment.day >= 1 && fragment.day <= 31 &&
    Number.isFinite(fragment.sequence);
}

/**
 * Shared insertion rule for the common MARQUEE/IMAGE Fragment chronology.
 * This is the pre-existing MARQUEE sequence-gap algorithm, promoted so both
 * creation paths use one ordering rule.
 */
export function nextFragmentSequence(
  fragments: Fragment[],
  selectedSequence: number
): number {
  const sorted = fragments
    .slice()
    .sort((a, b) => a.sequence - b.sequence);

  const selectedIndex = sorted.findIndex(f => f.sequence === selectedSequence);
  const selected = selectedIndex >= 0 ? sorted[selectedIndex] : null;
  const next = selectedIndex >= 0 ? sorted[selectedIndex + 1] : null;

  if (selected && next) {
    return (selected.sequence + next.sequence) / 2;
  }

  if (selected) {
    return selected.sequence + 1000;
  }

  if (sorted.length > 0) {
    return sorted[sorted.length - 1].sequence + 1000;
  }

  return 1000;
}
