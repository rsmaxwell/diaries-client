import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { ConfigService } from './config/config.service';
import { MqttService } from './mqtt/mqtt.service';
import { DiariesService } from './diaries/diaries.service';
import { PageService } from './page/page.service';
import { MqttRegisterService } from './user/mqtt.register.service';
import { MqttSigninService } from './user/mqtt.signin.service';
import { AuthGuard } from './auth.guard';


function initializeMqttService(mqttService: MqttService) {
  return () => mqttService.initialise();
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
    MqttRegisterService,
    MqttSigninService,
    DiariesService,
    PageService,
    AuthGuard
  ]
};


