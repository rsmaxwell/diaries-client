export interface FileEntry {
  name: string;
  size: number;  // bytes
  mtime: number; // last-modified epoch millis
  url: string;   // e.g. "/uploads/filename.jpg"
  dateTaken: number; // dateTaken epoch millis
  dir: boolean;
}