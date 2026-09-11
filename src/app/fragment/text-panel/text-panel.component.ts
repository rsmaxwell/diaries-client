import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelContext } from '../../model/model-context';
import { EditLockInfo, Fragment } from '../../model/fragment';
import { auditTime, BehaviorSubject, combineLatest, distinctUntilChanged, firstValueFrom, from, map, pairwise, startWith, Subject, take, takeUntil } from 'rxjs';
import { QuillModule } from 'ngx-quill';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RpcError, RpcService } from '../../mqtt/rpc.service';

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
import { FragmentLockService } from '../fragment-lock.service';
import { ConfigService } from '../../config/config.service';
import { buildLegacyImageBaseUrl, resolveLegacyFragmentHtml, restoreLegacyFragmentHtml } from '../../utilities/legacy-fragment-html.pipe';

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
  saveInFlight = false;
  private destroy$ = new Subject<void>();
  private lockRequestedForFragmentId: number | null = null;
  private quill?: Quill;
  private editorServerText = '';
  private legacyImageBaseUrl = '';

  // Tracks the fragment we are currently "on" so we can unlock when leaving
  private currentFragment: Fragment | null = null;

  constructor(
    private modelContext: ModelContext,
    private rpcService: RpcService,
    private dialog: Dialog,
    private accessTokenService: AccessTokenService,
    private refreshTokenService: RefreshTokenService,
    private router: Router,
    private fragmentLockService: FragmentLockService,
    private configService: ConfigService
  ) { }


  // ---------------------------------------------------------------------------
  // Angular lifecycle
  // ---------------------------------------------------------------------------

  ngOnInit(): void {
    console.log(`TextPanelComponent.ngOnInit`);

    const bodyCtrl = this.form.get('body')!;

    // 1) Keep the panel updated when selected fragment OR lock owner changes
    const selectedFragment$ = this.modelContext.selectedFragment$
      .pipe(
        distinctUntilChanged((a, b) => {
          if (a === b) return true;
          if (!a || !b) return false;

          const aLock = a.lock ?? null;
          const bLock = b.lock ?? null;

          return a.id === b.id
            && a.version === b.version
            && aLock?.lockUserId === bLock?.lockUserId
            && aLock?.lockSessionId === bLock?.lockSessionId
            && aLock?.lockTimeStamp === bLock?.lockTimeStamp
            && aLock?.lockUserName === bLock?.lockUserName
            && aLock?.lockKnownAs === bLock?.lockKnownAs;
        })
      );

    combineLatest([
      selectedFragment$,
      this.modelContext.selectedDiary$,
      from(this.configService.getConfig())
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([fragment, diary, config]) => {
        const prevId = this.fragment?.id ?? null;
        const nextId = fragment?.id ?? null;
        const switchingFragment = prevId !== nextId;

        const nextLegacyImageBaseUrl = buildLegacyImageBaseUrl(
          config.baseUrl,
          config.files,
          diary.name
        );
        const legacyImageBaseChanged = this.legacyImageBaseUrl !== nextLegacyImageBaseUrl;
        this.legacyImageBaseUrl = nextLegacyImageBaseUrl;

        const leaving = this.fragment;

        console.log(`TextPanelComponent: we are leaving fragment.id=${leaving?.id}`);

        if (switchingFragment) {
          void this.unlockCurrentFragment('switching fragment');
        }

        // Track current fragment after any switch logic
        this.currentFragment = fragment;

        // Capture previous server text before we overwrite this.fragment
        const prevServerText = this.fragment?.text ?? '';
        const nextServerText = fragment?.text ?? '';
        const nextEditorText = resolveLegacyFragmentHtml(nextServerText, this.legacyImageBaseUrl);

        // now update fragment reference
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

        if (switchingFragment || serverTextChanged || legacyImageBaseChanged) {
          const sel = this.quill?.getSelection();
          this.editorServerText = nextEditorText;
          bodyCtrl.setValue(nextEditorText, { emitEvent: false, emitModelToViewChange: true });

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

        const fragmentId = this.fragment.id;
        this.lockRequestedForFragmentId = fragmentId;

        console.log(`TextPanelComponent: edits detected -> lockFragment, fragmentId=${fragmentId}`);

        void this.lockCurrentFragmentForBodyEdit(fragmentId);
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
          void this.unlockCurrentFragment('edits undone');
        }
      });
  }

  ngOnDestroy(): void {
    console.log(`TextPanelComponent.ngOnDestroy`);

    void this.unlockCurrentFragment('destroy');

    this.destroy$.next();
    this.destroy$.complete();
  }


  // ---------------------------------------------------------------------------
  // Template state
  // ---------------------------------------------------------------------------

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

  get hasEdits(): boolean {
    if (!this.fragment) return false;

    // 2) check body
    const currentBody = this.form.get('body')!.value as string;
    const originalBody = this.editorServerText;
    const bodyChanged = currentBody !== originalBody;

    // 3) check date
    const dateChanged =
      (this.fragment.year || 0) !== this.originalYear ||
      (this.fragment.month || 0) !== this.originalMonth ||
      (this.fragment.day || 0) !== this.originalDay;

    return bodyChanged || dateChanged;
  }

  // ---------------------------------------------------------------------------
  // Date editing
  // ---------------------------------------------------------------------------

  async editDate(): Promise<void> {
    console.log(`TextPanelComponent.editDate`);

    if (!this.fragment) {
      return;
    }

    if (this.isLockedByOther) {
      console.log(`TextPanelComponent.editDate: fragment is locked by another session`);
      return;
    }

    if (!this.isLockedByMe) {
      const fragmentId = this.fragment.id;

      this.lockRequestedForFragmentId = fragmentId;

      const locked = await this.fragmentLockService.lockFragmentForEdit(fragmentId);
      if (!locked) {
        if (this.fragment?.id === fragmentId) {
          this.lockRequestedForFragmentId = null;
        }
        return;
      }

      /*
       * The user may have selected another fragment while the lock RPC
       * was in flight. If so, immediately unlock the fragment we just locked.
       */
      if (this.fragment?.id !== fragmentId) {
        await this.fragmentLockService.unlockFragment(
          fragmentId,
          'date edit lock completed after fragment switch'
        );
        return;
      }

      this.markFragmentLockedByMe();
    }

    this.picker.open();
  }

  /** when the user picks a date, write it back into the Fragment */
  onDateSelected(event: MatDatepickerInputEvent<Date>): void {
    const newDate = event.value;

    if (!this.fragment || !newDate) {
      return;
    }

    this.fragment.year = newDate.getFullYear();
    this.fragment.month = newDate.getMonth() + 1;
    this.fragment.day = newDate.getDate();

    const df = new DateFormatter(
      this.fragment.year,
      this.fragment.month,
      this.fragment.day
    );

    this.formattedDate = df.formattedDate;
    this.isDateValid = df.isDateValid;

    /*
     * If the selected date returns the fragment to its original state,
     * release the lock. This mirrors your existing "edits undone" logic,
     * but that existing logic only watches bodyCtrl.valueChanges.
     */
    if (!this.hasEdits && this.isLockedByMe) {
      void this.unlockCurrentFragment('date selected back to original');
    }
  }

  /** true if either the body or the date has been edited */
  onDatePickerClosed(): void {
    console.log(`TextPanelComponent.onDatePickerClosed`);

    if (!this.fragment) {
      return;
    }

    /*
     * If the user opened the picker but did not actually change anything,
     * release the lock again.
     *
     * If they did change the date, keep the lock until Save, undo, destroy,
     * or rollback/error handling.
     */
    if (!this.hasEdits && this.isLockedByMe) {
      void this.unlockCurrentFragment('date picker closed without edits');
    }
  }


  // ---------------------------------------------------------------------------
  // Saving
  // ---------------------------------------------------------------------------

  onSave(): void {

    console.log('TextPanelComponent.onSave', {
      fragmentId: this.fragment?.id,
      version: this.fragment?.version
    });

    if (!this.fragment || this.saveInFlight) return;

    const currentEditorBody = this.form.get('body')!.value as string;

    // Snapshots for rollback
    const prevFragment: Fragment = { ...this.fragment };
    const prevOriginals = {
      y: this.originalYear,
      m: this.originalMonth,
      d: this.originalDay,
    };

    const currentBody = currentEditorBody === this.editorServerText
      ? prevFragment.text ?? ''
      : restoreLegacyFragmentHtml(
          currentEditorBody,
          prevFragment.text,
          this.legacyImageBaseUrl
        );

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
    this.editorServerText = currentEditorBody;

    const df = new DateFormatter(this.fragment.year || 0, this.fragment.month || 0, this.fragment.day || 0);
    this.formattedDate = df.formattedDate;
    this.isDateValid = df.isDateValid;

    // 3) optionally mark the form pristine now that we've "saved"
    this.form.markAsPristine();

    // ---- SERVER CALL ----
    this.saveInFlight = true;
    this.rpcService.updateFragment$(requestPayload).subscribe({
      next: () => {
        this.saveInFlight = false;
        console.log('TextPanelComponent.onSave: success (optimistic accepted)');

        // ✅ SERVER CLEARS LOCK ON SAVE (Responder publishes lock:null)
        // Mirror that locally so the next edit will re-lock properly.
        this.markFragmentUnlocked();
      },
      error: (err) => {
        this.saveInFlight = false;
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
        const previousEditorText = resolveLegacyFragmentHtml(
          prevFragment.text,
          this.legacyImageBaseUrl
        );
        this.editorServerText = previousEditorText;
        this.form.get('body')!.setValue(previousEditorText, {
          emitEvent: false,
          emitModelToViewChange: true
        });

        void this.unlockCurrentFragment('save failed rollback');
      }
    });
  }


  // ---------------------------------------------------------------------------
  // Editor integration
  // ---------------------------------------------------------------------------

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
        width: '80vw',
        height: '70vh',
        minWidth: 'min(560px, 96vw)',
        minHeight: 'min(380px, 92vh)',
        maxWidth: '96vw',
        maxHeight: '92vh',
        panelClass: 'files-dialog-panel',
        data: { path$, select: true }
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


  // ---------------------------------------------------------------------------
  // Lock display state
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
    return this.accessTokenService.sessionId;
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
    return this.isLockActive(lock) && !this.isLockedByMe;
  }

  /**
   * Display name for the lock owner.
   *
   * Note: AccessTokenService only knows *me*. If the lock is held by someone
   * else, we can only show their name if the server includes it in the fragment payload.
   */
  get lockOwnerDisplay(): string {
    const lock = this.fragment?.lock;
    if (!lock) return '';
    if (!this.isLockActive(lock)) return '';

    // same user, different session -> very common in your setup
    if (lock.lockUserId === this.myUserId && lock.lockSessionId !== this.mySessionId) {
      return 'another window';
    }

    return (
      lock.lockKnownAs?.trim() ||
      lock.lockUserName?.trim() ||
      (lock.lockUserId != null ? `${lock.lockUserId}` : 'someone')
    );
  }

  get lockButtonText(): string {
    if (!this.isLockActive(this.fragment?.lock)) return 'Unlocked';
    if (this.isLockedByMe) return 'Locked';
    return `Locked by ${this.lockOwnerDisplay}`;
  }

  isLocked(): void {
    console.log('TextPanelComponent.isLocked', {
      fragmentId: this.fragment?.id,
      version: this.fragment?.version,
      lockedByMe: this.isLockedByMe,
      lockedByOther: this.isLockedByOther
    });
  }

  onLockInfo(): void {
    const lock = this.fragment?.lock;

    console.log('TextPanelComponent.onLockInfo', {
      fragmentId: this.fragment?.id,
      lockUserId: lock?.lockUserId ?? null,
      lockUserName: lock?.lockUserName ?? null,
      lockKnownAs: lock?.lockKnownAs ?? null,
      hasLockSessionId: !!lock?.lockSessionId,
      lockTimeStamp: lock?.lockTimeStamp ?? null
    });
  }


  // ---------------------------------------------------------------------------
  // Lock state changes
  // ---------------------------------------------------------------------------

  private async lockCurrentFragmentForBodyEdit(fragmentId: number): Promise<void> {
    const locked = await this.fragmentLockService.lockFragmentForEdit(fragmentId);

    if (!locked) {
      if (this.fragment?.id === fragmentId) {
        this.lockRequestedForFragmentId = null;
      }
      return;
    }

    /*
     * Only apply the optimistic lock if we are still looking at the same fragment.
     * If the user navigated away while the RPC was in flight, immediately unlock it.
     */
    if (this.fragment?.id === fragmentId) {
      this.markFragmentLockedByMe();
      this.updateEditorReadOnlyState();
    } else {
      await this.fragmentLockService.unlockFragment(
        fragmentId,
        'body edit lock completed after fragment switch'
      );
    }
  }

  private async unlockCurrentFragment(reason: string): Promise<void> {
    if (!this.fragment) {
      return;
    }

    if (!this.isLockedByMe) {
      return;
    }

    const fragmentId = this.fragment.id;

    console.log(`TextPanelComponent.${reason}: unlockFragment$, id=${fragmentId}`);

    const unlocked = await this.fragmentLockService.unlockFragment(fragmentId, reason);

    /*
     * Only update local state if we are still looking at the same fragment.
     * The async unlock could complete after the user has navigated away.
     */
    if (unlocked && this.fragment?.id === fragmentId) {
      this.markFragmentUnlocked();
    }
  }

  async unlockFragment(fragmentId: number, reason = 'unlock'): Promise<boolean> {
    try {
      console.log(`FragmentLockService: unlocking fragment ${fragmentId}: ${reason}`);

      await firstValueFrom(
        this.rpcService.unlockFragment$(fragmentId).pipe(take(1))
      );

      console.log(`FragmentLockService: unlocked fragment ${fragmentId}: ${reason}`);
      return true;

    } catch (err: unknown) {
      /*
       * If the fragment has just been deleted, there is no lock left to release.
       * Treat this as a successful no-op rather than warning.
       */
      if (
        err instanceof RpcError &&
        err.status === HttpStatusCode.InternalServerError &&
        String(err.message ?? '').includes('Fragment not found')
      ) {
        console.info(
          `FragmentLockService: fragment ${fragmentId} no longer exists; unlock ignored: ${reason}`
        );
        return true;
      }

      console.warn(
        `FragmentLockService: failed to unlock fragment ${fragmentId}: ${reason}`,
        err
      );

      return false;
    }
  }

  /**
   * Returns a real Date if year/month/day are set (>0),
   * otherwise null if they’re still at the 0/0/0 default.
   */
  private markFragmentLockedByMe(): void {
    if (!this.fragment) return;

    const myUserId = this.myUserId;
    const mySessionId = this.mySessionId;

    if (myUserId == null || mySessionId == null) {
      console.warn('TextPanelComponent.markFragmentLockedByMe: missing user/session');
      return;
    }

    const prevLock = this.fragment.lock ?? {};

    this.fragment = {
      ...this.fragment,
      lock: {
        ...prevLock,
        lockUserId: myUserId,
        lockSessionId: mySessionId,
        lockUserName: this.accessTokenService.username ?? null,
        lockKnownAs: this.accessTokenService.knownAs ?? null,
        lockTimeStamp: Date.now(),
      }
    };

    this.currentFragment = this.fragment;
    this.updateEditorReadOnlyState();
  }

  private markFragmentUnlocked(): void {
    if (!this.fragment) return;

    this.fragment = {
      ...this.fragment,
      lock: null
    } as any;

    this.currentFragment = this.fragment;
    this.lockRequestedForFragmentId = null;
    this.updateEditorReadOnlyState();
  }

  private isLockedByMeFragment(f: Fragment): boolean {
    const lock = f.lock;

    return this.isLockActive(lock)
      && this.myUserId != null
      && this.mySessionId != null
      && lock!.lockUserId === this.myUserId
      && lock!.lockSessionId === this.mySessionId;
  }

  private isLockActive(lock: EditLockInfo | null | undefined): boolean {
    return !!lock
      && lock.lockUserId != null
      && lock.lockSessionId != null
      && lock.lockSessionId.trim() !== '';
  }
}
