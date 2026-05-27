import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';


export interface Config {
  brokerMode: 'direct' | 'proxy';
  brokerDirectUrl?: string;
  brokerProxyPath?: string;
  brokerProxyUrl?: string;

  responderBaseUrlMode?: 'same-origin' | 'same-host-port';
  responderBaseUrl?: string;
  responderBaseUrlPort?: string;

  username: string;
  password: string;

  diaries: string;
  files: string;
  clientId: string;
  keepalive?: number;
  reconnectPeriod?: number;
  connectTimeout?: number;
  protocolVersion?: 4 | 5 | 3 | undefined;
  clean: boolean;
  fragmentLockTtlSeconds?: number;
}

export interface RuntimeConfig extends Config {
  brokerUrl: string;
  baseUrl: string;
}



@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private configUrl = 'assets/config.json';
  private configCache: RuntimeConfig | null = null;

  constructor(private http: HttpClient) {
    console.log('ConfigService.constructor');
  }

  async getConfig(): Promise<RuntimeConfig> {
    console.log(`ConfigService.getConfig`);

    if (this.configCache) {
      console.log('ConfigService.getConfig from cache: ', this.configCache);
      return this.configCache;
    }

    const config = await lastValueFrom(this.http.get<Config>(this.configUrl));
    this.configCache = {
      ...config,
      brokerUrl: this.buildBrokerUrl(config),
      baseUrl: this.buildResponderBaseUrl(config)
    };

    console.log('ConfigService.getConfig new: ', this.configCache);
    return this.configCache;
  }

  private buildBrokerUrl(config: Config): string {
    if (config.brokerMode === 'direct') {
      if (!config.brokerDirectUrl?.trim()) {
        throw new Error('brokerDirectUrl is required when brokerMode is direct');
      }

      return config.brokerDirectUrl.trim();
    }

    if (config.brokerMode === 'proxy') {
      if (config.brokerProxyUrl?.trim()) {
        return config.brokerProxyUrl.trim();
      }

      if (!config.brokerProxyPath?.trim()) {
        throw new Error('brokerProxyUrl or brokerProxyPath is required when brokerMode is proxy');
      }

      const origin = window.location.origin;
      const wsOrigin = origin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
      return `${wsOrigin}${config.brokerProxyPath}`;
    }

    throw new Error(`Unsupported brokerMode: ${config.brokerMode}`);
  }

  private buildResponderBaseUrl(config: Config): string {

    // Production/proxied case:
    // https://pluto.rsmaxwell.co.uk -> https://pluto.rsmaxwell.co.uk/diaries-responder    
    if (config.responderBaseUrlMode === 'same-origin') {
      return `${window.location.origin}/diaries-responder`;
    }

    // Local/direct case:
    // http://localhost:4200 -> http://localhost:8081    
    if (config.responderBaseUrlMode === 'same-host-port') {
      const url = new URL(window.location.origin);
      url.port = String(config.responderBaseUrlPort ?? 8081);
      return url.toString().replace(/\/$/, '');
    }

    // Explicit URL:
    // http://localhost:8081
    // https://pluto.rsmaxwell.co.uk/diaries-responder    
    const configured = config.responderBaseUrl?.trim();
    if (!configured) {
      throw new Error('baseUrl is required when baseUrlMode is not set');
    }
    return configured.replace(/\/$/, '');
  }
}
