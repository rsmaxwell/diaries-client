import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { firstValueFrom, from, of, Subject, switchMap, take, takeUntil } from 'rxjs';
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
  imports: [CommonModule, FormsModule, QuillModule],
  templateUrl: './annual-editor.component.html'
})
export class AnnualEditorComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) diaryId!: number;
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
  /** Shared formatting subset with the transcription editor; image metadata stays in the catalogue. */
  readonly editorModules = { toolbar: [
    ['bold', 'italic', 'underline'],
    [{ header: [1, 2, 3, false] }],
    [{ list: 'bullet' }, { list: 'ordered' }],
    ['link']
  ] };
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
    if (changes['diaryId']) this.subscribeToGroup();
  }

  changeGroup(): void {
    if (this.busy || this.editingId !== null) return;
    this.subscribeToGroup();
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
    finally { this.busy = false; }
  }

  async beginEdit(fragment: Fragment): Promise<void> {
    if (this.busy || this.editingId !== null) return;
    this.busy = true;
    try {
      if (await this.locks.lockFragmentForEdit(fragment.id)) {
        this.editingId = fragment.id;
        this.editText = fragment.text;
        this.editImageLinkUrl = fragment.imageLinkUrl ?? '';
      }
    } finally { this.busy = false; }
  }

  async save(fragment: Fragment): Promise<void> {
    if (this.busy || this.editingId !== fragment.id) return;
    this.busy = true;
    try {
      if (fragment.type === 'IMAGE') {
        const requestedLink = this.editImageLinkUrl.trim();
        const existingLink = fragment.imageLinkUrl ?? '';
        if (requestedLink === existingLink) {
          await this.locks.unlockFragment(fragment.id, 'annual image link unchanged');
        } else {
          const intent: { set: string } | { clear: true } = requestedLink
            ? { set: requestedLink } : { clear: true };
          await firstValueFrom(this.rpc.updateImageLink$(fragment as ImageFragment, intent).pipe(take(1)));
        }
      } else {
        if ((this.editText ?? '').length > 4096) throw new Error('Text exceeds 4096 characters');
        if (this.editText !== fragment.text) {
          await firstValueFrom(this.rpc.updateFragment$({ ...fragment, text: this.editText }).pipe(take(1)));
        } else {
          await this.locks.unlockFragment(fragment.id, 'annual edit unchanged');
        }
      }
      this.editingId = null;
    } catch (err) {
      this.alerts.error(err instanceof Error ? err.message : String(err));
      // Retain editing state and lock on failure to permit retry/cancel.
    } finally { this.busy = false; }
  }

  async cancel(): Promise<void> {
    if (this.busy || this.editingId === null) return;
    this.busy = true;
    try {
      if (await this.locks.unlockFragment(this.editingId, 'cancel annual edit')) this.editingId = null;
      else this.alerts.error('Unable to release annual Fragment lock');
    } finally { this.busy = false; }
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
      this.busy = false;
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
      this.busy = false;
    }
  }

  ngOnDestroy(): void {
    this.activeSubscription.next();
    this.activeSubscription.complete();
    this.destroyed.next();
    this.destroyed.complete();
    if (this.editingId !== null) {
      // Best effort on navigation. Do not silently leave a held edit lock.
      this.locks.unlockFragment(this.editingId, 'leave annual editor');
    }
  }
}
