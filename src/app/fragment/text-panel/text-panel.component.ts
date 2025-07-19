import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelContext } from '../../model/model-context';
import { Fragment } from '../../model/fragment';
import { distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { QuillModule } from 'ngx-quill';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RpcService } from '../../mqtt/rpc.service';
import { Marquee } from '../../model/marquee';

@Component({
  selector: 'app-text-panel',
  standalone: true,
  imports: [
    CommonModule,
    QuillModule,
    ReactiveFormsModule,
    FormsModule,
  ],
  templateUrl: './text-panel.component.html',
  styleUrls: ['./text-panel.component.scss']
})
export class TextPanelComponent implements OnInit, OnDestroy {
  marquee: Marquee | null = null;
  fragment: Fragment | null = null;  
  htmlContent = '';  // two‑way bound HTML

  form: FormGroup = new FormGroup({
    body: new FormControl('<p>Hello, Quill!</p>')
  });

  editorModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ header: [1, 2, 3, false] }],
      [{ list: 'bullet' }, { list: 'ordered' }],
      ['link', 'image']
    ]
  };

  private destroy$ = new Subject<void>();

  constructor(
    private modelContext: ModelContext,
    private rpcService: RpcService
  ) { }

  ngOnInit(): void {
    console.log(`TextPanelComponent.ngOnInit`);

    this.modelContext.fragment$
      .pipe(
        distinctUntilChanged((a, b) => a?.id === b?.id),
        takeUntil(this.destroy$)
      )
      .subscribe(fragment => {
        this.fragment = fragment;
        const html = fragment?.text ?? '';   // default to empty
        console.log(`TextPanelComponent: fragment: ${JSON.stringify(fragment)}`);
        this.form.get('body')!.setValue(html, {
          emitEvent: false,              // don’t re‑trigger value‑change handlers
          emitModelToViewChange: true    // update the editor UI        
        });
      });

    this.modelContext.marquee$
      .pipe(
        distinctUntilChanged((a, b) => a?.id === b?.id),
        takeUntil(this.destroy$)
      )
      .subscribe(marquee => {
        this.marquee = marquee;
        console.log(`TextPanelComponent: marquee: ${JSON.stringify(marquee)}`);
      });
  }

  get formattedDate(): string {
    if (!this.fragment) return '';
    const y = this.fragment.year || 0;
    const m = this.fragment.month || 0;
    const d = this.fragment.day || 0;
    return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** true if there are unsaved edits */
  get hasEdits(): boolean {
    const current = this.form.get('body')!.value as string;
    const original = this.fragment?.text ?? '';
    return current !== original;
  }

  onSave(): void {
    console.log(`Save clicked! Current fragment id: ${this.fragment?.id}`);
    const current = this.form.get('body')!.value as string;

    if (this.fragment) {
      this.fragment.text = current;
      this.fragment.marquee = this.marquee;

      console.log(`TextPanelComponent.onSave`)
      this.rpcService.updateFragment$(this.fragment).subscribe({
        next: (reply) => {
          console.log(`TextPanelComponent.onSave: success: reply: ${reply}`)
        },
        error: (err) => {
          console.log(`TextPanelComponent.onSave: error: ${err}`)
        }
      });
    }
  }
}
