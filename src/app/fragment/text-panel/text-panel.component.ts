import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelContext } from '../../model/model-context';
import { Fragment } from '../../model/fragment';
import { combineLatest, distinctUntilChanged, distinctUntilKeyChanged, filter, map, Subject, switchMap, take, takeUntil } from 'rxjs';
import { QuillModule } from 'ngx-quill';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RpcService } from '../../mqtt/rpc.service';

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

    this.modelContext.selectedFragment$
      .pipe(
        // emit again when either id or version changes
        distinctUntilChanged((a, b) =>
          (!!a && !!b) ? (a.id === b.id && a.version === b.version) : (a === b)
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(fragment => {
        console.log(`TextPanelComponent.<subscribe fragment>: ${fragment ? fragment.id : 'none'}`);

        this.fragment = fragment;

        // (re)seed form + date baselines
        let html = '';
        let dateFormatter = new DateFormatter(0, 0, 0);
        if (fragment) {
          // store the “initial” date
          this.originalYear = fragment.year;
          this.originalMonth = fragment.month;
          this.originalDay = fragment.day;
          html = fragment.text;
          dateFormatter = new DateFormatter(fragment.year, fragment.month, fragment.day);
        }
        else {
          this.originalYear = 0;
          this.originalMonth = 0;
          this.originalDay = 0;
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
    console.log(`TextPanelComponent.onSave: fragment: ${JSON.stringify(this.fragment)}`);
    if (!this.fragment) return;

    const currentBody = this.form.get('body')!.value as string;

    // Snapshots for rollback
    const prevFragment: Fragment = { ...this.fragment };
    const prevOriginals = {
      y: this.originalYear,
      m: this.originalMonth,
      d: this.originalDay,
    };

    // Build "server payload": keep the PREVIOUS version here
    // (typical optimistic concurrency expects the server to bump)
    const requestPayload: Fragment = {
      ...prevFragment,
      text: currentBody,
      // year/month/day were already applied locally via onDateSelected()
      // so use whatever is currently on the fragment for the payload:
      year: this.fragment.year,
      month: this.fragment.month,
      day: this.fragment.day,
      version: prevFragment.version, // send old version to the server
    };

    // ---- OPTIMISTIC LOCAL UPDATE ----
    // 1) bump local version for immediate UI feedback
    this.fragment = {
      ...requestPayload,
      version: (prevFragment.version ?? 0) + 1,
    };

    // 2) update baselines & header so hasEdits() becomes false, date header matches
    this.originalYear = this.fragment.year || 0;
    this.originalMonth = this.fragment.month || 0;
    this.originalDay = this.fragment.day || 0;

    const df = new DateFormatter(this.fragment.year || 0, this.fragment.month || 0, this.fragment.day || 0);
    this.formattedDate = df.formattedDate;
    this.isDateValid = df.isDateValid;

    // 3) optionally mark the form pristine now that we've "saved"
    this.form.markAsPristine();

    // ---- SERVER CALL ----
    this.rpcService.updateFragment$(requestPayload).subscribe({
      next: () => {
        // Success: nothing else to do. ModelContext will refresh
        // the selected fragment when it hears from the backend,
        // but our optimistic state is already correct.
        console.log('TextPanelComponent.onSave: success (optimistic accepted)');
      },
      error: (err) => {
        console.log(`TextPanelComponent.onSave: error -> rolling back: ${err}`);

        // ---- ROLLBACK ----
        this.fragment = prevFragment;
        this.originalYear = prevOriginals.y;
        this.originalMonth = prevOriginals.m;
        this.originalDay = prevOriginals.d;

        const rollDf = new DateFormatter(prevFragment.year || 0, prevFragment.month || 0, prevFragment.day || 0);
        this.formattedDate = rollDf.formattedDate;
        this.isDateValid = rollDf.isDateValid;

        // restore editor body without firing change handlers
        this.form.get('body')!.setValue(prevFragment.text ?? '', {
          emitEvent: false,
          emitModelToViewChange: true
        });
      }
    });
  }
}
