import { Component, Inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

export interface ClearImageConfirmationData {
  fragmentId: number;
  imageId: number;
}

@Component({
  standalone: true,
  template: `
    <h2 id="clear-image-title">Clear Image?</h2>
    <p>
      Remove Image {{ data.imageId }} from IMAGE Fragment {{ data.fragmentId }}?
      The Fragment will remain and the reusable Image will stay in the catalogue.
    </p>
    <div class="actions">
      <button type="button" (click)="ref.close(false)">Cancel</button>
      <button type="button" (click)="ref.close(true)">Clear Image</button>
    </div>
  `,
  styles: [`
    :host { display: block; padding: 24px; background: var(--diaries-surface); color: var(--diaries-ink); border-radius: 6px; }
    h2 { margin-top: 0; }
    p { overflow-wrap: anywhere; }
    .actions { display: flex; justify-content: flex-end; gap: 12px; }
    button { padding: 8px 16px; cursor: pointer; font: inherit; color: inherit;
      background: var(--diaries-paper); border: 1px solid var(--diaries-line); border-radius: 4px; }
    button:focus-visible { outline: 2px solid var(--diaries-focus); outline-offset: 2px; }
  `]
})
export class ClearImageConfirmationComponent {
  constructor(
    @Inject(DIALOG_DATA) public data: ClearImageConfirmationData,
    public ref: DialogRef<boolean>
  ) {}
}
