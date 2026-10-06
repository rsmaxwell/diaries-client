import { FileEntry, hasCatalogueImage } from './FileEntry';

describe('FileEntry catalogue metadata', () => {
  const base: FileEntry = { name: 'plain.png', size: 9, mtime: 1, url: '/files/plain.png', dir: false };

  it('keeps ordinary files and directories compatible when catalogue fields are absent', () => {
    expect(hasCatalogueImage(base)).toBeFalse();
    expect(hasCatalogueImage({ name: 'folder', size: 0, mtime: 1, dir: true, imageId: 101 })).toBeFalse();
  });

  it('recognises only a positive persisted catalogue imageId', () => {
    expect(hasCatalogueImage({ ...base, imageId: null })).toBeFalse();
    expect(hasCatalogueImage({ ...base, imageId: 0 })).toBeFalse();
    expect(hasCatalogueImage({ ...base, imageId: -1 })).toBeFalse();
    expect(hasCatalogueImage({ ...base, imageId: 101 })).toBeTrue();
  });
});
