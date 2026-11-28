import { of, throwError } from 'rxjs';
import { Fragment } from '../model/fragment';
import { FragmentReorderService } from './fragment-reorder.service';

describe('FragmentReorderService', () => {
  const fragment = (id: number, sequence: number, annual = false): Fragment => ({
    id, version: 1, sequence, text: `<p>${id}</p>`, year: 1830,
    month: annual ? null : 1, day: annual ? null : 2,
    placement: annual ? 'EPILOGUE' : 'DATED',
    diaryId: annual ? null : 1, pageId: annual ? null : 10,
    type: 'TEXT'
  } as Fragment);

  function fixture() {
    const rpc = { updateFragment$: jasmine.createSpy('updateFragment$').and.returnValue(of(1)) };
    const locks = {
      lockFragmentForEdit: jasmine.createSpy('lockFragmentForEdit').and.resolveTo(true),
      unlockFragmentAfterFailedEdit: jasmine.createSpy('unlockFragmentAfterFailedEdit').and.resolveTo()
    };
    return { service: new FragmentReorderService(rpc as any, locks as any), rpc, locks };
  }

  for (const annual of [false, true]) {
    it(`reorders ${annual ? 'annual' : 'DATED'} fragments without mutating live objects`, async () => {
      const { service, rpc, locks } = fixture();
      const original = [fragment(11, 1, annual), fragment(12, 2, annual), fragment(13, 3, annual)];
      const plan = service.plan(original, 0, 2)!;
      expect(plan.display.map(f => f.id)).toEqual([12, 13, 11]);
      expect(plan.display.map(f => f.sequence)).toEqual([1, 2, 3]);
      expect(plan.moved.sequence).toBe(1003);
      expect(original.map(f => f.sequence)).toEqual([1, 2, 3]);
      const rendered: Fragment[][] = [];
      expect(await service.persist(plan, rows => rendered.push(rows))).toBeTrue();
      expect(rendered[0]).toBe(plan.display);
      expect(rpc.updateFragment$).toHaveBeenCalledOnceWith(plan.moved);
      expect(locks.lockFragmentForEdit).toHaveBeenCalledOnceWith(11);
      expect(locks.unlockFragmentAfterFailedEdit).not.toHaveBeenCalled();
      if (annual) {
        expect(plan.moved.month).toBeNull();
      } else {
        expect(plan.moved.month).toBe(1);
      }
      expect(plan.moved.placement).toBe(annual ? 'EPILOGUE' : 'DATED');
    });
  }

  it('computes midpoint, prepend and single-item boundaries', () => {
    const { service } = fixture();
    const list = [fragment(1, 1), fragment(2, 2), fragment(3, 3)];
    expect(service.plan(list, 2, 1)!.moved.sequence).toBe(1.5);
    expect(service.plan(list, 2, 0)!.moved.sequence).toBe(-999);
    expect(service.plan(list, 0, 2)!.moved.sequence).toBe(1003);
    expect(service.plan(list, 0, 0)).toBeNull();
    expect(service.plan(list, -1, 0)).toBeNull();
    expect(service.plan(list, 0, 3)).toBeNull();
  });

  it('does not mutate the list or call RPC if lock is denied', async () => {
    const { service, rpc, locks } = fixture();
    locks.lockFragmentForEdit.and.resolveTo(false);
    const plan = service.plan([fragment(1, 1), fragment(2, 2)], 0, 1)!;
    const display = jasmine.createSpy('display');
    expect(await service.persist(plan, display)).toBeFalse();
    expect(display).not.toHaveBeenCalled();
    expect(rpc.updateFragment$).not.toHaveBeenCalled();
    expect(locks.unlockFragmentAfterFailedEdit).not.toHaveBeenCalled();
  });

  it('unlocks and propagates failure for component-specific rollback and alert', async () => {
    const { service, rpc, locks } = fixture();
    const failure = new Error('RPC failed');
    rpc.updateFragment$.and.returnValue(throwError(() => failure));
    const plan = service.plan([fragment(1, 1), fragment(2, 2)], 0, 1)!;
    const display = jasmine.createSpy('display');
    await expectAsync(service.persist(plan, display)).toBeRejectedWith(failure);
    expect(display).toHaveBeenCalledOnceWith(plan.display);
    expect(locks.unlockFragmentAfterFailedEdit).toHaveBeenCalledOnceWith(1);
  });
});
