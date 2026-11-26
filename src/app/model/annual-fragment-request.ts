import { AnnualPlacement } from './annual-fragments';
import { ContentFragmentType, requireSafeImageLinkUrl } from './fragment';

/** Explicit year-level creation request. Page, Marquee and day are not accepted by the responder. */
export class AddAnnualFragmentRequest {
  readonly diaryId: number;
  readonly year: number;
  readonly placement: AnnualPlacement;
  readonly type: ContentFragmentType;
  readonly sequence: number;
  readonly text: string;
  readonly imageId?: number;
  readonly imageLinkUrl?: string;

  constructor(input: {
    diaryId: number; year: number; placement: AnnualPlacement;
    type: ContentFragmentType; sequence: number; text: string;
    imageId?: number; imageLinkUrl?: string;
  }) {
    if (!Number.isSafeInteger(input.diaryId) || input.diaryId <= 0) throw new Error('A Diary is required');
    if (!Number.isSafeInteger(input.year) || input.year < 1 || input.year > 9999) throw new Error('Invalid year');
    if (input.placement !== 'PREAMBLE' && input.placement !== 'POSTAMBLE')
      throw new Error('Annual placement must be PREAMBLE or POSTAMBLE');
    if (input.type !== 'TEXT' && input.type !== 'IMAGE') throw new Error('Invalid annual Fragment type');
    if (!Number.isFinite(input.sequence)) throw new Error('Invalid sequence');
    if (input.type === 'TEXT' && (input.imageId != null || input.imageLinkUrl != null))
      throw new Error('TEXT content cannot have an Image reference');
    if (input.type === 'IMAGE' && (!Number.isSafeInteger(input.imageId) || (input.imageId as number) <= 0))
      throw new Error('IMAGE content requires a Catalogue Image ID');
    if (input.text.length > 4096) throw new Error('Text exceeds 4096 characters');
    this.diaryId = input.diaryId;
    this.year = input.year;
    this.placement = input.placement;
    this.type = input.type;
    this.sequence = input.sequence;
    this.text = input.text;
    if (input.imageId != null) this.imageId = input.imageId;
    if (input.imageLinkUrl) this.imageLinkUrl = requireSafeImageLinkUrl(input.imageLinkUrl);
  }
}

export class NormaliseAnnualFragmentsRequest {
  constructor(public diaryId: number, public year: number, public placement: AnnualPlacement) {
    if (!Number.isSafeInteger(diaryId) || diaryId <= 0 ||
        !Number.isSafeInteger(year) || year < 1 || year > 9999 ||
        (placement !== 'PREAMBLE' && placement !== 'POSTAMBLE')) throw new Error('Invalid annual group');
  }
}
