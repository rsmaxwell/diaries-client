import { forkJoin, Observable, switchMap } from "rxjs";
import { ConfigService } from "../config/config.service";
import { MqttService } from "./mqtt.service";
import { Page } from "../page/page";
import { Buffer } from 'buffer';
import { AccessTokenService } from "../user/token/AccessTokenService";
import { Rectangle } from "../utilities/rectangle";
import { AddMarqueeRequest, DeleteMarqueeRequest, Marquee, UpdateMarqueeRequest } from "../model/marquee/marquee";
import mqtt from "mqtt";
import { Status } from "../utilities/reply";
import { HttpStatusCode } from "@angular/common/http";
import { v4 as uuidv4 } from 'uuid';
import { Injectable } from "@angular/core";
import { ReplyHandler } from "../utilities/replyHandler";

@Injectable({ providedIn: 'root' })
export class RpcService {
    private readonly reqTopic = 'request';
    private readonly baseReply = (id: string) => `reply/${id}/addMarquee`;

    constructor(
        private mqtt: MqttService,
        private config: ConfigService,
        private token: AccessTokenService
    ) { }

    addMarquee$(page: Page, rect: Rectangle, sequence: number): Observable<number> {
        return forkJoin({
            cfg: this.config.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.token.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = this.baseReply(cfg.clientId);
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
                const replyTopic = this.baseReply(cfg.clientId);
                const payload = { function: 'updateMarquee', args: new UpdateMarqueeRequest(marquee) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, this.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    deleteMarquee$(marquee: Marquee): Observable<number> {
        return forkJoin({
            cfg: this.config.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.token.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = this.baseReply(cfg.clientId);
                const payload = { function: 'deleteMarquee', args: new DeleteMarqueeRequest(marquee) };
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
        accessToken: string,
        deserialize: (buf: Buffer) => R,
        timeout = 5000
    ): Observable<R> {
        return new Observable<R>(obs => {
            const corr = uuidv4();
            const timer = setTimeout(() => obs.error(new Error('Timeout')), timeout);

            const onMsg = (t: string, buf: Buffer, pkt: any) => {
                const props = pkt.properties as {
                    correlationData?: Buffer;
                    userProperties?: { [key: string]: string };
                };

                if (t !== replyTopic || props?.correlationData?.toString() !== corr) return;
                clearTimeout(timer);
                client.removeListener('message', onMsg);

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
                client.on('message', onMsg);

                client.publish(requestTopic, JSON.stringify(payload), {
                    qos: 1,
                    properties: {
                        responseTopic: replyTopic,
                        correlationData: Buffer.from(corr),
                        userProperties: { accessToken }
                    }
                }, pubErr => {
                    if (pubErr) obs.error(pubErr);
                });
            });

            return () => {
                clearTimeout(timer);
                client.removeListener('message', onMsg);
            };
        });
    }
}




