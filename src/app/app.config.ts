import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient } from '@angular/common/http';
import { MqttService } from './mqtt.service';
import { ConfigService } from './config.service';
import { Observable } from 'rxjs';
import { DiaryService } from './diary.service';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';


function initializeDiaryService(diaryService: DiaryService) {
  return () => diaryService.initializeAsync();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideRouter(routes),
    ConfigService,
    MqttService,
    DiaryService,
    {
      provide: APP_INITIALIZER,
      useFactory: initializeDiaryService,
      deps: [    DiaryService,
      ],
      multi: true,
    }, provideAnimationsAsync(),
  ]
};


