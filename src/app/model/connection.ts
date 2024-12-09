import mqtt from "mqtt";

export class Connection {
    client: mqtt.MqttClient
    clientId: string

    constructor(client: mqtt.MqttClient, clientId: string) {
        this.client = client
        this.clientId = clientId
    }
}
