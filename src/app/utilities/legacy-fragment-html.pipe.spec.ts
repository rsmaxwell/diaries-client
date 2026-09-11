import {
  buildLegacyImageBaseUrl,
  LegacyFragmentHtmlPipe,
  restoreLegacyFragmentHtml
} from './legacy-fragment-html.pipe';

describe('LegacyFragmentHtmlPipe', () => {
  const pipe = new LegacyFragmentHtmlPipe();
  const base = 'http://localhost:8081/files/diary%20one/images';

  it('rewrites approved legacy image and link URLs', () => {
    const result = pipe.transform(
      '<figure><a href="images/map large.png"><img src="images/map large.png"></a></figure>',
      base
    );

    expect(result).toContain(`href="${base}/map%20large.png"`);
    expect(result).toContain(`src="${base}/map%20large.png"`);
  });

  it('leaves normal absolute and data URLs untouched', () => {
    const source = '<img src="https://example.test/map.png"><img src="data:image/png;base64,AA==">';
    expect(pipe.transform(source, base)).toBe(source);
  });

  it('removes traversal, nested and non-image legacy paths', () => {
    const result = pipe.transform(
      '<img src="images/.."><img src="images/maps/map.png"><a href="images/readme.txt">file</a>',
      base
    );

    const document = new DOMParser().parseFromString(result, 'text/html');
    expect(Array.from(document.querySelectorAll('img')).every(image => !image.hasAttribute('src'))).toBeTrue();
    expect(document.querySelector('a')?.hasAttribute('href')).toBeFalse();
  });

  it('builds the legacy image root from runtime configuration and diary name', () => {
    expect(buildLegacyImageBaseUrl(
      'https://example.test/diaries-responder/',
      '/files/',
      'diary 1831'
    )).toBe('https://example.test/diaries-responder/files/diary%201831/images');
  });

  it('restores resolved editor URLs to the original legacy references', () => {
    const original = '<figure><a href="images/map large.png"><img src="images/map large.png"></a></figure>';
    const resolved = pipe.transform(original, base);
    const edited = resolved.replace('</figure>', '<figcaption>Map</figcaption></figure>');
    const restored = restoreLegacyFragmentHtml(edited, original, base);

    expect(restored).toContain('href="images/map large.png"');
    expect(restored).toContain('src="images/map large.png"');
    expect(restored).toContain('<figcaption>Map</figcaption>');
  });

  it('does not convert a newly inserted absolute image URL', () => {
    const absolute = `${base}/new.png`;
    const restored = restoreLegacyFragmentHtml(
      `<img src="${absolute}">`,
      '<p>Original text only</p>',
      base
    );

    expect(restored).toContain(`src="${absolute}"`);
  });
});
