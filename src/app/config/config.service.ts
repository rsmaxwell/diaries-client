import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { lastValueFrom } from 'rxjs';

export interface Config {
  fileServerUrl: string;
  brokerUrl: string;
  clientId: string;
  username: string;
  password: string;
  keepalive?: number;
  reconnectPeriod?: number;
  connectTimeout?: number;
  protocolVersion?: 4 | 5 | 3 | undefined;
  clean: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private configUrl = 'assets/config.json';
  private configCache: Config | null = null;

  constructor(private http: HttpClient) {
    console.log('ConfigService.constructor');
  }

  async getConfig(): Promise<Config> {
    console.log(`ConfigService.getConfig`);

    if (this.configCache) {     
      return this.configCache;
    }

    const config = await lastValueFrom(this.http.get<Config>(this.configUrl));
    this.configCache = config;
    return config;
  }

  getCurrentConfig(): Config | null {
    return this.configCache;
  }
}
