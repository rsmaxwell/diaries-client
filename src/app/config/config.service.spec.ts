import { ConfigService } from './config.service';

describe('ConfigService', () => {
  it('creates with an HTTP client', () => {
    expect(new ConfigService({} as any)).toBeTruthy();
  });
});
