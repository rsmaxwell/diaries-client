import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  function createComponent(): RegisterComponent {
    return new RegisterComponent(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { clear: jasmine.createSpy('clear') } as any
    );
  }

  it('starts with an invalid registration form', () => {
    expect(createComponent().form.valid).toBeFalse();
  });
});
