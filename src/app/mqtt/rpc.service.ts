import { forkJoin, from, Observable, Subscriber, switchMap } from "rxjs";
import { MqttService } from "./mqtt.service";
import { Buffer } from 'buffer';
import mqtt, { IClientPublishOptions, IPublishPacket } from "mqtt";
import { HttpStatusCode } from "@angular/common/http";
import { v4 as uuidv4 } from 'uuid';
import { Injectable } from "@angular/core";

import { Status } from "./status";
import { Page, UpdatePageRequest } from "../model/page";
import { Rectangle } from "../utilities/rectangle";
import { ReplyHandler } from "../utilities/replyHandler";
import { Constants } from "../utilities/constants";
import { AddMarqueeRequest, DeleteMarqueeRequest, Marquee, UpdateMarqueeRequest } from "../model/marquee";
import { ConfigService } from "../config/config.service";
import { AccessTokenService } from "../user/token/AccessTokenService";
import { Signin, SigninReply, SigninRequest } from "../model/signin";
import { Register, RegisterReply, RegisterRequest } from "../model/register";
import { Diary, UpdateDiaryRequest } from "../model/diary";
import { RefreshTokenReply, RefreshTokenRequest } from "../model/refresh.token";
import { RefreshTokenService } from "../user/token/RefreshTokenService";
import { NormaliseFragmentsRequest } from "../model/fragment";


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
        private mqtt: MqttService,
        private configService: ConfigService,
        private accessTokenService: AccessTokenService,
        private refreshTokenService: RefreshTokenService
    ) {
        this.ensureListener()
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
                    qos: 0,
                    retain: false,
                    properties
                };

                // console.log(`rpcRequest: topic: '${requestTopic}', payload: '${publishPayload}'`);
                // console.log(`rpcRequest: corr: '${corr}', replyTopic: '${replyTopic}'`);                
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

    register$(register: Register): Observable<RegisterReply> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
            // Note: no accessToken needed
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = `reply/${cfg.clientId}/register`;
                const payload = { function: 'register', args: new RegisterRequest(register) };
                const deserialize = ReplyHandler.getBufferAsObject as (buffer: Buffer) => RegisterReply;
                return this.rpcRequest<RegisterReply>(client, Constants.reqTopic, replyTopic, payload, null, deserialize);
            })
        );
    }

    signin$(signin: Signin): Observable<SigninReply> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
            // No need for the access token
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = `reply/${cfg.clientId}/signin`;
                const payload = { function: 'signin', args: new SigninRequest(signin) };
                const deserialize = ReplyHandler.getBufferAsObject as (buffer: Buffer) => SigninReply;
                return this.rpcRequest<SigninReply>(client, Constants.reqTopic, replyTopic, payload, null, deserialize);
            })
        );
    }

    refreshToken$(): Observable<RefreshTokenReply> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            accessToken: this.accessTokenService.getToken(),
            refreshToken: this.refreshTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, accessToken, refreshToken }) => {
                const replyTopic = `reply/${cfg.clientId}/refreshToken`;
                const payload = { function: 'refreshToken', args: new RefreshTokenRequest(cfg.username, refreshToken) };
                const deserialize = ReplyHandler.getBufferAsObject as (buffer: Buffer) => RefreshTokenReply;
                return this.rpcRequest<RefreshTokenReply>(client, Constants.reqTopic, replyTopic, payload, null, deserialize);
            })
        );
    }

    updateDiary$(diary: Diary): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = `reply/${cfg.clientId}/updateDiary`;
                const payload = { function: 'updateDiary', args: UpdateDiaryRequest.fromDiary(diary) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    normaliseDiaries$(): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = `reply/${cfg.clientId}/normaliseDiaries`;
                const payload = { function: 'normaliseDiaries' };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    normaliseFragments$(year: number, month: number, day: number): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = `reply/${cfg.clientId}/normaliseFragments`;
                const payload = { function: 'normaliseFragments', args: new NormaliseFragmentsRequest(year, month, day) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    updatePage$(page: Page): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = `reply/${cfg.clientId}/updatePage`;
                const payload = { function: 'updatePage', args: UpdatePageRequest.fromPage(page) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    addMarquee$(page: Page, rect: Rectangle, sequence: number): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = `reply/${cfg.clientId}/addMarquee`;
                const payload = { function: 'addMarquee', args: new AddMarqueeRequest(page.id, rect, sequence) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    updateMarquee$(marquee: Marquee): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = `reply/${cfg.clientId}/updateMarquee`;
                const payload = { function: 'updateMarquee', args: new UpdateMarqueeRequest(marquee) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    deleteMarquee$(id: number): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = `reply/${cfg.clientId}/deleteFragment`;
                const payload = { function: 'deleteFragment', args: new DeleteMarqueeRequest(id) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }
}

