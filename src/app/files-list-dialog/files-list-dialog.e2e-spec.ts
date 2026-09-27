// Opt-in only: run through 0030 evidence/Step 9/run-integration.ps1.
import { TestBed } from '@angular/core/testing';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { OverlayContainer } from '@angular/cdk/overlay';
import { Router } from '@angular/router';
import { MatIconRegistry } from '@angular/material/icon';
import { BehaviorSubject, firstValueFrom, of } from 'rxjs';
import mqtt from 'mqtt';
import { FilesListDialogComponent } from './files-list-dialog.component';
import { RpcService } from '../mqtt/rpc.service';
import { MqttService } from '../mqtt/mqtt.service';
import { ConfigService } from '../config/config.service';
import { AccessTokenService } from '../user/token/accessTokenService';
import { RefreshTokenService } from '../user/token/refreshTokenService';
import { ReplyHandler } from '../utilities/replyHandler';

describe('0030 real browser/database/MQTT deletion', () => {
  it('verifies cancel, delete, generic protection, uncatalogued rejection and re-upload', async () => {
    const configResponse = await fetch('/0030-step9-fixture.json');
    if (!configResponse.ok) throw new Error('Run with the disposable Step 9 fixture');
    const cfg = await configResponse.json();
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(cfg.baseUrl) || !/^ws:\/\/127\.0\.0\.1:\d+$/.test(cfg.broker)) throw new Error('Expected disposable loopback fixtures');
    await TestBed.configureTestingModule({
      imports: [FilesListDialogComponent],
      providers: [
        RpcService, MqttService,
        { provide: ConfigService, useValue: { getConfig: async () => ({ baseUrl: cfg.baseUrl, brokerUrl: cfg.broker, clientId: 'step9-browser', protocolVersion: 5, clean: true, reconnectPeriod: 0, connectTimeout: 5000 }) } },
        { provide: AccessTokenService, useValue: { getCurrentToken: () => cfg.token } },
        { provide: RefreshTokenService, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: DIALOG_DATA, useValue: { path$: new BehaviorSubject('/step9/images'), select: true } },
        { provide: DialogRef, useValue: { close: () => { throw new Error('Files dialog must stay open'); } } },
        { provide: MatIconRegistry, useValue: { addSvgIcon: () => {}, getNamedSvgIcon: () => of(document.createElementNS('http://www.w3.org/2000/svg', 'svg')) } }
      ]
    }).compileComponents();
    const rpc = TestBed.inject(RpcService);
    const client = await TestBed.inject(MqttService).getConnection();
    const checkpoints: any[] = [];
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    async function snapshot(phase: string) {
      const response = await fetch(cfg.baseUrl + '/state');
      if (!response.ok) throw new Error('State inspection failed');
      const state = await response.json();
      const fresh = await mqtt.connectAsync(cfg.broker, { protocolVersion: 5, reconnectPeriod: 0, connectTimeout: 5000 });
      const retained: Record<string, any> = {};
      try {
        fresh.on('message', (topic, payload) => { if (payload.length) retained[topic] = JSON.parse(payload.toString()); });
        await fresh.subscribeAsync('diaries/images/#', { qos: 1 });
        await delay(250);
      } finally { await fresh.endAsync(); }
      const result = { ...state, retained };
      checkpoints.push({ phase, ...result });
      return result;
    }
    const sample = await (await fetch(cfg.baseUrl + '/files/step9/images/uncatalogued.png')).blob();
    const file = (name: string) => new File([sample], name, { type: 'image/png' });
    const fixture = TestBed.createComponent(FilesListDialogComponent);
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    async function until(check: () => boolean) {
      for (let i = 0; i < 150; i++) { fixture.detectChanges(); if (check()) return; await delay(30); }
      throw new Error('Browser state timed out');
    }
    const card = (name: string) => Array.from(fixture.nativeElement.querySelectorAll('a.file-card') as NodeListOf<HTMLElement>).find(e => e.textContent?.includes(name));
    async function choose(name: string, answer: string) {
      fixture.detectChanges();
      card(name)!.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 30 }));
      await until(() => !!overlay.querySelector('[role="menuitem"]'));
      (overlay.querySelector('[role="menuitem"]') as HTMLElement).click();
      await until(() => !!overlay.querySelector('[role="dialog"]'));
      expect(overlay.textContent).toContain('step9/images/' + name);
      Array.from(overlay.querySelectorAll('button')).find(b => b.textContent?.trim() === answer)!.click();
    }
    try {
      const uploaded: any = await firstValueFrom(rpc.uploadFile$(file('disposable.png'), 'step9/images'));
      const other: any = await firstValueFrom(rpc.uploadFile$(file('protected.png'), 'step9/images'));
      fixture.detectChanges();
      await until(() => !!card('disposable.png'));
      const before = await snapshot('before');
      expect(before.files).toContain('disposable.png');
      expect(before.rows).toContain([uploaded.imageId, 'step9/images/disposable.png']);
      expect(before.retained['diaries/images/' + uploaded.imageId]).toBeDefined();
      await choose('disposable.png', 'Cancel');
      expect(await snapshot('cancelled')).toEqual(before);
      expect(card('disposable.png')).toBeDefined();
      await choose('disposable.png', 'Delete image');
      await until(() => !fixture.componentInstance.deleting && !card('disposable.png'));
      const deleted = await snapshot('deleted');
      expect(deleted.files).not.toContain('disposable.png');
      expect(deleted.rows).not.toContain([uploaded.imageId, 'step9/images/disposable.png']);
      expect(deleted.retained['diaries/images/' + uploaded.imageId]).toBeUndefined();
      expect(card('protected.png')).toBeDefined();
      // No public generic-delete wrapper exists; use the same authenticated transport.
      await expectAsync(firstValueFrom((rpc as any).authorisedRpcRequest(client, 'diaries/rpc/step9-generic/response',
        { function: 'deleteFile', args: { name: 'protected.png', subdir: 'step9/images' } }, ReplyHandler.getBufferAsObject)))
        .toBeRejectedWith(jasmine.objectContaining({ status: 409 }));
      const protectedState = await snapshot('generic-delete-rejected');
      expect(protectedState).toEqual(deleted);
      await choose('uncatalogued.png', 'Delete image');
      await until(() => !!fixture.componentInstance.deletionError && !fixture.componentInstance.deleting);
      expect(fixture.componentInstance.deletionError).toContain('no longer in the catalogue');
      expect(await snapshot('uncatalogued-rejected')).toEqual(deleted);
      const again: any = await firstValueFrom(rpc.uploadFile$(file('disposable.png'), 'step9/images'));
      expect(again.imageId).not.toBe(uploaded.imageId);
      fixture.componentInstance.refreshDirectory();
      await until(() => !!card('disposable.png'));
      const restored = await snapshot('reuploaded');
      expect(restored.rows).toContain([again.imageId, 'step9/images/disposable.png']);
      expect(restored.retained['diaries/images/' + again.imageId]).toBeDefined();
      expect(restored.retained['diaries/images/' + other.imageId]).toBeDefined();
      await expectAsync(firstValueFrom(rpc.uploadFile$(file('disposable.png'), 'step9/images'))).toBeRejectedWith(jasmine.objectContaining({ status: 409 }));
      expect(await snapshot('duplicate-upload-rejected')).toEqual(restored);
    } finally {
      await fetch(cfg.baseUrl + '/evidence', { method: 'POST', body: JSON.stringify(checkpoints, null, 2) });
      fixture.destroy();
      await client.endAsync();
    }
  }, 60000);
});
