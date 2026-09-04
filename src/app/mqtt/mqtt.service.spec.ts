import { MqttService } from './mqtt.service';

describe('MqttService', () => {
  it('creates with the runtime configuration service', () => {
    expect(new MqttService({} as any)).toBeTruthy();
  });
});
