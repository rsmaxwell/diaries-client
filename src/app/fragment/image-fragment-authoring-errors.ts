export type ImageFragmentAuthoringOperation = 'create' | 'image-reference';

/**
 * Convert responder/transport status into deliberate user-facing authoring
 * messages. 401 and 403 are intentionally distinct: authentication expiry is
 * not the same condition as the responder's ImageFragment write gate.
 */
export function imageFragmentAuthoringErrorMessage(
  err: any,
  operation: ImageFragmentAuthoringOperation
): string {
  const status = err?.status as number | undefined;

  if (operation === 'create') {
    switch (status) {
      case 400:
        return 'The Image Fragment was not created because the page, date, sequence or Image is invalid or stale. Refresh and try again.';
      case 401:
        return 'Your sign-in is no longer valid. Sign in again before adding an Image Fragment.';
      case 403:
        return 'ImageFragment authoring is disabled in this environment.';
      case 409:
        return 'The Image Fragment was not created because the current data conflicts with another edit. Refresh and try again.';
      case 500:
      case undefined:
        return 'Could not confirm whether the Image Fragment was created. Refresh before retrying.';
      default:
        return 'Could not add the Image Fragment. Refresh and try again.';
    }
  }

  switch (status) {
    case 400:
      return 'The Image reference was not changed because the Fragment or Image state is stale or invalid. Refresh and try again.';
    case 401:
      return 'Your sign-in is no longer valid. Sign in again before changing the Image reference.';
    case 403:
      return 'ImageFragment authoring is disabled in this environment.';
    case 409:
      return 'The Image reference was not changed because this Fragment is locked or conflicts with another edit. Refresh and try again.';
    case 500:
    case undefined:
      return 'Could not confirm whether the Image reference was changed. Refresh the Fragment before retrying.';
    default:
      return 'Could not update the Image reference. Refresh and try again.';
  }
}
