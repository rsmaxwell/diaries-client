import { AddImageFragmentRequest, Fragment, isImageFragment, safeImageLinkUrl, UpdateFragmentRequest, UpdateImageFragmentRequest, UpdateImageLinkRequest } from './fragment';

describe('0051 IMAGE link and optional marquee contract', () => {
  const fragment: Fragment = {
    id: 9, pageId: 22, type: 'IMAGE', imageId: 101, imageLinkUrl: 'https://example.test/a?x=1&y=2#part',
    marqueeId: 33, year: 2026, month: 11, day: 20, sequence: 1, version: 4, text: 'caption'
  };

  it('identifies IMAGE fragments with a Marquee and retains the image reference contract', () => {
    expect(isImageFragment(fragment)).toBeTrue();
    const request = UpdateImageFragmentRequest.fromImageFragment(fragment as any, 102);
    expect((request as any).marqueeId).toBeUndefined();
    expect(JSON.parse(JSON.stringify(request)).imageId).toBe(102);
  });

  it('never serializes the URL into an ordinary update', () => {
    expect(JSON.stringify(UpdateFragmentRequest.fromFragment(fragment))).not.toContain('imageLinkUrl');
  });

  it('SET and CLEAR are distinct, non-null and mutually exclusive', () => {
    const set = JSON.parse(JSON.stringify(new UpdateImageLinkRequest(fragment as any, { set: 'https://example.test/a?x=1&y=2#p' })));
    const clear = JSON.parse(JSON.stringify(new UpdateImageLinkRequest(fragment as any, { clear: true })));
    expect(set.imageLinkUrl).toBe('https://example.test/a?x=1&y=2#p');
    expect(Object.hasOwn(set, 'clearImageLinkUrl')).toBeFalse();
    expect(clear.clearImageLinkUrl).toBeTrue();
    expect(Object.hasOwn(clear, 'imageLinkUrl')).toBeFalse();
  });

  it('rejects unsafe or malformed untrusted destinations, preserving complete safe strings', () => {
    for (const unsafe of ['javascript:alert(1)', '//example.test/path', 'https://u:p@example.test/', 'https://example.test/a b', 'ftp://example.test']) {
      expect(safeImageLinkUrl(unsafe)).toBeNull();
      expect(() => new UpdateImageLinkRequest(fragment as any, { set: unsafe })).toThrow();
    }
    expect(safeImageLinkUrl(fragment.imageLinkUrl)).toBe('https://example.test/a?x=1&y=2#part');
  });

  it('allows an optional link in creation without adding nullable fields by default', () => {
    const created = new AddImageFragmentRequest(22, 2026, 11, 20, 1, '', 101, 'https://example.test/');
    expect(created.imageLinkUrl).toBe('https://example.test/');
    expect(Object.hasOwn(new AddImageFragmentRequest(22, 2026, 11, 20, 1, ''), 'imageLinkUrl')).toBeFalse();
  });
});
