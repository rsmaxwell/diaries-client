import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { MqttService } from './mqtt.service';
import { ConfigService } from './config.service';
import { DiaryService } from './diary.service';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { PageService } from './page.service';


function initializeMqttService(mqttService: MqttService) {
  return () => mqttService.initializeAsync();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideRouter(routes),
    ConfigService,
    MqttService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeMqttService,
      deps: [    MqttService,
      ],
      multi: true,
    }, provideAnimationsAsync(),
    DiaryService,
    PageService, provideAnimationsAsync(),
  ]
};


