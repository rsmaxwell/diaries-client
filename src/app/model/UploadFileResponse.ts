import { CatalogueImage } from './image';

/** Additive response returned by uploadFile. Generic uploads have null catalogue fields. */
export interface UploadFileResponse {
  name: string;
  subdir: string;
  size: number;
  path: string;
  url: string;
  imageId: number | null;
  image: CatalogueImage | null;
}
