import { imageFragmentAuthoringErrorMessage } from './image-fragment-authoring-errors';

describe('imageFragmentAuthoringErrorMessage', () => {
  it('keeps create validation, authentication, gate, conflict and unconfirmed failure distinct', () => {
    expect(imageFragmentAuthoringErrorMessage({ status: 400 }, 'create')).toContain('invalid or stale');
    expect(imageFragmentAuthoringErrorMessage({ status: 401 }, 'create')).toContain('sign-in is no longer valid');
    expect(imageFragmentAuthoringErrorMessage({ status: 403 }, 'create')).toBe('ImageFragment authoring is disabled in this environment.');
    expect(imageFragmentAuthoringErrorMessage({ status: 409 }, 'create')).toContain('conflicts with another edit');
    expect(imageFragmentAuthoringErrorMessage({ status: 500 }, 'create')).toContain('Could not confirm whether the Image Fragment was created');
  });

  it('keeps Image-reference validation, authentication, gate, conflict and unconfirmed failure distinct', () => {
    expect(imageFragmentAuthoringErrorMessage({ status: 400 }, 'image-reference')).toContain('stale or invalid');
    expect(imageFragmentAuthoringErrorMessage({ status: 401 }, 'image-reference')).toContain('sign-in is no longer valid');
    expect(imageFragmentAuthoringErrorMessage({ status: 403 }, 'image-reference')).toBe('ImageFragment authoring is disabled in this environment.');
    expect(imageFragmentAuthoringErrorMessage({ status: 409 }, 'image-reference')).toContain('locked or conflicts');
    expect(imageFragmentAuthoringErrorMessage({ status: 500 }, 'image-reference')).toContain('Could not confirm whether the Image reference was changed');
  });

  it('treats transport timeout as an unconfirmed outcome rather than a safe retry signal', () => {
    expect(imageFragmentAuthoringErrorMessage({ status: undefined }, 'create')).toContain('Refresh before retrying');
    expect(imageFragmentAuthoringErrorMessage({ status: undefined }, 'image-reference')).toContain('Refresh the Fragment before retrying');
  });
});
