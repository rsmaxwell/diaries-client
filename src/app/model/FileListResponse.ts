import { FileEntry } from "./FileEntry";

// model/FileList.ts
export interface FileListResponse {
  subdir: string;
  items: FileEntry[];
}