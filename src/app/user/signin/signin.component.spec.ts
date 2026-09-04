import { SigninComponent } from './signin.component';

describe('SigninComponent', () => {
  function createComponent(): SigninComponent {
    return new SigninComponent(
      {} as any,
      { snapshot: { queryParams: {} } } as any,
      {} as any,
      { userId: null, username: null, knownAs: null } as any,
      {} as any,
      {} as any,
      { clear: jasmine.createSpy('clear') } as any
    );
  }

  it('requires both sign-in fields', () => {
    const component = createComponent();

    expect(component.form.valid).toBeFalse();
    component.form.setValue({ username: 'reader', password: 'secret' });
    expect(component.form.valid).toBeTrue();
  });
});
