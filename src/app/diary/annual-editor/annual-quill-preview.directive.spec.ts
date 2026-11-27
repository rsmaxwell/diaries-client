import { renderAnnualQuillPreview } from './annual-quill-preview.directive';

describe('Annual Quill preview', () => {
  it('preserves approved Quill colours and safe links', () => {
    const host = document.createElement('div');
    renderAnnualQuillPreview(host, '<p><span style="background-color: rgb(255, 0, 0); color: blue">xxxx</span> <a href="https://example.com">link</a></p>');
    const span = host.querySelector('span')!;
    expect(span.style.backgroundColor).toBe('rgb(255, 0, 0)');
    expect(span.style.color).toBe(''); // only explicit hex/RGB colour values
    expect(host.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
  });
  it('rejects active markup, inline images and unsafe links', () => {
    const host = document.createElement('div');
    renderAnnualQuillPreview(host, '<script>evil()</script><img src="x"><p onclick="evil()"><a href="javascript:evil()">text</a></p>');
    expect(host.querySelector('script, img, [onclick], a[href]')).toBeNull();
    expect(host.textContent).toContain('text');
    expect(host.textContent).not.toContain('evil()');
  });
});
