import { Component, Inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

@Component({
  standalone: true,
  template: `
    <h2 id="delete-image-title">Delete image?</h2>
    <p>Delete “{{ path }}”? This removes the image file and its catalogue entry.</p>
    <div class="actions">
      <button type="button" (click)="ref.close(false)">Cancel</button>
      <button type="button" (click)="ref.close(true)">Delete image</button>
    </div>
  `,
  styles: [`
    :host { display: block; padding: 24px; background: var(--diaries-surface); color: var(--diaries-ink); border-radius: 6px; }
    h2 { margin-top: 0; } p { overflow-wrap: anywhere; }
    .actions { display: flex; justify-content: flex-end; gap: 12px; }
    button { padding: 8px 16px; cursor: pointer; font: inherit; color: inherit;
      background: var(--diaries-paper); border: 1px solid var(--diaries-line); border-radius: 4px; }
    button:focus-visible { outline: 2px solid var(--diaries-focus); outline-offset: 2px; }
  `]
})
export class DeleteImageConfirmationComponent {
  constructor(@Inject(DIALOG_DATA) public path: string, public ref: DialogRef<boolean>) {}
}
