import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { AlertService } from '../alerts/alert.service';
import { FragmentLockService } from '../fragment/fragment-lock.service';
import { Fragment } from '../model/fragment';
import { ModelContext } from '../model/model-context';
import { RpcService } from '../mqtt/rpc.service';
import { DayviewComponent } from './dayview.component';

describe('DayviewComponent drag-and-drop', () => {
  let component: DayviewComponent;
  let rpcService: jasmine.SpyObj<RpcService>;
  let fragmentLockService: jasmine.SpyObj<FragmentLockService>;
  let alertService: jasmine.SpyObj<AlertService>;

  beforeEach(() => {
    rpcService = jasmine.createSpyObj<RpcService>('RpcService', [
      'updateFragment$',
      'normaliseFragments$'
    ]);
    fragmentLockService = jasmine.createSpyObj<FragmentLockService>('FragmentLockService', [
      'lockFragmentForEdit',
      'unlockFragmentAfterFailedEdit'
    ]);
    alertService = jasmine.createSpyObj<AlertService>('AlertService', ['error']);

    const modelContext = {
      selectFragmentsForDate$: new BehaviorSubject<Fragment[]>([])
    } as unknown as ModelContext;
    const router = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/day' });

    component = new DayviewComponent(
      rpcService,
      modelContext,
      alertService,
      router,
      fragmentLockService
    );
  });

  it('locks the fragment and sends a cloned temporary sequence when moving bottom to top', async () => {
    const fragments = [fragment(1, 1), fragment(2, 2), fragment(3, 3)];
    component.dataSource.data = fragments;
    fragmentLockService.lockFragmentForEdit.and.resolveTo(true);
    rpcService.updateFragment$.and.returnValue(of(3));

    await component.drop(dropEvent(2, 0));

    expect(fragmentLockService.lockFragmentForEdit).toHaveBeenCalledOnceWith(3);
    expect(rpcService.updateFragment$).toHaveBeenCalledTimes(1);

    const update = rpcService.updateFragment$.calls.mostRecent().args[0];
    expect(update).not.toBe(fragments[2]);
    expect(update.sequence).toBe(-999);
    expect(fragments[2].sequence).toBe(3);
    expect(component.dataSource.data.map(item => item.id)).toEqual([3, 1, 2]);
    expect(component.dataSource.data.map(item => item.sequence)).toEqual([1, 2, 3]);
    expect(rpcService.normaliseFragments$).not.toHaveBeenCalled();
    expect(fragmentLockService.unlockFragmentAfterFailedEdit).not.toHaveBeenCalled();
    expect(component.reorderInFlight).toBeFalse();
  });

  it('keeps the original order when the fragment cannot be locked', async () => {
    const fragments = [fragment(1, 1), fragment(2, 2), fragment(3, 3)];
    component.dataSource.data = fragments;
    fragmentLockService.lockFragmentForEdit.and.resolveTo(false);

    await component.drop(dropEvent(2, 0));

    expect(rpcService.updateFragment$).not.toHaveBeenCalled();
    expect(component.dataSource.data).toEqual(fragments);
    expect(component.dataSource.data.map(item => item.sequence)).toEqual([1, 2, 3]);
    expect(fragmentLockService.unlockFragmentAfterFailedEdit).not.toHaveBeenCalled();
    expect(component.reorderInFlight).toBeFalse();
  });

  it('restores the original order and unlocks after an update failure', async () => {
    const fragments = [fragment(1, 1), fragment(2, 2), fragment(3, 3)];
    const error = new Error('update failed');
    component.dataSource.data = fragments;
    fragmentLockService.lockFragmentForEdit.and.resolveTo(true);
    fragmentLockService.unlockFragmentAfterFailedEdit.and.resolveTo();
    rpcService.updateFragment$.and.returnValue(throwError(() => error));

    await component.drop(dropEvent(2, 0));

    expect(fragmentLockService.unlockFragmentAfterFailedEdit).toHaveBeenCalledOnceWith(3);
    expect(component.dataSource.data).toEqual(fragments);
    expect(component.dataSource.data.map(item => item.sequence)).toEqual([1, 2, 3]);
    expect(alertService.error).toHaveBeenCalledTimes(1);
    expect(alertService.error.calls.mostRecent().args[0] as unknown).toBe(error);
    expect(component.reorderInFlight).toBeFalse();
  });

  function fragment(id: number, sequence: number): Fragment {
    return {
      id,
      marqueeId: id + 100,
      year: 1830,
      month: 2,
      day: 1,
      sequence,
      version: 0,
      text: `fragment ${id}`,
      lock: null
    };
  }

  function dropEvent(previousIndex: number, currentIndex: number): CdkDragDrop<Fragment[]> {
    return { previousIndex, currentIndex } as CdkDragDrop<Fragment[]>;
  }
});
