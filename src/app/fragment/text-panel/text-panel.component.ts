import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelContext } from '../../model/model-context';
import { Fragment } from '../../model/fragment';
import { distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { QuillModule } from 'ngx-quill';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RpcService } from '../../mqtt/rpc.service';
import { Marquee } from '../../model/marquee';

// import the Material modules and types
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule, MatDatepicker } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';

@Component({
  selector: 'app-text-panel',
  standalone: true,
  imports: [
    CommonModule,
    QuillModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './text-panel.component.html',
  styleUrls: ['./text-panel.component.scss']
})
export class TextPanelComponent implements OnInit, OnDestroy {

  @ViewChild('picker') picker!: MatDatepicker<Date>;

  marquee: Marquee | null = null;
  fragment: Fragment | null = null;
  htmlContent = '';  // two‑way bound HTML

  private originalYear = 0;
  private originalMonth = 0;
  private originalDay = 0;

  form: FormGroup = new FormGroup({
    body: new FormControl('<p>Hello, Quill!</p>')
  });

  editorModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ header: [1, 2, 3, false] }],
      [{ list: 'bullet' }, { list: 'ordered' }],
      ['link', 'image'],
      [{ font: [] }],
      [{ size: ['small', false, 'large', 'huge'] }],
      [{ color: [] }, { background: [] }]
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

        // store the “initial” date
        this.originalYear = fragment?.year || 0;
        this.originalMonth = fragment?.month || 0;
        this.originalDay = fragment?.day || 0;


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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** display either verbose (“Y Month D”) or numeric (“YYYY‑MM‑DD”) */
  get formattedDate(): string {
    if (!this.fragment) { return ''; }

    const { year: y = 0, month: m = 0, day: d = 0 } = this.fragment;

    // Month names lookup
    const monthNames = [
      'January','February','March','April',
      'May','June','July','August',
      'September','October','November','December'
    ];
    const monthStr = monthNames[m - 1] || '';

    if (this.isDateValid) {
      // verbose form
      return `${y} ${monthStr} ${d}`;
    } else {
      // numeric fallback
      const numY = y.toString().padStart(4, '0');
      const numM = m.toString().padStart(2, '0');
      const numD = d.toString().padStart(2, '0');
      return `${numY}-${numM}-${numD}`;
    }
  }

  /** true iff all three parts of the date are set */
  get isDateValid(): boolean {
    return !!this.fragment
      && this.fragment.year  > 0
      && this.fragment.month > 0
      && this.fragment.day   > 0;
  }

  /**  
   * Returns a real Date if year/month/day are set (>0),
   * otherwise null if they’re still at the 0/0/0 default.
   */
  get date(): Date | null {
    if (!this.fragment) return null;
    const year = this.fragment.year || 0;
    const month = this.fragment.month || 0;
    const day = this.fragment.day || 0;
    // no date set
    if (year === 0 && month === 0 && day === 0) {
      return null;
    }
    // JS Date: months are 0–11
    return new Date(year, month - 1, day);
  }

  editDate() {
    console.log(`TextPanelComponent.editDate`)
    this.picker.open();
  }

  /** when the user picks a date, write it back into the Fragment */
  onDateSelected(event: MatDatepickerInputEvent<Date>) {
    const newDate = event.value;
    if (this.fragment && newDate) {
      this.fragment.year = newDate.getFullYear();
      this.fragment.month = newDate.getMonth() + 1;
      this.fragment.day = newDate.getDate();
      // optionally push straight to the server:
      // this.rpcService.updateFragment$(this.fragment).subscribe();
    }
  }

  /** true if either the body or the date has been edited */
  get hasEdits(): boolean {
    if (!this.fragment) return false;

    // 2) check body
    const currentBody = this.form.get('body')!.value as string;
    const originalBody = this.fragment.text ?? '';
    const bodyChanged = currentBody !== originalBody;

    // 3) check date
    const dateChanged =
      (this.fragment.year || 0) !== this.originalYear ||
      (this.fragment.month || 0) !== this.originalMonth ||
      (this.fragment.day || 0) !== this.originalDay;

    return bodyChanged || dateChanged;
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

          // update the “initial” date
          this.originalYear = this.fragment?.year || 0;
          this.originalMonth = this.fragment?.month || 0;
          this.originalDay = this.fragment?.day || 0;
        },
        error: (err) => {
          console.log(`TextPanelComponent.onSave: error: ${err}`)
        }
      });
    }
  }
}
