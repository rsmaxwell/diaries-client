import { forkJoin, from, Observable, Subscriber, switchMap } from "rxjs";
import { ConfigService } from "../config/config.service";
import { MqttService } from "./mqtt.service";
import { Page } from "../model/page";
import { Buffer } from 'buffer';
import { AccessTokenService } from "../user/token/AccessTokenService";
import { RefreshTokenService } from "../user/token/RefreshTokenService";
import { Rectangle } from "../utilities/rectangle";
import mqtt, { IClientPublishOptions, IPublishPacket } from "mqtt";
import { HttpStatusCode } from "@angular/common/http";
import { v4 as uuidv4 } from 'uuid';
import { Injectable } from "@angular/core";
import { ReplyHandler } from "../utilities/replyHandler";
import { Signin, SigninReply, SigninRequest } from "../model/signin";
import { Register, RegisterReply, RegisterRequest } from "../model/register";
import { AddMarqueeRequest, DeleteMarqueeRequest, Marquee, UpdateMarqueeRequest } from "../model/marquee";
import { Status } from "../model/status";
import { RefreshTokenRequest, RefreshTokenReply } from "../model/refresh.token";
import { Diary } from "../model/diary";
import { UpdateDiaryRequest } from "../model/diary";

@Injectable({ providedIn: 'root' })
export class RpcService {
    private readonly reqTopic = 'request';
    private subscribedTopics = new Set<string>();

    // map of correlationIds to handlers
    private responseHandlers = new Map<string, {
        replyTopic: string,
        observer: Subscriber<any>,
        deserialize: (buf: Buffer) => any,
        timer: NodeJS.Timeout
    }>();

    constructor(
        private config: ConfigService,
        private mqtt: MqttService,
        private accessToken: AccessTokenService,
        private refreshToken: RefreshTokenService
    ) {
        this.ensureListener()
    }

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
            // No need for the access token
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = `reply/${cfg.clientId}/signin`;
                const payload = { function: 'signin', args: new SigninRequest(signin) };
                const deserialize = ReplyHandler.getBufferAsObject as (buffer: Buffer) => SigninReply;
                return this.rpcRequest<SigninReply>(client, this.reqTopic, replyTopic, payload, null, deserialize);
            })
        );
    }

    refreshToken$(): Observable<RefreshTokenReply> {
        return forkJoin({
            cfg: this.config.getConfig(),
            client: this.mqtt.getConnection(),
            accessToken: this.accessToken.getToken(),
            refreshToken: this.refreshToken.getToken()
        }).pipe(
            switchMap(({ cfg, client, accessToken, refreshToken }) => {
                const replyTopic = `reply/${cfg.clientId}/refreshToken`;
                const payload = { function: 'refreshToken', args: new RefreshTokenRequest(cfg.username, refreshToken) };
                const deserialize = ReplyHandler.getBufferAsObject as (buffer: Buffer) => RefreshTokenReply;
                return this.rpcRequest<RefreshTokenReply>(client, this.reqTopic, replyTopic, payload, null, deserialize);
            })
        );
    }

    addMarquee$(page: Page, rect: Rectangle, sequence: number): Observable<number> {
        return forkJoin({
            cfg: this.config.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessToken.getToken()
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
            token: this.accessToken.getToken()
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
            token: this.accessToken.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = `reply/${cfg.clientId}/deleteMarquee`;
                const payload = { function: 'deleteMarquee', args: new DeleteMarqueeRequest(id) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, this.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    updateDiary$(diary: Diary): Observable<number> {
        return forkJoin({
            cfg: this.config.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessToken.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = `reply/${cfg.clientId}/updateDiary`;
                const payload = { function: 'updateDiary', args: new UpdateDiaryRequest(diary) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, this.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    // Register a single global message listener once
    private ensureListener(): void {
        const observable$ = from(this.mqtt.getConnection());
        observable$.subscribe({
            next: client => {
                if (!client.listeners('message').some(fn => fn.name === 'rpcDispatcher')) {
                    client.on('message', this.rpcDispatcher.bind(this));
                }
            },
            error: err => console.error("RpcServive.ensureListener: Error:", err),
            complete: () => console.log("RpcServive.ensureListener: Completed")
        });
    }

    // Dispatcher that routes based on correlationId
    private rpcDispatcher(topic: string, payload: Buffer, packet: any) {
        const props = packet.properties as mqtt.IClientPublishOptions['properties'];
        const corr = props?.correlationData?.toString();

        if (!corr || !this.responseHandlers.has(corr)) return;

        const handler = this.responseHandlers.get(corr)!;

        if (topic !== handler.replyTopic) return;

        clearTimeout(handler.timer);
        this.responseHandlers.delete(corr);



        let status: Status | null = null

        const statusRaw = props?.userProperties?.["status"];
        if (statusRaw) {
            const firstStatus = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
            try {
                status = JSON.parse(firstStatus) as Status;
            } catch (e) {
                handler.observer.error(new Error("Failed to parse status JSON"));
                return;
            }
        }

        if (!status || status.code !== HttpStatusCode.Ok) {
            handler.observer.error(new Error(`Status ${status?.code}: ${status?.message}`));
            return;
        }

        try {
            const value = handler.deserialize(payload);
            handler.observer.next(value);
            handler.observer.complete();
        } catch (e) {
            handler.observer.error(e);
        }
    }

    private rpcRequest<R>(
        client: mqtt.MqttClient,
        requestTopic: string,
        replyTopic: string,
        payload: unknown,
        accessToken: string | null,
        deserialize: (buf: Buffer) => R,
        timeout = 5000
    ): Observable<R> {
        return new Observable<R>(obs => {
            const corr = uuidv4();
    
            if (this.responseHandlers.has(corr)) {
                console.warn(`rpcRequest: Duplicate correlationId detected: ${corr}`);
                obs.error(new Error('Duplicate correlationId'));
                return;
            }
    
            const timer = setTimeout(() => {
                this.responseHandlers.delete(corr);
                obs.error(new Error('Timeout'));
            }, timeout);
    
            // Register the response handler
            this.responseHandlers.set(corr, {
                replyTopic,
                observer: obs,
                deserialize,
                timer
            });
    
            const publishRequest = () => {
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
    
                console.log(`[rpcRequest] Publishing to ${requestTopic} with corr=${corr}, replyTopic=${replyTopic}`);
                client.publish(requestTopic, publishPayload, publishOptions, err => {
                    if (err) {
                        this.responseHandlers.delete(corr);
                        clearTimeout(timer);
                        console.error(`[rpcRequest] Publish failed: ${err.message}`);
                        obs.error(err);
                    } else {
                        console.log(`[rpcRequest] Publish succeeded`);
                    }
                });
            };
    
            // Subscribe to replyTopic only once
            if (!this.subscribedTopics.has(replyTopic)) {
                client.subscribe(replyTopic, { qos: 1 }, err => {
                    if (err) {
                        this.responseHandlers.delete(corr);
                        clearTimeout(timer);
                        return obs.error(err);
                    }
                    this.subscribedTopics.add(replyTopic);
                    publishRequest();
                });
            } else {
                publishRequest();
            }
    
            return () => {
                this.responseHandlers.delete(corr);
                clearTimeout(timer);
            };
        });
    }
}

