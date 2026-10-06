/**
 * Metadata-only retained projection of one reusable catalogue Image.
 *
 * The responder publishes this object on `diaries/images/<id>`. Image bytes
 * are served separately from the configured static Files root and must never
 * be transported as part of this MQTT model.
 */
export interface CatalogueImage {
  id: number;
  version: number;
  relativePath: string;
  mimeType: string;
  originalFilename: string;
  width: number;
  height: number;
  checksum: string;
  caption: string;
  altText: string;
}
