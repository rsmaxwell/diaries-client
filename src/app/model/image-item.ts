export interface ImageItem {
  name: string;
  url: string;   // e.g. "/uploads/filename.jpg"
  size: number;  // bytes
  mtime: number; // last-modified epoch millis
}