import { Injectable } from '@angular/core';
import { ConfigService, RuntimeConfig } from '../config/config.service';
import mqtt from 'mqtt';
import { delay, Subject } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class MqttService {

  connectionPromise: Promise<mqtt.MqttClient> | null = null;
  private actualClientId: string | null = null;

  constructor(
    private configService: ConfigService
  ) { }

  initialise() {
    console.log(`MqttService.initialise`);
  }

  async getConnection(): Promise<mqtt.MqttClient> {
    // console.log(`MqttService.getConnection`);

    if (this.connectionPromise) {
      return this.connectionPromise
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      console.log("MqttService.getConnection: getting configuration");

      this.configService.getConfig()
        .then((config) => {
          let connectedOnce = false;

          const clientId = `${config.clientId}-${Date.now()}`;
          this.actualClientId = clientId;

          console.log('MqttService.getConnection: connecting with MQTT config', {
            brokerUrl: config.brokerUrl,
            clientId,
            clean: config.clean,
            protocolVersion: config.protocolVersion
          });

          let client: mqtt.MqttClient = mqtt.connect(config.brokerUrl, {
            clientId: clientId,
            username: config.username,
            password: config.password,
            keepalive: config.keepalive,
            reconnectPeriod: config.reconnectPeriod,
            connectTimeout: config.connectTimeout,
            protocolVersion: config.protocolVersion,
            clean: config.clean, // ✅ Retain session between reconnects
          });

          client.on('connect', () => {
            connectedOnce = true;
            console.log(`MqttService.getConnection: [MQTT] connect clientId=${clientId} clean=${config.clean}`);
            resolve(client);
          });

          client.on('reconnect', () => {
            console.log(`MqttService.getConnection: [MQTT] reconnecting clientId=${clientId}`);
          });

          client.on('offline', () => {
            console.log(`MqttService.getConnection: [MQTT] offline clientId=${clientId}`);
          });

          client.on('error', (error: any) => {
            console.error(`MqttService.getConnection: connection error: ${error}`);

            if (!connectedOnce) {
              this.connectionPromise = null;
              reject("Failed to connect to the server.");
            }
          });

          client.on('close', () => {
            console.log(`MqttService.getConnection: [MQTT] close clientId=${clientId}`);
          });

          client.on('end', () => {
            console.log(`MqttService.getConnection: [MQTT] end clientId=${clientId}`);
          });
        })
        .catch((error) => {
          this.connectionPromise = null;
          console.error(`MqttService.getConnection: configuration error: ${error}`);
          reject(`MqttService.getConnection: Error: ${error}`);
        });
    })

    return this.connectionPromise
  }

  async safeConnectWithRetry(retries = 3): Promise<mqtt.MqttClient> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.getConnection();
      } catch (err) {
        console.warn(`MQTT connect attempt ${attempt} failed:`, err);
        if (attempt === retries) throw err;
        await delay(1000); // delay before retry
      }
    }
    throw new Error('Unreachable'); // just in case
  }

  getClientId(): string {
    if (!this.actualClientId) {
      throw new Error('MqttService.getConnection: MQTT clientId not initialised');
    }
    return this.actualClientId;
  }
}
