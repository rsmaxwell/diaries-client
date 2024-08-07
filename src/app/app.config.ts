import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { MqttModule } from 'ngx-mqtt';
import { MQTT_SERVICE_OPTIONS } from './mqtt-options';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes),
             ...(MqttModule.forRoot(MQTT_SERVICE_OPTIONS).providers || [])
             ]
};
