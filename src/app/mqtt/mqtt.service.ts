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

          client.on('disconnect', (packet: any) => {
            const reasonCode = packet.reasonCode;
            console.warn('MqttService.getConnection: [MQTT] broker DISCONNECT', {
              clientId,
              reasonCode,
              reasonCodeHex: reasonCode === undefined
                ? undefined
                : `0x${reasonCode.toString(16).padStart(2, '0').toUpperCase()}`,
              reason: this.describeDisconnectReason(reasonCode),
              reasonString: packet.properties?.reasonString,
              serverReference: packet.properties?.serverReference,
              properties: packet.properties
            });
          });

          client.on('error', (error: any) => {
            console.error('MqttService.getConnection: [MQTT] error', {
              clientId,
              name: error?.name,
              message: error?.message ?? String(error),
              code: error?.code,
              errno: error?.errno,
              syscall: error?.syscall,
              reasonCode: error?.reasonCode,
              stack: error?.stack
            });

            if (!connectedOnce) {
              this.connectionPromise = null;
              reject("Failed to connect to the server.");
            }
          });

          client.on('close', () => {
            console.warn('MqttService.getConnection: [MQTT] close', {
              clientId,
              connected: client.connected,
              reconnecting: client.reconnecting
            });
          });

          client.on('end', () => {
            console.log(`MqttService.getConnection: [MQTT] end clientId=${clientId}`);
          });
        })
        .catch((error) => {
          this.connectionPromise = null;
          console.error('MqttService.getConnection: configuration error', error);
          reject(error);
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

  private describeDisconnectReason(reasonCode: number | undefined): string | undefined {
    if (reasonCode === undefined) {
      return undefined;
    }

    const reasons: Record<number, string> = {
      0x00: 'Normal disconnection',
      0x04: 'Disconnect with Will Message',
      0x80: 'Unspecified error',
      0x81: 'Malformed Packet',
      0x82: 'Protocol Error',
      0x87: 'Not authorized',
      0x89: 'Server busy',
      0x8B: 'Server shutting down',
      0x8D: 'Keep Alive timeout',
      0x8E: 'Session taken over',
      0x93: 'Receive Maximum exceeded',
      0x94: 'Topic Alias invalid',
      0x95: 'Packet too large',
      0x97: 'Quota exceeded',
      0x98: 'Administrative action',
      0x9C: 'Use another server',
      0x9D: 'Server moved'
    };

    return reasons[reasonCode] ?? 'Unknown MQTT DISCONNECT reason';
  }

  getClientId(): string {
    if (!this.actualClientId) {
      throw new Error('MqttService.getConnection: MQTT clientId not initialised');
    }
    return this.actualClientId;
  }
}
