import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelContext } from '../../model/model-context';
import { Fragment } from '../../model/fragment';
import { combineLatest, distinctUntilChanged, distinctUntilKeyChanged, map, Subject, takeUntil } from 'rxjs';
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
import { DateFormatter } from '../../utilities/DateFormatter';

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

  formattedDate = '';
  isDateValid = false;
  private destroy$ = new Subject<void>();

  constructor(
    private modelContext: ModelContext,
    private rpcService: RpcService
  ) { }

  ngOnInit(): void {
    console.log(`TextPanelComponent.ngOnInit`);

    this.modelContext.fragment$
      .pipe(
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(fragment => {
        console.log(`TextPanelComponent.<subscribe fragment>: ${JSON.stringify(fragment)}`);

        if (this.fragment && this.fragment.id !== fragment.id) {
          console.log(`TextPanelComponent.<on subscribe fragment>: Cleaning up fragment: ${this.fragment.id}`);
          this.destroy$.next();
          this.destroy$.complete(); 
          this.destroy$ = new Subject<void>();
        }

        this.fragment = fragment;

        let html = '';
        let dateFormatter = new DateFormatter(0, 0, 0);
        if (!fragment) {
          this.originalYear = 0;
          this.originalMonth = 0;
          this.originalDay = 0;
        }
        else {
          console.log(`TextPanelComponent.<subscribe fragment>: fragment: ${fragment.id}`);
          // store the “initial” date
          this.originalYear = fragment.year;
          this.originalMonth = fragment.month;
          this.originalDay = fragment.day;
          html = fragment.text;
          dateFormatter = new DateFormatter(fragment.year, fragment.month, fragment.day);
        }

        this.formattedDate = dateFormatter.formattedDate;
        this.isDateValid = dateFormatter.isDateValid;
        this.form.get('body')!.setValue(html, {
          emitEvent: false,              // don’t re‑trigger value‑change handlers
          emitModelToViewChange: true    // update the editor UI        
        });
      });
  }

  ngOnDestroy(): void {
    console.log(`TextPanelComponent.ngOnDestroy`);
    this.destroy$.next();
    this.destroy$.complete();
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
      // 1) write back into the model
      this.fragment.year = newDate.getFullYear();
      this.fragment.month = newDate.getMonth() + 1;
      this.fragment.day = newDate.getDate();

      // 2) recalculate what’s shown in the header
      const df = new DateFormatter(
        this.fragment.year,
        this.fragment.month,
        this.fragment.day
      );
      this.formattedDate = df.formattedDate;
      this.isDateValid = df.isDateValid;
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
    console.log(`Save clicked! Current fragment: ${JSON.stringify(this.fragment)}`);
    const current = this.form.get('body')!.value as string;

    if (this.fragment) {
      this.fragment.text = current;

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
