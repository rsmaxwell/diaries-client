import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface MqttConfig {
  brokerUrl: string;
  clientId: string;
  username?: string;
  password?: string;
  keepalive?: number;
  reconnectPeriod?: number;
  connectTimeout?: number;
  protocolVersion?: 4 | 5 | 3 | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  private configUrl = './assets/mqtt-config.json';

  constructor(private http: HttpClient) { 
    console.log('ConfigService.constructor');
  }

  loadConfig(): Promise<MqttConfig> {

    console.log('ConfigService.loadConfig');

    return new Promise<MqttConfig>((resolve, reject) => {
      this.http.get<MqttConfig>(this.configUrl).subscribe({
        next: config => {
          console.info('ConfigService.loadConfig => next')  
          resolve(config);
        },
        error: err => {
          console.error('ConfigService.loadConfig => error: Could not load MQTT configuration', err);
          reject(err);
        },
        complete: () => console.info('ConfigService.loadConfig => complete')        
      });
    });
  }
}

