import { Fragment, FragmentPlacement, fragmentPlacement } from './fragment';

export type AnnualPlacement = 'PREAMBLE' | 'EPILOGUE';

/** Validates new-state ownership; deliberately does not silently assign a Page. */
export function ownershipErrors(fragment: Fragment): string[] {
  const placement = fragmentPlacement(fragment);
  const validPage = Number.isSafeInteger(fragment.pageId) && (fragment.pageId as number) > 0;
  const hasPage = fragment.pageId !== null && fragment.pageId !== undefined;
  const yearValid = Number.isSafeInteger(fragment.year) && fragment.year > 0;
  const problems: string[] = [];
  if (!yearValid) problems.push('Fragment year must be a positive integer');
  if (placement === 'DATED') {
    if (!validPage) problems.push('DATED Fragment requires a valid Page');
  } else {
    if (hasPage) problems.push('Annual Fragment must not belong to a Page');
    if (fragment.diaryId != null) problems.push('Annual Fragment must not belong to a Diary');
    if (fragment.month != null || fragment.day != null) problems.push('Annual Fragment must not have a month or day');
    if (fragment.marqueeId !== null && fragment.marqueeId !== undefined)
      problems.push('Annual Fragment must not have a Marquee');
  }
  if (fragment.type === 'IMAGE' && !(Number.isSafeInteger(fragment.imageId) && (fragment.imageId as number) > 0))
    problems.push('IMAGE Fragment must reference a Catalogue Image');
  if (fragment.type === 'TEXT' && fragment.imageId !== null && fragment.imageId !== undefined)
    problems.push('TEXT Fragment must not reference a Catalogue Image');
  return problems;
}

/** MQTT filter for one calendar year and placement. */
export function annualTopicFilter(year: number, placement: AnnualPlacement): string {
  if (!Number.isSafeInteger(year) || year <= 0)
    throw new Error('Year must be a positive integer');
  return `diaries/years/${year}/${placement.toLowerCase()}/+`;
}

/** Stable display ordering within a year-level editorial group. */
export function orderedAnnualFragments(
  fragments: readonly Fragment[], year: number, placement: AnnualPlacement
): Fragment[] {
  return fragments.filter(fragment => fragment.diaryId == null && fragment.year === year &&
    fragmentPlacement(fragment) === placement && fragment.pageId == null)
    .sort((a, b) => a.sequence - b.sequence || a.id - b.id);
}
