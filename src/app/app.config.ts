import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MqttService } from './mqtt/mqtt.service';


function initializeMqttService(mqttService: MqttService) {
  return () => mqttService.initialise();
}


export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideRouter(routes),
    MqttService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeMqttService,
      deps: [    MqttService,
      ],
      multi: true,
    }, provideAnimationsAsync()
  ]
};


