import { CatalogueImage } from "./image";

/** One filesystem entry returned by listFiles. Catalogue fields are additive. */
export interface FileEntry {
  name: string;
  size: number;  // bytes
  mtime: number; // last-modified epoch millis
  url?: string | null;
  dateTaken?: number | null; // dateTaken epoch millis
  dir: boolean;

  /** Positive only when this file is registered in the reusable Image catalogue. */
  imageId?: number | null;
  /** Metadata projection returned for catalogued Images when available. */
  image?: CatalogueImage | null;
}

export function hasCatalogueImage(entry: FileEntry): entry is FileEntry & { imageId: number } {
  return !entry.dir && Number.isInteger(entry.imageId) && (entry.imageId as number) > 0;
}
