/**
 * Build the public static-file URL for a catalogued Image relative path.
 *
 * `relativePath` is responder-owned catalogue metadata beneath the configured
 * Files root. It is encoded one path segment at a time so spaces, `#`, unicode
 * and other filename characters cannot alter URL structure.
 */
export function buildCatalogueImageUrl(
  responderBaseUrl: string,
  filesRoot: string,
  relativePath: string
): string | null {
  const base = responderBaseUrl.trim().replace(/\/+$/, '');
  const files = filesRoot.trim().replace(/^\/+|\/+$/g, '');
  const relative = relativePath.trim().replace(/^\/+|\/+$/g, '');

  if (!base || !files || !relative || relative.includes('\\')) {
    return null;
  }

  const segments = relative.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    return null;
  }

  return `${base}/${encodeURIComponent(files)}/${segments.map(segment => encodeURIComponent(segment)).join('/')}`;
}
