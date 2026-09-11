import { Pipe, PipeTransform } from '@angular/core';

const LEGACY_IMAGE_PREFIX = 'images/';
const IMAGE_FILENAME = /\.(?:gif|jpe?g|png|webp)$/i;

export function buildLegacyImageBaseUrl(
  responderBaseUrl: string,
  filesRoot: string,
  diaryName: string
): string {
  const base = responderBaseUrl.replace(/\/+$/, '');
  const files = filesRoot.replace(/^\/+|\/+$/g, '');
  return `${base}/${encodeURIComponent(files)}/${encodeURIComponent(diaryName)}/images`;
}

export function resolveLegacyFragmentHtml(
  html: string | null | undefined,
  legacyImageBaseUrl: string
): string {
  const source = html ?? '';
  if (!source.toLowerCase().includes(LEGACY_IMAGE_PREFIX)) {
    return source;
  }

  const document = new DOMParser().parseFromString(source, 'text/html');
  rewriteAttributes(document, 'img[src]', 'src', legacyImageBaseUrl);
  rewriteAttributes(document, 'a[href]', 'href', legacyImageBaseUrl);
  return document.body.innerHTML;
}

/**
 * Converts only URLs that originated as legacy references in the server HTML
 * back to their original values. This prevents the editor workaround from
 * persisting deployment-specific absolute URLs during an unrelated edit.
 */
export function restoreLegacyFragmentHtml(
  editedHtml: string | null | undefined,
  originalServerHtml: string | null | undefined,
  legacyImageBaseUrl: string
): string {
  const edited = editedHtml ?? '';
  const original = originalServerHtml ?? '';
  const references = collectLegacyReferences(original, legacyImageBaseUrl);
  if (references.size === 0) {
    return edited;
  }

  const document = new DOMParser().parseFromString(edited, 'text/html');
  restoreAttributes(document, 'img[src]', 'src', references);
  restoreAttributes(document, 'a[href]', 'href', references);
  return document.body.innerHTML;
}

/**
 * Resolves the old importer format (`images/<filename>`) against the responder's
 * public files tree. Other URLs are left untouched. Invalid legacy-looking
 * paths have the affected attribute removed rather than being resolved by the
 * browser relative to the current application route.
 */
@Pipe({ name: 'legacyFragmentHtml' })
export class LegacyFragmentHtmlPipe implements PipeTransform {
  transform(html: string | null | undefined, legacyImageBaseUrl: string): string {
    return resolveLegacyFragmentHtml(html, legacyImageBaseUrl);
  }
}

type LegacyAttribute = 'src' | 'href';
type LegacyReferenceMap = Map<string, string[]>;

function rewriteAttributes(
  document: Document,
  selector: string,
  attribute: LegacyAttribute,
  legacyImageBaseUrl: string
): void {
  document.querySelectorAll<HTMLElement>(selector).forEach(element => {
    const value = element.getAttribute(attribute);
    if (!value?.trim().toLowerCase().startsWith(LEGACY_IMAGE_PREFIX)) {
      return;
    }

    const resolved = resolveLegacyImageUrl(value, legacyImageBaseUrl);
    if (resolved) {
      element.setAttribute(attribute, resolved);
    } else {
      element.removeAttribute(attribute);
    }
  });
}

function collectLegacyReferences(
  originalHtml: string,
  legacyImageBaseUrl: string
): LegacyReferenceMap {
  const references: LegacyReferenceMap = new Map();
  const document = new DOMParser().parseFromString(originalHtml, 'text/html');

  collectAttributeReferences(document, 'img[src]', 'src', legacyImageBaseUrl, references);
  collectAttributeReferences(document, 'a[href]', 'href', legacyImageBaseUrl, references);
  return references;
}

function collectAttributeReferences(
  document: Document,
  selector: string,
  attribute: LegacyAttribute,
  legacyImageBaseUrl: string,
  references: LegacyReferenceMap
): void {
  document.querySelectorAll<HTMLElement>(selector).forEach(element => {
    const legacyValue = element.getAttribute(attribute);
    if (!legacyValue?.trim().toLowerCase().startsWith(LEGACY_IMAGE_PREFIX)) {
      return;
    }

    const resolved = resolveLegacyImageUrl(legacyValue, legacyImageBaseUrl);
    if (!resolved) {
      return;
    }

    const key = referenceKey(selector, attribute, resolved);
    const values = references.get(key) ?? [];
    values.push(legacyValue);
    references.set(key, values);
  });
}

function restoreAttributes(
  document: Document,
  selector: string,
  attribute: LegacyAttribute,
  references: LegacyReferenceMap
): void {
  document.querySelectorAll<HTMLElement>(selector).forEach(element => {
    const value = element.getAttribute(attribute);
    if (!value) {
      return;
    }

    const values = references.get(referenceKey(selector, attribute, value));
    const legacyValue = values?.shift();
    if (legacyValue) {
      element.setAttribute(attribute, legacyValue);
    }
  });
}

function referenceKey(selector: string, attribute: LegacyAttribute, value: string): string {
  return `${selector}|${attribute}|${value}`;
}

function resolveLegacyImageUrl(value: string, legacyImageBaseUrl: string): string | null {
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
