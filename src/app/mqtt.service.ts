import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import mqtt from "mqtt"

@Injectable({
  providedIn: 'root'
})
export class MqttService {

  constructor(private configService: ConfigService) {
    console.log('MqttService.constructor');
  }

  initializeAsync(): Promise<mqtt.MqttClient> {
    return new Promise((resolve, reject) => {
      console.log('MqttService.initializeAsync: Initializing MqttService with config');
      this.configService.loadConfig()
        .then((mqttConfig) => {
          console.log('MqttService.initializeAsync: Promise resolved with value: ' + JSON.stringify(mqttConfig));

          let client = mqtt.connect(mqttConfig.brokerUrl, {
            clientId: mqttConfig.clientId,
            username: mqttConfig.username,
            password: mqttConfig.password,
            keepalive: mqttConfig.keepalive,
            reconnectPeriod: mqttConfig.reconnectPeriod,
            connectTimeout: mqttConfig.connectTimeout,
            protocolVersion: mqttConfig.protocolVersion,
          });
      
          client.on('connect', () => {
            console.log('MqttService.initializeClient: connected to MQTT broker');
            resolve(client);
          });
      
          client.on('error', (error: any) => {
            console.error('MqttService.initializeClient: connection error:', error);
            reject(error);
          });
      
          client.on('close', () => {
            console.log('MqttService.initializeClient: connection closed');
          });
        })
        .catch((error) => {
          console.error('MqttService.initializeAsync: Promise rejected with error: ' + error);
          reject(error);
        });
    });
  }
}
