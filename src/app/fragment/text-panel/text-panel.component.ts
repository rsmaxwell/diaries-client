import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelContext } from '../../model/model-context';
import { Fragment } from '../../model/fragment';
import { auditTime, BehaviorSubject, combineLatest, distinctUntilChanged, distinctUntilKeyChanged, filter, map, pairwise, startWith, Subject, switchMap, take, takeUntil } from 'rxjs';
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
import Quill from 'quill';
import { FileSelection, FilesListDialogComponent } from '../../files-list-dialog/files-list-dialog.component';
import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { AccessTokenService } from '../../user/token/accessTokenService';

// minimal shape we need
type QuillToolbarModule = {
  addHandler: (format: string, handler: (...args: any[]) => void) => void;
};

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
    private rpcService: RpcService,
    private dialog: Dialog,
    private accessTokenService: AccessTokenService,
  ) { }

  ngOnInit(): void {
    console.log(`TextPanelComponent.ngOnInit`);

    // 1) Keep the panel updated when selected fragment OR lock owner changes
    this.modelContext.selectedFragment$
      .pipe(
        distinctUntilChanged((a, b) => {
          if (a === b) return true;
          if (!a || !b) return false;

          const aLock = (a as any)?.lock?.lockUserId ?? (a as any)?.lockUserId ?? null;
          const bLock = (b as any)?.lock?.lockUserId ?? (b as any)?.lockUserId ?? null;

          // IMPORTANT: include lock owner in the equality check so lock updates are not filtered out
          return a.id === b.id && a.version === b.version && aLock === bLock;
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(fragment => {
        console.log(`TextPanelComponent.<subscribe fragment>: ${fragment ? fragment.id : 'none'}`);

        this.fragment = fragment;

        // (re)seed form + date baselines
        let html = '';
        let dateFormatter = new DateFormatter(0, 0, 0);

        if (fragment) {
          this.originalYear = fragment.year;
          this.originalMonth = fragment.month;
          this.originalDay = fragment.day;

          html = fragment.text;
          dateFormatter = new DateFormatter(fragment.year, fragment.month, fragment.day);
        } else {
          this.originalYear = 0;
          this.originalMonth = 0;
          this.originalDay = 0;
        }

        this.formattedDate = dateFormatter.formattedDate;
        this.isDateValid = dateFormatter.isDateValid;

        // Seed editor body WITHOUT triggering valueChanges
        this.form.get('body')!.setValue(html, {
          emitEvent: false,
          emitModelToViewChange: true
        });
      });

    // 2) Watch editing transitions via hasEdits
    //    - false -> true : acquire lock (via updateFragment$)
    //    - true -> false : release lock (via updateFragment$ with lockInfo=null)
    const bodyCtrl = this.form.get('body')!;

    bodyCtrl.valueChanges
      .pipe(
        auditTime(0),
        map(() => this.hasEdits),
        startWith(this.hasEdits),
        distinctUntilChanged(),
        pairwise(), // [prev, curr]
        takeUntil(this.destroy$)
      )
      .subscribe(([prevEdits, currEdits]) => {
        if (!this.fragment) return;

        // -------- false -> true : user started editing (acquire lock) --------
        if (!prevEdits && currEdits) {
          if (this.isLockedByMe) return;

          const requestPayload: Fragment = {
            ...this.fragment,
            text: bodyCtrl.value as string,
            version: this.fragment.version
          };

          console.log(
            `TextPanelComponent: edits started -> updateFragment$ to trigger lock, fragmentId=${this.fragment.id}`
          );

          this.rpcService.updateFragment$(requestPayload)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (n) => console.log(`TextPanelComponent: updateFragment$ completed (${n})`),
              error: (err) => console.warn(`TextPanelComponent: updateFragment$ failed`, err)
            });

          return;
        }

        // -------- true -> false : user undid back to original (release lock) --------
        if (prevEdits && !currEdits) {
          // Only release if I hold the lock (avoid clearing another user's lock)
          if (!this.isLockedByMe) return;

          // Clear lock info but otherwise do a normal update
          // NOTE: You said the field is "lockInfo". If your model also uses "lock",
          // you can clear that too (safe, but remove if it breaks typing).
          const unlockPayload: any = {
            ...this.fragment,
            text: bodyCtrl.value as string,
            version: this.fragment.version,
            lockInfo: null,
            lock: null
          };

          console.log(
            `TextPanelComponent: edits undone -> updateFragment$ with lockInfo=null to release lock, fragmentId=${this.fragment.id}`
          );

          this.rpcService.updateFragment$(unlockPayload as Fragment)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (n) => console.log(`TextPanelComponent: unlock updateFragment$ completed (${n})`),
              error: (err) => console.warn(`TextPanelComponent: unlock updateFragment$ failed`, err)
            });

          return;
        }
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


  // ---------------------------------------------------------------------------
  // Lock button helpers
  // ---------------------------------------------------------------------------

  /** Current signed-in user id (null if not signed in / not yet known). */
  get myUserId(): number | null {
    return this.accessTokenService.userId;
  }

  /** Current signed-in display name (known-as preferred, else username). */
  get myDisplayName(): string | null {
    return this.accessTokenService.knownas ?? this.accessTokenService.username;
  }

  /** Lock owner userId from the selected fragment (supports nested lock or legacy flattened fields). */
  get lockUserId(): number | null {
    if (!this.fragment) return null;
    const f: any = this.fragment as any;
    return f?.lock?.lockUserId ?? f?.lockUserId ?? null;
  }

  get isLockedByMe(): boolean {
    return this.lockUserId != null && this.myUserId != null && this.lockUserId === this.myUserId;
  }

  get isLockedByOther(): boolean {
    return this.lockUserId != null && !this.isLockedByMe;
  }

  /**
   * Display name for the lock owner.
   *
   * Note: AccessTokenService only knows *me*. If the lock is held by someone
   * else, we can only show their name if the server includes it in the fragment payload.
   */
  get lockOwnerDisplay(): string {
    console.log(`TextPanelComponent.lockOwnerDisplay: lockUserId: ${this.isLockedByMe}`);

    if (this.lockUserId == null) return '';

    if (this.isLockedByMe) {
      return this.myDisplayName ?? `user ${this.lockUserId}`;
    }

    const f: any = this.fragment as any;
    const lock: any = f?.lock ?? {};
    const name = lock?.knownas ?? lock?.username ?? lock?.lockKnownas ?? lock?.lockUsername ?? null;
    return name ? String(name) : `user ${this.lockUserId}`;
  }

  get lockButtonText(): string {
    if (this.lockUserId == null) return '';
    if (this.isLockedByMe) return 'Locked';
    return `Locked by ${this.lockOwnerDisplay}`;
  }





  isLocked(): void {
    console.log(`TextPanelComponent.isLocked: fragment: ${JSON.stringify(this.fragment)}`);
  }

  onLockInfo(): void {
    console.log(`TextPanelComponent.onLockInfo: fragment: ${JSON.stringify(this.fragment)}`);
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

  onEditorCreated(quill: Quill) {
    console.log(`TextPanelComponent.onEditorCreated`);
    const toolbar = quill.getModule('toolbar') as unknown as QuillToolbarModule | undefined;

    if (!toolbar || typeof toolbar.addHandler !== 'function') {
      console.warn('Quill toolbar module not available; ensure toolbar is enabled in editorModules.');
      return;
    }

    toolbar.addHandler('image', () => this.openImagePicker(quill));
  }

  private openImagePicker(quill: any) {
    // start from root (or remember last path if you prefer)
    const path$ = new BehaviorSubject<string>('/');

    const ref: DialogRef<FileSelection, FilesListDialogComponent> =
      this.dialog.open(FilesListDialogComponent, {
        width: '980px',
        panelClass: 'files-dialog-panel',
        data: { path$, select: true }          // <-- selection mode
      });

    ref.closed.pipe(take(1)).subscribe(res => {
      path$.complete();                       // tidy
      if (!res?.url) return;

      // Insert image at the current selection/cursor
      const range = quill.getSelection(true);
      const url = res.url.startsWith('http')
        ? res.url
        : new URL(res.url, window.location.origin).toString();

      const index = range ? range.index : quill.getLength();
      quill.insertEmbed(index, 'image', url, 'user');
      quill.setSelection(index + 1, 0);
    });
  }
}
