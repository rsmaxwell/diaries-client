import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { catchError, combineLatest, distinctUntilChanged, from, map, Observable, of, shareReplay, startWith } from 'rxjs';

import { ConfigService } from '../config/config.service';
import { CatalogueImage } from '../model/image';
import { Fragment, isImageFragment } from '../model/fragment';
import { ModelContext } from '../model/model-context';
import { buildCatalogueImageUrl } from '../utilities/catalogue-image-url';
import { ImageFragmentActionStateService } from './image-fragment-action-state.service';

export interface ImageFragmentReferenceViewModel {
  fragmentId: number;
  imageId: number | null;
  image: CatalogueImage | null;
  imageUrl: string | null;
  unresolved: boolean;
  hasImageReference: boolean;
  canSelectOrReplace: boolean;
  canClear: boolean;
  mutationInFlight: boolean;
}

@Component({
  selector: 'app-image-fragment-reference',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-fragment-reference.component.html',
  styleUrls: ['./image-fragment-reference.component.scss']
})
export class ImageFragmentReferenceComponent {
  @Output() readonly selectImage = new EventEmitter<void>();
  @Output() readonly clearImage = new EventEmitter<void>();

  readonly viewModel$: Observable<ImageFragmentReferenceViewModel | null>;

  constructor(
    modelContext: ModelContext,
    configService: ConfigService,
    actionState: ImageFragmentActionStateService
  ) {
    const runtimeConfig$ = from(configService.getConfig()).pipe(
      startWith(null),
      catchError(err => {
        console.warn('ImageFragmentReferenceComponent: could not resolve runtime Files configuration', err);
        return of(null);
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.viewModel$ = combineLatest([
      modelContext.selectedFragment$.pipe(startWith(null)),
      modelContext.selectedImage$.pipe(startWith(null)),
      runtimeConfig$,
      actionState.canSelectOrReplaceImage$.pipe(startWith(false)),
      actionState.canClearImage$.pipe(startWith(false)),
      actionState.imageMutationInFlight$.pipe(startWith(false))
    ]).pipe(
      map(([fragment, image, config, canSelectOrReplace, canClear, mutationInFlight]) =>
        this.toViewModel(fragment, image, config, canSelectOrReplace, canClear, mutationInFlight)
      ),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  private toViewModel(
    fragment: Fragment | null,
    image: CatalogueImage | null,
    config: Awaited<ReturnType<ConfigService['getConfig']>> | null,
    canSelectOrReplace: boolean,
    canClear: boolean,
    mutationInFlight: boolean
  ): ImageFragmentReferenceViewModel | null {
    if (!isImageFragment(fragment)) {
      return null;
    }

    const imageId = Number.isInteger(fragment.imageId) && (fragment.imageId as number) > 0
      ? fragment.imageId as number
      : null;
    const resolvedImage = imageId !== null && image?.id === imageId ? image : null;
    const imageUrl = resolvedImage && config
      ? buildCatalogueImageUrl(config.baseUrl, config.files, resolvedImage.relativePath)
      : null;

    return {
      fragmentId: fragment.id,
      imageId,
      image: resolvedImage,
      imageUrl,
      unresolved: imageId !== null && resolvedImage === null,
      hasImageReference: imageId !== null,
      canSelectOrReplace,
      canClear,
      mutationInFlight
    };
  }
}
