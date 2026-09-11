import { Pipe, PipeTransform } from '@angular/core';

const LEGACY_IMAGE_PREFIX = 'images/';
const IMAGE_FILENAME = /\.(?:gif|jpe?g|png|webp)$/i;

/**
 * Resolves the old importer format (`images/<filename>`) against the responder's
 * public files tree. Other URLs are left untouched. Invalid legacy-looking
 * paths have the affected attribute removed rather than being resolved by the
 * browser relative to the current application route.
 */
@Pipe({ name: 'legacyFragmentHtml' })
export class LegacyFragmentHtmlPipe implements PipeTransform {
  transform(html: string | null | undefined, legacyImageBaseUrl: string): string {
    const source = html ?? '';
    if (!source.toLowerCase().includes(LEGACY_IMAGE_PREFIX)) {
      return source;
    }

    const document = new DOMParser().parseFromString(source, 'text/html');
    this.rewriteAttributes(document, 'img[src]', 'src', legacyImageBaseUrl);
    this.rewriteAttributes(document, 'a[href]', 'href', legacyImageBaseUrl);
    return document.body.innerHTML;
  }

  private rewriteAttributes(
    document: Document,
    selector: string,
    attribute: 'src' | 'href',
    legacyImageBaseUrl: string
  ): void {
    document.querySelectorAll<HTMLElement>(selector).forEach(element => {
      const value = element.getAttribute(attribute);
      if (!value?.trim().toLowerCase().startsWith(LEGACY_IMAGE_PREFIX)) {
        return;
      }

      const resolved = this.resolveLegacyImageUrl(value, legacyImageBaseUrl);
      if (resolved) {
        element.setAttribute(attribute, resolved);
      } else {
        element.removeAttribute(attribute);
      }
    });
  }

  private resolveLegacyImageUrl(value: string, legacyImageBaseUrl: string): string | null {
    const trimmed = value.trim();
    const slash = trimmed.indexOf('/');
    if (slash < 0 || trimmed.substring(0, slash).toLowerCase() !== 'images') {
      return null;
    }

    const encodedFilename = trimmed.substring(slash + 1);
    if (!encodedFilename || /[\\/?#]/.test(encodedFilename)) {
      return null;
    }

    let filename: string;
    try {
      filename = decodeURIComponent(encodedFilename);
    } catch {
      return null;
    }

    if (
      !filename ||
      filename === '.' ||
      filename === '..' ||
      /[\\/?#\u0000-\u001f\u007f]/.test(filename) ||
      !IMAGE_FILENAME.test(filename)
    ) {
      return null;
    }

    const base = legacyImageBaseUrl.replace(/\/+$/, '');
    return base ? `${base}/${encodeURIComponent(filename)}` : null;
  }
}
