import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelContext } from '../../model/model-context';
import { Fragment } from '../../model/fragment';
import { auditTime, BehaviorSubject, distinctUntilChanged, firstValueFrom, map, pairwise, startWith, Subject, take, takeUntil } from 'rxjs';
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
import { RefreshTokenService } from '../../user/token/refreshTokenService';
import { HttpStatusCode } from '@angular/common/http';
import { Router } from '@angular/router';

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
  htmlContent = '';  // two-way bound HTML

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
  private lockRequestedForFragmentId: number | null = null;
  private quill?: Quill;

  // Tracks the fragment we are currently "on" so we can unlock when leaving
  private currentFragment: Fragment | null = null;

  constructor(
    private modelContext: ModelContext,
    private rpcService: RpcService,
    private dialog: Dialog,
    private accessTokenService: AccessTokenService,
    private refreshTokenService: RefreshTokenService,
    private router: Router
  ) { }

  ngOnInit(): void {
    console.log(`TextPanelComponent.ngOnInit`);

    const bodyCtrl = this.form.get('body')!;

    // 1) Keep the panel updated when selected fragment OR lock owner changes
    this.modelContext.selectedFragment$
      .pipe(
        distinctUntilChanged((a, b) => {
          if (a === b) return true;
          if (!a || !b) return false;

          const aLockUserId = (a as any)?.lock?.lockUserId ?? null;
          const bLockUserId = (b as any)?.lock?.lockUserId ?? null;

          const aLockSessionId = (a as any)?.lock?.lockSessionId ?? null;
          const bLockSessionId = (b as any)?.lock?.lockSessionId ?? null;

          const aLocked = (a as any)?.lock?.locked ?? false;
          const bLocked = (b as any)?.lock?.locked ?? false;

          return a.id === b.id
            && a.version === b.version
            && aLockUserId === bLockUserId
            && aLockSessionId === bLockSessionId
            && aLocked === bLocked;
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(fragment => {

        const prevId = this.fragment?.id ?? null; // the UI’s current fragment id
        const nextId = fragment?.id ?? null;
        const switchingFragment = prevId !== nextId;

        const leaving = this.fragment; // <-- what the UI was showing up to now

        // --- NEW: unlock the fragment we are leaving ---
        console.log(`TextPanelComponent: unlock the fragment we are leaving, id=${leaving?.id}`);

        console.log(`TextPanelComponent: switchingFragment = ${switchingFragment}`);
        console.log(`TextPanelComponent: leaving?.id       = ${leaving?.id}`);
        console.log(`TextPanelComponent: this.isLockedByMe = ${this.isLockedByMe}`);

        if (switchingFragment && leaving?.id != null && this.isLockedByMe) {
          console.log(`TextPanelComponent: switching away -> unlockFragment$, id=${leaving.id}`);
          this.rpcService.unlockFragment$(leaving.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => console.log(`TextPanelComponent: unlockFragment$ (on switch) completed`),
              error: (err) => {
                console.log(`TextPanelComponent: unlockFragment$ (on switch) failed`, err)

                if (err?.status === HttpStatusCode.Unauthorized) {
                  // clear auth
                  this.accessTokenService.clearToken();
                  this.refreshTokenService.clearToken();

                  // go to signin; keep current URL so you can return after signing in
                  this.router.navigateByUrl(`/signin?returnUrl=${encodeURIComponent(this.router.url)}`);
                  return;
                }
              }
            });
        }

        // Track current fragment after any switch logic
        this.currentFragment = fragment;

        // Capture previous server text before we overwrite this.fragment
        const prevServerText = this.fragment?.text ?? '';
        const nextServerText = fragment?.text ?? '';

        // now update fragment reference (so getters like isLockedByMe use new lock)
        this.fragment = fragment;

        if (switchingFragment) {
          this.lockRequestedForFragmentId = null;
        }

        // update baselines from server (important so Save becomes grey after sync)
        if (fragment) {
          this.originalYear = fragment.year;
          this.originalMonth = fragment.month;
          this.originalDay = fragment.day;
        } else {
          this.originalYear = 0;
          this.originalMonth = 0;
          this.originalDay = 0;
        }

        const serverTextChanged = prevServerText !== nextServerText;

        if (switchingFragment || serverTextChanged) {
          const sel = this.quill?.getSelection();
          bodyCtrl.setValue(nextServerText, { emitEvent: false, emitModelToViewChange: true });

          // Restore cursor only when staying on the same fragment
          if (sel && this.quill && !switchingFragment) {
            queueMicrotask(() => this.quill?.setSelection(sel.index, sel.length ?? 0, 'silent'));
          }
        }

        const df = fragment
          ? new DateFormatter(fragment.year, fragment.month, fragment.day)
          : new DateFormatter(0, 0, 0);

        this.formattedDate = df.formattedDate;
        this.isDateValid = df.isDateValid;

        if (!this.isLockedByMe) {
          this.lockRequestedForFragmentId = null;
        }

        this.updateEditorReadOnlyState();
      });

    // 2) Lock acquisition: trigger off EVERY body change, and use flags to avoid spamming.
    //    This avoids the "distinctUntilChanged got stuck at true" problem after save.
    bodyCtrl.valueChanges
      .pipe(
        auditTime(0),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (!this.fragment) return;

        // Only attempt lock if there are edits right now
        if (!this.hasEdits) return;

        // If already locked by me, nothing to do
        if (this.isLockedByMe) return;

        // So user #2 won’t try to lock while it’s locked by user #1.
        if (this.isLockedByOther) return;

        // Only request once per fragment per edit-session
        if (this.lockRequestedForFragmentId === this.fragment.id) return;

        this.lockRequestedForFragmentId = this.fragment.id;

        console.log(`TextPanelComponent: edits detected -> lockFragment$, fragmentId=${this.fragment.id}`);

        this.rpcService.lockFragment$(this.fragment.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => console.log(`TextPanelComponent: lockFragment$ completed`),
            error: (err) => {
              console.warn(`TextPanelComponent: lockFragment$ failed`, err);

              if (err?.status === HttpStatusCode.Unauthorized) {
                // clear auth
                this.accessTokenService.clearToken();
                this.refreshTokenService.clearToken();

                // go to signin; keep current URL so you can return after signing in
                this.router.navigateByUrl(`/signin?returnUrl=${encodeURIComponent(this.router.url)}`);
                return;
              }

              // allow retry if it failed for other reasons
              this.lockRequestedForFragmentId = null;
            }
          });
      });

    // 3) Unlock-on-undo: watch hasEdits and detect true -> false
    bodyCtrl.valueChanges
      .pipe(
        auditTime(0),

        // project keystrokes -> boolean state
        map(() => this.hasEdits),

        // seed with current value so pairwise has a "previous"
        startWith(this.hasEdits),

        // only react when hasEdits changes
        distinctUntilChanged(),

        // emit [prev, curr]
        pairwise(),

        takeUntil(this.destroy$)
      )
      .subscribe(([wasDirty, isDirty]) => {
        if (!this.fragment) return;

        // true -> false: user returned to original content
        if (wasDirty && !isDirty) {
          // only unlock if I currently hold the lock
          if (!this.isLockedByMe) return;

          console.log(`TextPanelComponent: edits undone -> unlockFragment$, id=${this.fragment.id}`);

          this.rpcService.unlockFragment$(this.fragment.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => console.log(`TextPanelComponent: unlockFragment$ completed`),
              error: (err) => {
                console.log(`TextPanelComponent: unlockFragment$ failed`, err)

                if (err?.status === HttpStatusCode.Unauthorized) {
                  // clear auth
                  this.accessTokenService.clearToken();
                  this.refreshTokenService.clearToken();

                  // go to signin; keep current URL so you can return after signing in
                  this.router.navigateByUrl(`/signin?returnUrl=${encodeURIComponent(this.router.url)}`);
                  return;
                }
              }
            });
        }
      });
  }

  private isLockedByMeFragment(f: Fragment): boolean {
    const lock = (f as any)?.lock;
    return !!lock
      && lock.locked === true
      && lock.lockUserId != null
      && lock.lockSessionId != null
      && this.myUserId != null
      && this.mySessionId != null
      && lock.lockUserId === this.myUserId
      && lock.lockSessionId === this.mySessionId;
  }

  private updateEditorReadOnlyState(): void {
    const bodyCtrl = this.form.get('body')!;
    const readOnly = this.isLockedByOther;

    if (readOnly) {
      bodyCtrl.disable({ emitEvent: false });
    } else {
      bodyCtrl.enable({ emitEvent: false });
    }

    // Quill UI read-only (prevents typing/cursor edits)
    this.quill?.enable(!readOnly);
  }

  ngOnDestroy(): void {
    console.log(`TextPanelComponent.ngOnDestroy`);

    // --- NEW: unlock the fragment we are leaving (component destroyed / panel closed) ---
    const leaving = this.fragment;
    if (leaving?.id != null && this.isLockedByMe) {
      console.log(`TextPanelComponent: destroy -> unlockFragment$, id=${leaving.id}`);
      this.rpcService.unlockFragment$(leaving.id)
        .pipe(take(1))
        .subscribe({
          next: () => console.log(`TextPanelComponent: unlockFragment$ (on destroy) completed`),
          error: (err) => {
            console.log(`TextPanelComponent: unlockFragment$ (on destroy) failed`, err)

            if (err?.status === HttpStatusCode.Unauthorized) {
              // clear auth
              this.accessTokenService.clearToken();
              this.refreshTokenService.clearToken();

              // go to signin; keep current URL so you can return after signing in
              this.router.navigateByUrl(`/signin?returnUrl=${encodeURIComponent(this.router.url)}`);
              return;
            }
          }
        });
    }


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
    return this.accessTokenService.knownAs ?? this.accessTokenService.username;
  }

  /** Current signed-in display name (known-as preferred, else username). */
  get mySessionId(): string | null {
    return this.accessTokenService.sessionId ?? this.accessTokenService.sessionId;
  }

  /** Lock owner userId from the selected fragment (supports nested lock or legacy flattened fields). */
  get lockUserId(): number | null {
    return this.fragment?.lock?.lockUserId ?? null;
  }

  get isLockedByMe(): boolean {
    const lock = this.fragment?.lock;

    // console.log(`TextPanelComponent.isLockedByMe: lock: userId: ${lock!.lockUserId}, sessionId: ${lock!.lockSessionId}`);
    // console.log(`TextPanelComponent.isLockedByMe: this: userId: ${this.myUserId}, sessionId: ${this.mySessionId}`);

    return !!lock
      && lock.lockUserId != null
      && this.myUserId != null
      && lock.lockUserId === this.myUserId
      && lock.lockSessionId != null
      && this.mySessionId != null
      && lock.lockSessionId === this.mySessionId;
  }

  get isLockedByOther(): boolean {
    const lock = this.fragment?.lock;
    return !!lock?.locked && !this.isLockedByMe;
  }

  /**
   * Display name for the lock owner.
   *
   * Note: AccessTokenService only knows *me*. If the lock is held by someone
   * else, we can only show their name if the server includes it in the fragment payload.
   */
  get lockOwnerDisplay(): string {
    const lock = this.fragment?.lock;
    if (!lock?.locked) return '';

    // same user, different session -> very common in your setup
    if (lock.lockUserId === this.myUserId && lock.lockSessionId !== this.mySessionId) {
      return 'another window';
    }

    return (
      lock.lockUserName?.trim() ||
      lock.lockKnownAs?.trim() ||
      (lock.lockUserId != null ? `${lock.lockUserId}` : 'someone')
    );
  }

  get lockButtonText(): string {
    if (this.lockUserId == null) return 'Unlocked';
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

    // keep currentFragment in sync with fragment reference
    this.currentFragment = this.fragment;

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

        if (err?.status === HttpStatusCode.Unauthorized) {
          // clear auth
          this.accessTokenService.clearToken();
          this.refreshTokenService.clearToken();

          // go to signin; keep current URL so you can return after signing in
          this.router.navigateByUrl(`/signin?returnUrl=${encodeURIComponent(this.router.url)}`);
          return;
        }

        // ---- ROLLBACK ----
        this.fragment = prevFragment;
        this.currentFragment = prevFragment;

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
    this.quill = quill;
    const toolbar = quill.getModule('toolbar') as unknown as QuillToolbarModule | undefined;

    if (!toolbar || typeof toolbar.addHandler !== 'function') {
      console.warn('Quill toolbar module not available; ensure toolbar is enabled in editorModules.');
      return;
    }

    toolbar.addHandler('image', () => this.openImagePicker(quill));
    this.updateEditorReadOnlyState(); // apply initial state
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
