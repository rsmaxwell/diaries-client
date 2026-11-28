import { Injectable } from '@angular/core';
import { moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom, take } from 'rxjs';
import { Fragment } from '../model/fragment';
import { RpcService } from '../mqtt/rpc.service';
import { FragmentLockService } from './fragment-lock.service';

export interface FragmentReorderPlan {
  /** Snapshot of the component list, without mutating live model objects. */
  original: Fragment[];
  /** Temporary display order; canonical sequences come from retained MQTT. */
  display: Fragment[];
  /** Changed Fragment sent to updateFragment (contains a neighbour-based sequence). */
  moved: Fragment;
}

/** Shared ordering and lock/RPC/unlock workflow for DATED and annual fragments. */
@Injectable({ providedIn: 'root' })
export class FragmentReorderService {
  constructor(private readonly rpc: RpcService, private readonly locks: FragmentLockService) {}

  plan(fragments: readonly Fragment[], from: number, to: number): FragmentReorderPlan | null {
    if (from === to || from < 0 || to < 0 || from >= fragments.length || to >= fragments.length) return null;
    const original = [...fragments];
    const ordered = [...original];
    moveItemInArray(ordered, from, to);
    const moved = { ...ordered[to] };
    ordered[to] = moved;
    const previous = ordered[to - 1];
    const next = ordered[to + 1];
    moved.sequence = previous && next ? (previous.sequence + next.sequence) / 2
      : previous ? previous.sequence + 1000
      : next ? next.sequence - 1000 : 1;
    return {
      original,
      display: ordered.map((fragment, index) => ({ ...fragment, sequence: index + 1 })),
      moved
    };
  }

  /** Return false for a denied lock; throw RPC errors after best-effort unlock. */
  async persist(plan: FragmentReorderPlan, showOptimistic: (ordered: Fragment[]) => void): Promise<boolean> {
    let acquired = false;
    try {
      acquired = await this.locks.lockFragmentForEdit(plan.moved.id);
      if (!acquired) return false;
      showOptimistic(plan.display);
      await firstValueFrom(this.rpc.updateFragment$(plan.moved).pipe(take(1)));
      // updateFragment releases the lock on success.
      acquired = false;
      return true;
    } finally {
      if (acquired) await this.locks.unlockFragmentAfterFailedEdit(plan.moved.id);
    }
  }
}
