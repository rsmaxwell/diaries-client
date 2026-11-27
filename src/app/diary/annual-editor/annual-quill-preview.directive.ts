import { Directive, ElementRef, Input } from '@angular/core';

// Construct the preview with DOM APIs rather than bypassing Angular HTML sanitisation.
// Only Quill text-formatting elements and explicitly checked attributes survive.
const ELEMENTS = new Set(['p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'strike', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'sub', 'sup',
  'blockquote', 'pre', 'code', 'a']);
const QUILL_CLASS = /^(?:ql-align-(?:center|right|justify)|ql-indent-[1-5]|ql-size-(?:small|large|huge)|ql-font-(?:serif|monospace))$/;
const SAFE_COLOR = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba)\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/i;

export function renderAnnualQuillPreview(host: HTMLElement, html: string): void {
  const parsed = new DOMParser().parseFromString(html || '', 'text/html');
  const document = host.ownerDocument;
  function copy(node: Node, parent: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.appendChild(document.createTextNode(node.textContent || ''));
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.tagName.toLowerCase();
    // Unsafe elements are omitted with their contents (not unwrapped).
    if (['script', 'style', 'iframe', 'object', 'svg', 'math', 'img', 'form'].includes(tag)) return;
    const target = ELEMENTS.has(tag) ? document.createElement(tag) : parent;
    if (target !== parent) {
      const classes = Array.from(node.classList).filter(cls => QUILL_CLASS.test(cls));
      if (classes.length) (target as HTMLElement).className = classes.join(' ');
      if (tag === 'a') {
        const href = node.getAttribute('href')?.trim() || '';
        if (/^https?:\/\//i.test(href) || (/^(?:\/|#)/.test(href) && !href.startsWith('//'))) {
          (target as HTMLElement).setAttribute('href', href);
          (target as HTMLElement).setAttribute('rel', 'noopener noreferrer');
        }
      }
      const styled = target as HTMLElement;
      for (const property of ['color', 'background-color'] as const) {
        const value = (node as HTMLElement).style?.getPropertyValue(property)?.trim();
        if (value && SAFE_COLOR.test(value)) styled.style.setProperty(property, value);
      }
      parent.appendChild(target);
    }
    for (const child of Array.from(node.childNodes)) copy(child, target);
  }
  const result = document.createDocumentFragment();
  for (const child of Array.from(parsed.body.childNodes)) copy(child, result);
  host.replaceChildren(result);
}

@Directive({ selector: '[annualQuillPreview]', standalone: true })
export class AnnualQuillPreviewDirective {
  constructor(private element: ElementRef<HTMLElement>) {}
  @Input() set annualQuillPreview(html: string) {
    renderAnnualQuillPreview(this.element.nativeElement, html);
  }
}
