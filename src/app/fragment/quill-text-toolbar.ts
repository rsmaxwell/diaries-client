import type Quill from 'quill';

/** Shared toolbar for DATED, PREAMBLE and EPILOGUE TEXT fragments.
 * Colours are placed near the left of the toolbar so Quill's dropdown palette
 * stays inside the editor at typical split-pane widths. Quill's default palette
 * is retained for both foreground and background colours.
 * Inline images are managed via IMAGE fragments and the Image Catalogue.
 */
export const TEXT_EDITOR_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ color: [] }, { background: [] }],
    [{ header: [1, 2, 3, false] }],
    [{ list: 'bullet' }, { list: 'ordered' }],
    ['link'],
    [{ font: [] }],
    [{ size: ['small', false, 'large', 'huge'] }]
  ]
};

/**
 * Prevent paste/drop from inserting inline images; this does not rewrite
 * existing stored HTML (which may contain legacy inline images).
 */
export function blockInlineImageInsertion(root: HTMLElement, editor?: Quill): () => void {
  const blockPaste = (event: ClipboardEvent): void => {
    const data = event.clipboardData;
    if (!data) return;
    const imageFile = Array.from(data.items).some(item => item.kind === 'file' && item.type.startsWith('image/'))
      || Array.from(data.files ?? []).some(file => file.type.startsWith('image/'));
    const html = data.getData('text/html');
    if (imageFile || /<img(?:\s|\/?>)/i.test(html)) event.preventDefault();
  };
  const blockDrop = (event: DragEvent): void => {
    const data = event.dataTransfer;
    if (!data) return;
    const imageFile = Array.from(data.files).some(file => file.type.startsWith('image/'));
    const html = data.getData('text/html');
    if (imageFile || /<img(?:\s|\/?>)/i.test(html)) event.preventDefault();
  };
  // Quill or browser clipboard handlers can insert an image despite the DOM
  // event being cancelled. Remove only newly inserted user-origin image embeds.
  // Existing legacy images loaded with source='api' are left untouched.
  let removingImage = false;
  const rejectInsertedImages = (delta: { ops?: Array<{ retain?: number; insert?: unknown; delete?: number }> }, _oldDelta: unknown, source: string): void => {
    if (source !== 'user' || removingImage || !editor) return;
    let position = 0;
    const insertedImagePositions: number[] = [];
    for (const op of delta.ops ?? []) {
      if (typeof op.retain === 'number') position += op.retain;
      if (op.insert !== undefined) {
        if (typeof op.insert === 'object' && op.insert !== null && 'image' in op.insert) {
          insertedImagePositions.push(position);
        }
        position += typeof op.insert === 'string' ? op.insert.length : 1;
      }
    }
    if (!insertedImagePositions.length) return;
    removingImage = true;
    try {
      for (const index of insertedImagePositions.reverse()) editor.deleteText(index, 1, 'api');
    } finally {
      removingImage = false;
    }
  };
  editor?.on('text-change', rejectInsertedImages);
  root.addEventListener('paste', blockPaste, true);
  root.addEventListener('drop', blockDrop, true);
  return () => {
    editor?.off('text-change', rejectInsertedImages);
    root.removeEventListener('paste', blockPaste, true);
    root.removeEventListener('drop', blockDrop, true);
  };
}
