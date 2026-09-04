import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('creates with its session collaborators', () => {
    const component = new AppComponent(
      { getCurrentToken: () => null } as any,
      { getCurrentToken: () => null } as any,
      {} as any
    );

    expect(component).toBeTruthy();
  });
});
