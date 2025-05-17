import { forkJoin, Observable, switchMap } from "rxjs";
import { ConfigService } from "../config/config.service";
import { MqttService } from "./mqtt.service";
import { Page } from "../page/page";
import { Buffer } from 'buffer';
import { AccessTokenService } from "../user/token/AccessTokenService";
import { Rectangle } from "../utilities/rectangle";
import { AddMarqueeRequest, DeleteMarqueeRequest, Marquee, UpdateMarqueeRequest } from "../model/marquee/marquee";
import mqtt, { IClientPublishOptions, IPublishPacket } from "mqtt";
import { RegisterReply, SigninReply, Status } from "../utilities/reply";
import { HttpStatusCode } from "@angular/common/http";
import { v4 as uuidv4 } from 'uuid';
import { Injectable } from "@angular/core";
import { ReplyHandler } from "../utilities/replyHandler";
import { Signin, SigninRequest } from "../model/signin";
import { Register, RegisterRequest } from "../model/register";

@Injectable({ providedIn: 'root' })
export class RpcService {
    private readonly reqTopic = 'request';

    constructor(
        private mqtt: MqttService,
        private config: ConfigService,
        private token: AccessTokenService
    ) { }

    register$(register: Register): Observable<RegisterReply> {
        return forkJoin({
            cfg: this.config.getConfig(),
            client: this.mqtt.getConnection()
            // Note: no accessToken needed
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = `reply/${cfg.clientId}/register`;
                const payload = { function: 'register', args: new RegisterRequest(register) };
                const deserialize = ReplyHandler.getBufferAsObject as (buffer: Buffer) => RegisterReply;
                return this.rpcRequest<RegisterReply>(client, this.reqTopic, replyTopic, payload, null, deserialize);
            })
        );
    }

    signin$(signin: Signin): Observable<SigninReply> {
        return forkJoin({
            cfg: this.config.getConfig(),
            client: this.mqtt.getConnection()
            // Note: no accessToken needed
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = `reply/${cfg.clientId}/signin`;
                const payload = { function: 'signin', args: new SigninRequest(signin) };
                const deserialize = ReplyHandler.getBufferAsObject as (buffer: Buffer) => SigninReply;
                return this.rpcRequest<SigninReply>(client, this.reqTopic, replyTopic, payload, null, deserialize);
            })
        );
    }

    addMarquee$(page: Page, rect: Rectangle, sequence: number): Observable<number> {
        return forkJoin({
            cfg: this.config.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.token.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = `reply/${cfg.clientId}/addMarquee`;
                const payload = { function: 'addMarquee', args: new AddMarqueeRequest(page.id, rect, sequence) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, this.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    updateMarquee$(marquee: Marquee): Observable<number> {
        return forkJoin({
            cfg: this.config.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.token.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = `reply/${cfg.clientId}/updateMarquee`;
                const payload = { function: 'updateMarquee', args: new UpdateMarqueeRequest(marquee) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, this.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    deleteMarquee$(id: number): Observable<number> {
        return forkJoin({
            cfg: this.config.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.token.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = `reply/${cfg.clientId}/deleteMarquee`;
                const payload = { function: 'deleteMarquee', args: new DeleteMarqueeRequest(id) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, this.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    private rpcRequest<R>(
        client: mqtt.MqttClient,
        requestTopic: string,
        replyTopic: string,
        payload: unknown,
        accessToken: string | null,
        deserialize: (buf: Buffer) => R,
        timeout = 50000
    ): Observable<R> {
        return new Observable<R>(obs => {
            const corr = uuidv4();
            const timer = setTimeout(() => obs.error(new Error('Timeout')), timeout);

            const handler = (t: string, buf: Buffer, pkt: any) => {

                const props = pkt.properties as {
                    correlationData?: Buffer;
                    userProperties?: { [key: string]: string };
                };

                if (t !== replyTopic || props?.correlationData?.toString() !== corr) return;
                clearTimeout(timer);
                client.removeListener('message', handler);

                const statusJson = props?.userProperties?.["status"];
                const status = statusJson ? JSON.parse(statusJson) as Status : null;
                if (!status || status.code !== HttpStatusCode.Ok) {
                    return obs.error(new Error(`Status ${status?.code}: ${status?.message}`));
                }

                try {
                    const val = deserialize(buf);
                    obs.next(val);
                    obs.complete();
                } catch (e) {
                    obs.error(e);
                }
            };

            client.subscribe(replyTopic, { qos: 1 }, err => {
                if (err) return obs.error(err);

                client.on('message', handler);

                const publishPayload = JSON.stringify(payload);

                const properties: IPublishPacket['properties'] = {
                    responseTopic: replyTopic,
                    correlationData: Buffer.from(corr)
                };
            
                if (accessToken) {
                    properties.userProperties = { accessToken };
                }
            
                const publishOptions: IClientPublishOptions = {
                    qos: 1,
                    retain: false,
                    properties
                };

                client.publish(requestTopic, JSON.stringify(payload), publishOptions, err => {
                    if (err) {
                        console.error('rpcRequest.publish: Failed:', err);
                        obs.error(err);
                    }
                });
            });

            return () => {
                clearTimeout(timer);
                client.removeListener('message', handler);
            };
        });
    }
}

