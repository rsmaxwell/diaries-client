import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, distinctUntilChanged, map, Observable, shareReplay, startWith } from 'rxjs';

import { ModelContext } from '../model/model-context';
import { isImageFragment } from '../model/fragment';
import { canAddImageFragment } from './image-fragment-authoring';

/**
 * Shared action state for the ImageFragment authoring surface.
 *
 * FragmentComponent provides a workspace-scoped instance so the header,
 * Image-reference panel and workflow handlers all consume the same busy state.
 * The root registration keeps the standalone child components usable in tests
 * and other hosts.
 */
@Injectable({ providedIn: 'root' })
export class ImageFragmentActionStateService {
  private readonly addInFlightSubject = new BehaviorSubject<boolean>(false);
  private readonly imageMutationInFlightSubject = new BehaviorSubject<boolean>(false);

  readonly addInFlight$ = this.addInFlightSubject.asObservable().pipe(distinctUntilChanged());
  readonly imageMutationInFlight$ = this.imageMutationInFlightSubject.asObservable().pipe(distinctUntilChanged());

  readonly selectedFragmentIsImage$: Observable<boolean>;
  readonly selectedImageHasAttachedImage$: Observable<boolean>;
  readonly validAddImageFragmentContext$: Observable<boolean>;
  readonly imageAuthoringBusy$: Observable<boolean>;
  readonly canAddImageFragment$: Observable<boolean>;
  readonly canSelectOrReplaceImage$: Observable<boolean>;
  readonly canClearImage$: Observable<boolean>;

  constructor(modelContext: ModelContext) {
    this.selectedFragmentIsImage$ = modelContext.selectedFragment$.pipe(
      startWith(null),
      map(fragment => isImageFragment(fragment)),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.selectedImageHasAttachedImage$ = modelContext.selectedFragment$.pipe(
      startWith(null),
      map(fragment =>
        isImageFragment(fragment) &&
        Number.isInteger(fragment.imageId) &&
        (fragment.imageId as number) > 0
      ),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.validAddImageFragmentContext$ = combineLatest([
      modelContext.selectedDiary$.pipe(startWith(null)),
      modelContext.selectedPage$.pipe(startWith(null)),
      modelContext.selectedFragment$.pipe(startWith(null))
    ]).pipe(
      map(([diary, page, fragment]) => canAddImageFragment(diary, page, fragment)),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.imageAuthoringBusy$ = combineLatest([
      this.addInFlight$,
      this.imageMutationInFlight$
    ]).pipe(
      map(([adding, mutating]) => adding || mutating),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.canAddImageFragment$ = combineLatest([
      this.validAddImageFragmentContext$,
      this.imageAuthoringBusy$
    ]).pipe(
      map(([validContext, busy]) => validContext && !busy),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.canSelectOrReplaceImage$ = combineLatest([
      this.selectedFragmentIsImage$,
      this.imageAuthoringBusy$
    ]).pipe(
      map(([isImage, busy]) => isImage && !busy),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.canClearImage$ = combineLatest([
      this.selectedImageHasAttachedImage$,
      this.imageAuthoringBusy$
    ]).pipe(
      map(([hasImage, busy]) => hasImage && !busy),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  /** Returns false when another Image authoring workflow is already active. */
  tryBeginAddImageFragment(): boolean {
    if (this.isBusy()) return false;
    this.addInFlightSubject.next(true);
    return true;
  }

  endAddImageFragment(): void {
    this.addInFlightSubject.next(false);
  }

  /** Returns false when another Image authoring workflow is already active. */
  tryBeginImageMutation(): boolean {
    if (this.isBusy()) return false;
    this.imageMutationInFlightSubject.next(true);
    return true;
  }

  endImageMutation(): void {
    this.imageMutationInFlightSubject.next(false);
  }

  private isBusy(): boolean {
    return this.addInFlightSubject.value || this.imageMutationInFlightSubject.value;
  }
}
