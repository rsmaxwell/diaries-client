import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import { BuildInfo } from '../model/build-info';

@Injectable({ providedIn: 'root' })
export class ClientBuildInfoService {
  private readonly http = inject(HttpClient);

  private readonly buildInfo$ = this.http
    .get<BuildInfo>('assets/build-info.json')
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  getBuildInfo(): Observable<BuildInfo> {
    return this.buildInfo$;
  }
}
