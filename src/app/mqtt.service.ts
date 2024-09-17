import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import mqtt, { MqttClient } from "mqtt"
import { DiaryService } from './diary.service';
import { PageService } from './page.service';

@Injectable({
  providedIn: 'root'
})
export class MqttService {

  private accessToken: string;
  private refreshToken: string;
  private refreshDelta: number;
  private client!: MqttClient;
  private clientID!: string;

  constructor(
    private configService: ConfigService,
    private diaryService: DiaryService,
    private pageService: PageService
  ) {
    console.log('MqttService.constructor');
    this.accessToken = ""
    this.refreshToken = ""
    this.refreshDelta = 0
  }

  initializeAsync(): Promise<mqtt.MqttClient> {
    return new Promise((resolve, reject) => {
      console.log('MqttService.initializeAsync: Initializing MqttService with config');
      this.configService.loadConfig()
        .then((mqttConfig) => {
          console.log('MqttService.initializeAsync: Promise resolved with value: ' + JSON.stringify(mqttConfig));

          this.clientID = mqttConfig.clientId

          this.client = mqtt.connect(mqttConfig.brokerUrl, {
            clientId: mqttConfig.clientId,
            username: mqttConfig.username,
            password: mqttConfig.password,
            keepalive: mqttConfig.keepalive,
            reconnectPeriod: mqttConfig.reconnectPeriod,
            connectTimeout: mqttConfig.connectTimeout,
            protocolVersion: mqttConfig.protocolVersion,
          });
      
          this.client.on('connect', () => {
            console.log('MqttService.initializeClient: connected to MQTT broker');
            resolve(this.client);

            this.diaryService.initialize(this.client, mqttConfig.clientId);
            this.pageService.initialize(this.client, mqttConfig.clientId);
          });
      
          this.client.on('error', (error: any) => {
            console.error('MqttService.initializeClient: connection error:', error);
            reject(error);
          });
      
          this.client.on('close', () => {
            console.log('MqttService.initializeClient: connection closed');
          });
        })
        .catch((error) => {
          console.error('MqttService.initializeAsync: Promise rejected with error: ' + error);
          reject(error);
        });
    });
  }

  public getClientID(): string {
    return this.clientID
  }

  public getClient(): mqtt.MqttClient {
    return this.client
  }
  
  getAccessToken() {
    return this.accessToken
}

  setRefreshDelta(refreshDelta: number) {
    this.refreshDelta = refreshDelta;
    console.log(`MqttService.setRefreshDelta: refreshDelta: ${this.refreshDelta}`);
  }

  setRefreshToken(refreshToken: string) {
    this.refreshToken = refreshToken;
    console.log(`MqttService.setRefreshToken: refreshToken: ${this.refreshToken}`);
  }

  setAccessToken(accessToken: string) {
    this.accessToken = accessToken;
    console.log(`MqttService.setAccessToken: accessToken: ${this.accessToken}`);
  }

  

  private timerID!: number;

  public startRefreshTokenTimer() {

    console.log(`MqttService.startRefreshTokenTimer(): accessToken: ${this.accessToken}`)

    const jwtToken = JSON.parse(atob(this.accessToken.split('.')[1]));
    const expires = new Date(jwtToken.exp * 1000);
    const timeout = expires.getTime() - Date.now() - (this.refreshDelta * 1000);

    if (timeout < 0) {
      console.log("MqttService.startRefreshTokenTimer(): timeout: *** EXPIRED ***")
    }
    else {
      console.log(`MqttService.startRefreshTokenTimer(): timeout: ${ timeout / 1000 } seconds`)

      window.clearTimeout(this.timerID)

      this.timerID = window.setTimeout(
        () => {
          this.refreshToken
        }, timeout);
    }
  }
}
