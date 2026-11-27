import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { AnnualQuillPreviewDirective } from './annual-quill-preview.directive';
import { Page } from '../../model/page';
import Quill from 'quill';
import { TEXT_EDITOR_MODULES, blockInlineImageInsertion } from '../../fragment/quill-text-toolbar';
import { firstValueFrom, from, Subject, switchMap, take, takeUntil } from 'rxjs';
import { AnnualPlacement, annualTopicFilter, orderedAnnualFragments } from '../../model/annual-fragments';
import { AddAnnualFragmentRequest } from '../../model/annual-fragment-request';
import { ContentFragmentType, Fragment, ImageFragment } from '../../model/fragment';
import { MqttService } from '../../mqtt/mqtt.service';
import { LiveObjectListService } from '../../mqtt/live.object.list.service';
import { RpcService } from '../../mqtt/rpc.service';
import { FragmentLockService } from '../../fragment/fragment-lock.service';
import { AlertService } from '../../alerts/alert.service';

/** Year-owned editorial material; deliberately distinct from Page/Marquee editing. */
@Component({
  selector: 'app-annual-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, QuillModule, AnnualQuillPreviewDirective],
  templateUrl: './annual-editor.component.html',
  styleUrls: ['./annual-editor.component.scss']
})
export class AnnualEditorComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) diaryId!: number;
  @Input() diaryName = '';
  @Input() pages: Page[] = [];
  private datedFragments: Fragment[] = [];
  private yearManuallySelected = false;
  private datedSubscription = new Subject<void>();
  year = new Date().getFullYear();
  placement: AnnualPlacement = 'PREAMBLE';
  fragments: Fragment[] = [];
  newType: ContentFragmentType = 'TEXT';
  newText = '';
  newImageId: number | null = null;
  newImageLinkUrl = '';
  editingId: number | null = null;
  editText = '';
  editImageLinkUrl = '';
  readonly editorModules = TEXT_EDITOR_MODULES;
  private imageInsertionGuards = new Map<HTMLElement, () => void>();
  readonly maxHtmlLength = 4096;
  private editQuill: Quill | null = null;
  private originalEditHtml = '';
  private pendingGroupRefresh = false;
  private leaving = false;
  busy = false;
  private activeSubscription = new Subject<void>();
  private destroyed = new Subject<void>();

  constructor(
    private mqtt: MqttService,
    private liveLists: LiveObjectListService,
    private rpc: RpcService,
    private locks: FragmentLockService,
    private alerts: AlertService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['diaryId']) {
      this.yearManuallySelected = false;
      this.datedFragments = [];
      this.year = new Date().getFullYear();
      this.subscribeToDatedFragments();
      void this.requestGroupRefresh();
    } else if (changes['pages']) {
      this.initialiseYearFromDated();
    }
  }

  changeYear(): void {
    this.yearManuallySelected = true;
    this.changeGroup();
  }

  changeGroup(): void {
    if (this.busy || this.editingId !== null) return;
    void this.requestGroupRefresh();
  }

  /** A diary switch can arrive through @Input even while the editor is locked. */
  private async requestGroupRefresh(): Promise<void> {
    if (this.leaving) return;
    if (this.busy) {
      this.pendingGroupRefresh = true;
      return;
    }
    this.pendingGroupRefresh = false;
    if (this.editingId !== null) {
      await this.cancel();
      if (this.editingId !== null || this.leaving) {
        // Failed unlock: keep editor and its buffer for explicit retry.
        return;
      }
    }
    if (!this.leaving) this.subscribeToGroup();
  }

  private finishOperation(): void {
    this.busy = false;
    if (this.pendingGroupRefresh && !this.leaving) void this.requestGroupRefresh();
  }

  onEditQuillCreated(editor: Quill): void {
    this.editQuill = editor;
    this.onQuillCreated(editor);
  }

  onQuillCreated(editor: Quill): void {
    if (!this.imageInsertionGuards.has(editor.root)) {
      this.imageInsertionGuards.set(editor.root, blockInlineImageInsertion(editor.root, editor));
    }
  }

  /** Compare rich-text operations, not Quill's normalised HTML string. */
  private isTextUnchanged(): boolean {
    if ((this.editText ?? '') === this.originalEditHtml) return true;
    if (!this.editQuill) return false;
    try {
      const original = this.editQuill.clipboard.convert({ html: this.originalEditHtml });
      const edited = this.editQuill.clipboard.convert({ html: this.editText ?? '' });
      return JSON.stringify(original.ops) === JSON.stringify(edited.ops);
    } catch {
      return false;
    }
  }

  private subscribeToDatedFragments(): void {
    this.datedSubscription.next();
    if (!Number.isSafeInteger(this.diaryId) || this.diaryId <= 0) return;
    const diaryId = this.diaryId;
    from(this.mqtt.getConnection()).pipe(
      switchMap(client => this.liveLists.subscribeToTopicTree$<Fragment>(
        client, ['diaries/fragments/+'], buf => JSON.parse(buf.toString()) as Fragment
      )),
      takeUntil(this.datedSubscription),
      takeUntil(this.destroyed)
    ).subscribe({
      next: items => {
        if (this.diaryId !== diaryId) return;
        this.datedFragments = items;
        this.initialiseYearFromDated();
      },
      error: err => this.alerts.error(err instanceof Error ? err.message : String(err))
    });
  }

  private initialiseYearFromDated(): void {
    if (this.yearManuallySelected || this.editingId !== null || this.busy) return;
    const pageIds = new Set(this.pages.filter(p => p.diaryId === this.diaryId).map(p => p.id));
    const dates = this.datedFragments.filter(f =>
      (f.placement === 'DATED' || !f.placement) &&
      f.pageId != null && pageIds.has(f.pageId) &&
      Number.isInteger(f.year) && f.year >= 1 && f.year <= 9999
    );
    if (!dates.length) return;
    const year = Math.min(...dates.map(f => f.year));
    if (year !== this.year) {
      this.year = year;
      void this.requestGroupRefresh();
    }
  }

  private subscribeToGroup(): void {
    this.activeSubscription.next();
    this.fragments = [];
    if (!Number.isSafeInteger(this.diaryId) || this.diaryId <= 0 ||
        !Number.isSafeInteger(this.year) || this.year < 1 || this.year > 9999) return;
    const filter = annualTopicFilter(this.diaryId, this.year, this.placement);
    from(this.mqtt.getConnection()).pipe(
      switchMap(client => this.liveLists.subscribeToTopicTree$<Fragment>(
        client, [filter], buf => JSON.parse(buf.toString()) as Fragment
      )),
      takeUntil(this.activeSubscription),
      takeUntil(this.destroyed)
    ).subscribe({
      next: items => this.fragments = orderedAnnualFragments(items, this.diaryId, this.year, this.placement),
      error: err => this.alerts.error(err instanceof Error ? err.message : String(err))
    });
  }

  async add(): Promise<void> {
    if (this.busy || this.editingId !== null) return;
    this.busy = true;
    try {
      const last = this.fragments[this.fragments.length - 1];
      const request = new AddAnnualFragmentRequest({
        diaryId: this.diaryId, year: this.year, placement: this.placement,
        type: this.newType, sequence: last ? last.sequence + 1 : 1,
        text: this.newType === 'IMAGE' ? '' : (this.newText ?? ''),
        ...(this.newType === 'IMAGE' ? {
          imageId: this.newImageId ?? undefined,
          imageLinkUrl: this.newImageLinkUrl || undefined
        } : {})
      });
      await firstValueFrom(this.rpc.addAnnualFragment$(request).pipe(take(1)));
      this.newText = '';
      this.newImageId = null;
      this.newImageLinkUrl = '';
    } catch (err) { this.alerts.error(err instanceof Error ? err.message : String(err)); }
    finally { this.finishOperation(); }
  }

  async beginEdit(fragment: Fragment): Promise<void> {
    if (this.busy || this.editingId !== null) return;
    this.busy = true;
    try {
      if (await this.locks.lockFragmentForEdit(fragment.id)) {
        if (this.leaving) {
          if (!await this.locks.unlockFragment(fragment.id, 'editor destroyed during lock'))
            this.alerts.error('Unable to release annual Fragment lock on navigation');
          return;
        }
        this.editingId = fragment.id;
        this.originalEditHtml = fragment.text ?? '';
        this.editText = this.originalEditHtml;
        this.editQuill = null;
        this.editImageLinkUrl = fragment.imageLinkUrl ?? '';
      }
    } finally { this.finishOperation(); }
  }

  async save(fragment: Fragment): Promise<void> {
    if (this.busy || this.editingId !== fragment.id) return;
    this.busy = true;
    try {
      if (fragment.type === 'IMAGE') {
        const requestedLink = this.editImageLinkUrl.trim();
        const existingLink = fragment.imageLinkUrl ?? '';
        if (requestedLink === existingLink) {
          if (!await this.locks.unlockFragment(fragment.id, 'annual image link unchanged'))
            throw new Error('Unable to release annual Fragment lock');
        } else {
          const intent: { set: string } | { clear: true } = requestedLink
            ? { set: requestedLink } : { clear: true };
          await firstValueFrom(this.rpc.updateImageLink$(fragment as ImageFragment, intent).pipe(take(1)));
        }
      } else {
        if ((this.editText ?? '').length > this.maxHtmlLength)
          throw new Error(`Text exceeds ${this.maxHtmlLength} characters (HTML)`);
        if (!this.isTextUnchanged()) {
          await firstValueFrom(this.rpc.updateFragment$({ ...fragment, text: this.editText ?? '' }).pipe(take(1)));
        } else if (!await this.locks.unlockFragment(fragment.id, 'annual edit unchanged')) {
          throw new Error('Unable to release annual Fragment lock');
        }
      }
      this.editingId = null;
      this.editQuill = null;
    } catch (err) {
      this.alerts.error(err instanceof Error ? err.message : String(err));
      // Keep the buffer for retry while mounted; a destroyed editor must release its lock.
      if (this.leaving && this.editingId !== null) {
        if (await this.locks.unlockFragment(this.editingId, 'failed annual save after navigation'))
          this.editingId = null;
        else this.alerts.error('Unable to release annual Fragment lock on navigation');
      }
    } finally { this.finishOperation(); }
  }

  async cancel(): Promise<void> {
    if (this.busy || this.editingId === null) return;
    this.busy = true;
    try {
      if (await this.locks.unlockFragment(this.editingId, 'cancel annual edit')) {
        this.editingId = null;
        this.editQuill = null;
      }
      else this.alerts.error('Unable to release annual Fragment lock');
    } finally { this.finishOperation(); }
  }

  async delete(fragment: Fragment): Promise<void> {
    if (this.busy || this.editingId !== null || !confirm(`Delete annual Fragment ${fragment.id}?`)) return;
    this.busy = true;
    let acquired = false;
    try {
      acquired = await this.locks.lockFragmentForEdit(fragment.id);
      if (!acquired) return;
      await firstValueFrom(this.rpc.deleteFragment$(fragment.id).pipe(take(1)));
      acquired = false;
    } catch (err) { this.alerts.error(err instanceof Error ? err.message : String(err)); }
    finally {
      if (acquired) await this.locks.unlockFragmentAfterFailedEdit(fragment.id);
      this.finishOperation();
    }
  }

  async move(fragment: Fragment, direction: -1 | 1): Promise<void> {
    if (this.busy || this.editingId !== null) return;
    const index = this.fragments.findIndex(f => f.id === fragment.id);
    const neighbour = this.fragments[index + direction];
    if (index < 0 || !neighbour) return;
    const before = this.fragments[index - 1];
    const after = this.fragments[index + 1];
    const destinationSequence = direction === -1
      ? (index > 1 ? (before.sequence + this.fragments[index - 2].sequence) / 2 : neighbour.sequence - 1)
      : (index + 2 < this.fragments.length ? (after.sequence + this.fragments[index + 2].sequence) / 2 : neighbour.sequence + 1);
    this.busy = true;
    let acquired = false;
    try {
      acquired = await this.locks.lockFragmentForEdit(fragment.id);
      if (!acquired) return;
      await firstValueFrom(this.rpc.updateFragment$({ ...fragment, sequence: destinationSequence }).pipe(take(1)));
      acquired = false;
    } catch (err) { this.alerts.error(err instanceof Error ? err.message : String(err)); }
    finally {
      if (acquired) await this.locks.unlockFragmentAfterFailedEdit(fragment.id);
      this.finishOperation();
    }
  }

  ngOnDestroy(): void {
    for (const stop of this.imageInsertionGuards.values()) stop();
    this.imageInsertionGuards.clear();
    this.leaving = true;
    this.activeSubscription.next();
    this.activeSubscription.complete();
    this.datedSubscription.next();
    this.datedSubscription.complete();
    this.destroyed.next();
    this.destroyed.complete();
    if (this.editingId !== null && !this.busy) {
      // Best effort on navigation; never race a save RPC with an unlock.
      void this.locks.unlockFragment(this.editingId, 'leave annual editor').then(unlocked => {
        if (!unlocked) this.alerts.error('Unable to release annual Fragment lock on navigation');
      });
    }
  }
}
