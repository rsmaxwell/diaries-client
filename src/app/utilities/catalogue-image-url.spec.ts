import { buildCatalogueImageUrl } from './catalogue-image-url';

describe('buildCatalogueImageUrl', () => {
  it('builds a URL beneath the configured static Files root', () => {
    expect(buildCatalogueImageUrl(
      'https://example.test/diaries-responder/',
      '/files/',
      'diary-1831/images/map.png'
    )).toBe('https://example.test/diaries-responder/files/diary-1831/images/map.png');
  });

  it('encodes relative-path segments without encoding path separators', () => {
    expect(buildCatalogueImageUrl(
      'http://localhost:8081',
      'files',
      'Diary One/images/a b#c.png'
    )).toBe('http://localhost:8081/files/Diary%20One/images/a%20b%23c.png');
  });

  it('rejects empty or non-canonical relative paths', () => {
    expect(buildCatalogueImageUrl('http://localhost:8081', 'files', '')).toBeNull();
    expect(buildCatalogueImageUrl('http://localhost:8081', 'files', 'a//b.png')).toBeNull();
    expect(buildCatalogueImageUrl('http://localhost:8081', 'files', 'a/../b.png')).toBeNull();
    expect(buildCatalogueImageUrl('http://localhost:8081', 'files', 'a\\b.png')).toBeNull();
  });
});
