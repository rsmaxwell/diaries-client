import { of, Subject, throwError } from 'rxjs';
import { Fragment } from '../../model/fragment';
import { AnnualEditorComponent } from './annual-editor.component';
import { TEXT_EDITOR_MODULES } from '../../fragment/quill-text-toolbar';

describe('AnnualEditorComponent (0054)', () => {
  it('uses the shared DATED toolbar without inline images', () => {
    const { component } = fixture();
    expect(component.editorModules).toBe(TEXT_EDITOR_MODULES);
  });
  const fragment = (overrides: Partial<Fragment> = {}): Fragment => ({
    id: 54, diaryId: 1, year: 1830, placement: 'PREAMBLE',
    type: 'TEXT', text: '<p>Original</p>', sequence: 1, version: 2,
    ...overrides
  } as Fragment);

  function fixture() {
    const mqtt = { getConnection: jasmine.createSpy('getConnection').and.resolveTo({}) };
    const lists = { subscribeToTopicTree$: jasmine.createSpy('subscribeToTopicTree$').and.returnValue(of([])) };
    const rpc = {
      updateFragment$: jasmine.createSpy('updateFragment$').and.returnValue(of(fragment())),
      updateImageLink$: jasmine.createSpy('updateImageLink$').and.returnValue(of(fragment())),
      addAnnualFragment$: jasmine.createSpy('addAnnualFragment$').and.returnValue(of(fragment())),
      deleteFragment$: jasmine.createSpy('deleteFragment$').and.returnValue(of({}))
    };
    const locks = {
      lockFragmentForEdit: jasmine.createSpy('lockFragmentForEdit').and.resolveTo(true),
      unlockFragment: jasmine.createSpy('unlockFragment').and.resolveTo(true),
      unlockFragmentAfterFailedEdit: jasmine.createSpy('unlockFragmentAfterFailedEdit').and.resolveTo()
    };
    const alerts = { error: jasmine.createSpy('error') };
    const component = new AnnualEditorComponent(mqtt as any, lists as any, rpc as any, locks as any, alerts as any);
    component.diaryId = 1;
    component.year = 1830;
    return { component, mqtt, lists, rpc, locks, alerts };
  }

  for (const placement of ['PREAMBLE', 'POSTAMBLE'] as const) {
    it(`creates ${placement} rich HTML using the annual RPC`, async () => {
      const { component, rpc } = fixture();
      component.placement = placement;
      component.newText = '<p><strong>Hello</strong> <span style="color: rgb(200, 0, 0)">world</span></p>';
      await component.add();
      expect(rpc.addAnnualFragment$).toHaveBeenCalled();
      const request = rpc.addAnnualFragment$.calls.mostRecent().args[0];
      expect(request.placement).toBe(placement);
      expect(request.text).toContain('color:');
      expect(component.newText).toBe('');
    });

    it(`does not rewrite unchanged ${placement} HTML`, async () => {
      const { component, rpc, locks } = fixture();
      component.placement = placement;
      const item = fragment({ placement });
      await component.beginEdit(item);
      component.editText = '<p><span>Original</span></p>';
      component.onEditQuillCreated({
        root: document.createElement('div'),
        on: jasmine.createSpy('on'),
        off: jasmine.createSpy('off'),
        clipboard: { convert: ({ html }: { html: string }) => ({
          ops: [{ insert: html.replace(/<[^>]+>/g, '') + '\n' }]
        }) }
      } as any);
      await component.save(item);
      expect(rpc.updateFragment$).not.toHaveBeenCalled();
      expect(locks.unlockFragment).toHaveBeenCalledOnceWith(item.id, 'annual edit unchanged');
      expect(component.editingId).toBeNull();
    });
  }

  it('keeps original HTML when an edit is cancelled', async () => {
    const { component, rpc, locks } = fixture();
    await component.beginEdit(fragment());
    component.editText = '<p>Unwanted change</p>';
    await component.cancel();
    expect(rpc.updateFragment$).not.toHaveBeenCalled();
    expect(locks.unlockFragment).toHaveBeenCalledOnceWith(54, 'cancel annual edit');
  });

  it('retains lock and content after failed save, allowing retry', async () => {
    const { component, rpc, alerts } = fixture();
    const item = fragment();
    await component.beginEdit(item);
    component.editText = '<p>Edited</p>';
    rpc.updateFragment$.and.returnValue(throwError(() => new Error('RPC unavailable')));
    await component.save(item);
    expect(component.editingId).toBe(54);
    expect(component.editText).toBe('<p>Edited</p>');
    expect(alerts.error).toHaveBeenCalled();
    rpc.updateFragment$.and.returnValue(of(item));
    await component.save(item);
    expect(component.editingId).toBeNull();
  });

  it('keeps the edit open when unlock fails', async () => {
    const { component, locks, alerts } = fixture();
    const item = fragment();
    await component.beginEdit(item);
    locks.unlockFragment.and.resolveTo(false);
    await component.cancel();
    expect(component.editingId).toBe(item.id);
    expect(alerts.error).toHaveBeenCalled();
  });

  it('initialises from earliest DATED fragment belonging to the selected diary', () => {
    const { component } = fixture();
    component.pages = [{ id: 7, diaryId: 1 }, { id: 9, diaryId: 2 }] as any;
    (component as any).datedFragments = [
      fragment({ pageId: 7, placement: 'DATED', year: 1830 }),
      fragment({ pageId: 7, placement: 'DATED', year: 1828 }),
      fragment({ pageId: 9, placement: 'DATED', year: 1800 }),
      fragment({ pageId: 7, placement: 'PREAMBLE', year: 1700 })
    ];
    (component as any).initialiseYearFromDated();
    expect(component.year).toBe(1828);
    component.year = 1830;
    component.changeYear();
    (component as any).datedFragments.push(fragment({ pageId: 7, placement: 'DATED', year: 1827 }));
    (component as any).initialiseYearFromDated();
    expect(component.year).toBe(1830);
  });

  it('blocks oversized serialised HTML on both create and edit', async () => {
    const { component, rpc, alerts } = fixture();
    component.newText = '<p>' + 'a'.repeat(4096) + '</p>';
    await component.add();
    expect(rpc.addAnnualFragment$).not.toHaveBeenCalled();
    await component.beginEdit(fragment());
    component.editText = '<p>' + 'x'.repeat(4096) + '</p>';
    await component.save(fragment());
    expect(rpc.updateFragment$).not.toHaveBeenCalled();
    expect(component.editingId).toBe(54);
    expect(alerts.error).toHaveBeenCalled();
  });

  it('does not race a navigation unlock against an in-flight save', async () => {
    const { component, rpc, locks } = fixture();
    const pending = new Subject<Fragment>();
    rpc.updateFragment$.and.returnValue(pending);
    await component.beginEdit(fragment());
    component.editText = '<p>Saving</p>';
    const save = component.save(fragment());
    component.ngOnDestroy();
    expect(locks.unlockFragment).not.toHaveBeenCalled();
    pending.next(fragment()); pending.complete();
    await save;
    expect(component.editingId).toBeNull();
  });

  it('releases a held edit lock before changing diary subscription', async () => {
    const { component, locks } = fixture();
    await component.beginEdit(fragment());
    component.diaryId = 2;
    component.ngOnChanges({ diaryId: { previousValue: 1, currentValue: 2, firstChange: false, isFirstChange: () => false } });
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(locks.unlockFragment).toHaveBeenCalledWith(54, 'cancel annual edit');
    expect(component.editingId).toBeNull();
  });
});
