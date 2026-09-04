import { FragmentComponent } from './fragment.component';

describe('FragmentComponent responsive layout', () => {
  function createComponent(): FragmentComponent {
    return new FragmentComponent(
      { snapshot: { paramMap: { get: () => null } } } as any,
      { navigate: jasmine.createSpy('navigate') } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
  }

  it('uses a side-by-side editor on wide viewports', () => {
    const config = (createComponent() as any).createLayoutConfig(false);

    expect(config.root.type).toBe('row');
    expect(config.root.content[0].componentType).toBe('ImageViewer');
    expect(config.root.content[1].type).toBe('stack');
  });

  it('stacks the source page above the editor on narrow viewports', () => {
    const config = (createComponent() as any).createLayoutConfig(true);

    expect(config.root.type).toBe('column');
    expect(config.root.content[0].height).toBe(45);
    expect(config.root.content[1].height).toBe(55);
  });
});
