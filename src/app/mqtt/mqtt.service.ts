import { Injectable } from '@angular/core';
import { ConfigService } from '../config/config.service';
import { Connection } from '../model/connection';
import mqtt from 'mqtt';


@Injectable({
  providedIn: 'root'
})
export class MqttService {

  connection!: Connection;
  cachedPromise: Promise<Connection> | null = null;

  constructor(
    private configService: ConfigService
  ) {
    console.log('MqttService.constructor');
  }

  
  initialise() {
    console.log(`MqttService.initialise`);
  }

  getConnection(): Promise<Connection> {
    console.log(`MqttService.getConnection`);

    if (!this.cachedPromise) {
      this.cachedPromise = new Promise((resolve, reject) => {
        console.log("MqttService.getConnection: getting configuration");

        this.configService.loadConfig()
        .then((mqttConfig) => {
          console.log(`MqttService.getConnection: connecting`);
  
          let client: mqtt.MqttClient = mqtt.connect(mqttConfig.brokerUrl, {
            clientId: mqttConfig.clientId,
            username: mqttConfig.username,
            password: mqttConfig.password,
            keepalive: mqttConfig.keepalive,
            reconnectPeriod: mqttConfig.reconnectPeriod,
            connectTimeout: mqttConfig.connectTimeout,
            protocolVersion: mqttConfig.protocolVersion,
            clean: mqttConfig.clean, // ✅ Retain session between reconnects
          });
  
          client.on('connect', () => {
            console.log(`MqttService.getConnection: connected to broker`);
            this.connection = new Connection(client, mqttConfig.clientId)
            resolve(this.connection);
          });
  
          client.on('error', (error: any) => {
            console.error(`MqttService.getConnection: connection error: ${error}`);
            reject("Failed to connect to the server.");
          });
  
          client.on('close', () => {
            console.log(`MqttService.getConnection: connection closed`);
          });
        })
        .catch((error) => {
          console.error(`MqttService.getConnection: configuration error: ${error}`);
        });

      })
    }

    return this.cachedPromise
  }
}
