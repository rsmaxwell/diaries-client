import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Config {
  diaries: string;
  files: string;
  clientId: string;
  username: string;
  password: string;
  keepalive?: number;
  reconnectPeriod?: number;
  connectTimeout?: number;
  protocolVersion?: 4 | 5 | 3 | undefined;
  clean: boolean;

  brokerMode: 'direct' | 'proxy';
  brokerDirectUrl: string;
  brokerProxyPath: string;
  brokerProxyUrl: string;

  baseUrlMode: string;
  baseUrl: string;
  baseUrlPort: string;
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
    const configured = config.baseUrl?.trim();

    // Production/proxied case:
    // https://pluto.rsmaxwell.co.uk -> https://pluto.rsmaxwell.co.uk/diaries-responder
    if (!configured || configured === 'same-origin' || config.baseUrlMode === 'same-origin') {
      return `${window.location.origin}/diaries-responder`;
    }

    // Local/direct case:
    // http://localhost:4200 -> http://localhost:8081
    if (configured === 'same-host-port' || config.baseUrlMode === 'same-host-port') {
      const url = new URL(window.location.origin);
      url.port = String(config.baseUrlPort ?? 8081);
      return url.toString().replace(/\/$/, '');
    }

    // Explicit URL:
    // http://localhost:8081
    // https://pluto.rsmaxwell.co.uk/diaries-responder
    return configured.replace(/\/$/, '');
  }
}
