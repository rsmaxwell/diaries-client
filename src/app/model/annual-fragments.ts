import { Fragment, FragmentPlacement, fragmentPlacement } from './fragment';

export type AnnualPlacement = 'PREAMBLE' | 'POSTAMBLE';

/** Validates new-state ownership; deliberately does not silently assign a Page. */
export function ownershipErrors(fragment: Fragment): string[] {
  const placement = fragmentPlacement(fragment);
  const validPage = Number.isSafeInteger(fragment.pageId) && (fragment.pageId as number) > 0;
  const hasPage = fragment.pageId !== null && fragment.pageId !== undefined;
  const validDiary = Number.isSafeInteger(fragment.diaryId) && (fragment.diaryId as number) > 0;
  const yearValid = Number.isSafeInteger(fragment.year) && fragment.year > 0;
  const problems: string[] = [];
  if (!yearValid) problems.push('Fragment year must be a positive integer');
  if (placement === 'DATED') {
    if (!validPage) problems.push('DATED Fragment requires a valid Page');
  } else {
    if (hasPage) problems.push('Annual Fragment must not belong to a Page');
    if (!validDiary) problems.push('Annual Fragment requires a valid Diary');
    if (fragment.marqueeId !== null && fragment.marqueeId !== undefined)
      problems.push('Annual Fragment must not have a Marquee');
  }
  if (fragment.type === 'IMAGE' && !(Number.isSafeInteger(fragment.imageId) && (fragment.imageId as number) > 0))
    problems.push('IMAGE Fragment must reference a Catalogue Image');
  if (fragment.type === 'TEXT' && fragment.imageId !== null && fragment.imageId !== undefined)
    problems.push('TEXT Fragment must not reference a Catalogue Image');
  return problems;
}

/** MQTT filters for one diary/year; never subscribe to every diary's annual data. */
export function annualTopicFilter(diaryId: number, year: number, placement: AnnualPlacement): string {
  if (!Number.isSafeInteger(diaryId) || diaryId <= 0 || !Number.isSafeInteger(year) || year <= 0)
    throw new Error('Diary ID and year must be positive integers');
  return `diaries/years/${diaryId}/${year}/${placement.toLowerCase()}/+`;
}

/** Stable display ordering within a year-level editorial group. */
export function orderedAnnualFragments(
  fragments: readonly Fragment[], diaryId: number, year: number, placement: AnnualPlacement
): Fragment[] {
  return fragments.filter(fragment => fragment.diaryId === diaryId && fragment.year === year &&
    fragmentPlacement(fragment) === placement && fragment.pageId == null)
    .sort((a, b) => a.sequence - b.sequence || a.id - b.id);
}
