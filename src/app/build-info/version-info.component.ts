import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { catchError, combineLatest, map, of, startWith } from 'rxjs';

import { RpcService } from '../mqtt/rpc.service';
import { ClientBuildInfoService } from './client-build-info.service';

interface DisplayVersions {
  client: string;
  responder: string;
}

@Component({
  selector: 'app-version-info',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './version-info.component.html',
  styleUrl: './version-info.component.scss'
})
export class VersionInfoComponent {
  readonly versions$ = combineLatest({
    client: this.clientBuildInfoService.getBuildInfo().pipe(
      map(info => info.version),
      catchError(error => {
        console.warn('Unable to load client build information', error);
        return of('unknown');
      })
    ),
    responder: this.rpcService.getResponderVersion$().pipe(
      map(info => info.version),
      catchError(error => {
        console.warn('Unable to load responder build information', error);
        return of('unavailable');
      }),
      startWith('connecting')
    )
  }).pipe(map(versions => versions as DisplayVersions));

  constructor(
    private clientBuildInfoService: ClientBuildInfoService,
    private rpcService: RpcService
  ) {}
}
