/** Acknowledgement only; retained Image topics remain authoritative for live state. */
export interface DeleteImageReply {
  id: number;
  relativePath: string;
  deleted: true;
}
