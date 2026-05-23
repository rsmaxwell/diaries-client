import { forkJoin, from, map, Observable, Subscriber, switchMap } from "rxjs";
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
import { Signin, SigninReply, SigninRequest } from "../model/signin";
import { Register, RegisterReply, RegisterRequest } from "../model/register";
import { Diary, UpdateDiaryRequest } from "../model/diary";
import { RefreshTokenReply, RefreshTokenRequest } from "../model/refresh.token";
import { AddFragmentRequest, DeleteFragmentRequest, Fragment, LockFragmentRequest, NormaliseFragmentsRequest, UnlockFragmentRequest, UpdateFragmentRequest } from "../model/fragment";
import { AccessTokenService } from "../user/token/accessTokenService";
import { RefreshTokenService } from "../user/token/refreshTokenService";
import { FileEntry } from "../model/FileEntry";
import { FileListResponse } from "../model/FileListResponse";


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

                    console.log(
                        `RpcService.ensureListener: attaching handler`
                    );

                    client.on('message', this.rpcDispatcher.bind(this));

                    console.log(
                        `RpcService.ensureListener: ListenerCount: after subscribeToTopicTree:`,
                        client.listenerCount('message')
                    );

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

        console.log(`rpcDispatcher: received status:`, status);
        //      console.log(`rpcDispatcher: raw userProperties.status:`, props?.userProperties?.["status"]);

        if (!status || status.code !== HttpStatusCode.Ok) {
            // handler.observer.error(new Error(`Status ${status?.code}: ${status?.message}`));
            const err: any = new Error(`Status ${status?.code}: ${status?.message}`);
            err.status = status?.code;
            handler.observer.error(err);
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

        console.log(`RpcService.rpcRequest`)
        // console.log(`RpcService.rpcRequest: accessToken: ${accessToken}`)

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

                console.log(`RpcService.rpcRequest: sending to topic '${requestTopic}'`);
                console.log(`RpcService.rpcRequest: ${publishPayload}`);
                console.log(`RpcService.rpcRequest: correlationId: '${corr}', replyTopic: '${replyTopic}'`);
                console.log(`RpcService.rpcRequest: userProperties: '${JSON.stringify(properties.userProperties)}'`);
                console.log(`RpcService.rpcRequest: publishOptions: '${JSON.stringify(publishOptions)}'`);

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
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
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
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
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
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
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
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
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
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'normaliseDiaries' };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    normalisePages$(): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'normalisePages' };
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
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
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
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'updatePage', args: UpdatePageRequest.fromPage(page) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    addMarquee$(page: Page, fragmentId: number, rect: Rectangle): Observable<Marquee> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = {
                    function: 'addMarquee',
                    args: new AddMarqueeRequest(page.id, fragmentId, rect)
                };

                const deserialize = ReplyHandler.getBufferAsObject<Marquee>;

                return this.rpcRequest<Marquee>(
                    client,
                    Constants.reqTopic,
                    replyTopic,
                    payload,
                    token,
                    deserialize
                );
            })
        );
    }

    addFragment$(request: AddFragmentRequest): Observable<Fragment> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());

                const payload = {
                    function: 'addFragment',
                    args: request
                };

                const deserialize = ReplyHandler.getBufferAsObject<Fragment>;

                return this.rpcRequest<Fragment>(
                    client,
                    Constants.reqTopic,
                    replyTopic,
                    payload,
                    token,
                    deserialize
                );
            })
        );
    }

    updateFragment$(fragment: Fragment): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'updateFragment', args: UpdateFragmentRequest.fromFragment(fragment) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    deleteFragment$(id: number): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());

                const payload = {
                    function: 'deleteFragment',
                    args: new DeleteFragmentRequest(id)
                };

                const deserialize = ReplyHandler.getBufferAsNumber;

                return this.rpcRequest<number>(
                    client,
                    Constants.reqTopic,
                    replyTopic,
                    payload,
                    token,
                    deserialize
                );
            })
        );
    }

    lockFragment$(id: number): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'lockFragment', args: LockFragmentRequest.fromId(id) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    unlockFragment$(id: number): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'unlockFragment', args: UnlockFragmentRequest.fromId(id) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    updateMarquee$(marquee: Marquee): Observable<Marquee> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'updateMarquee', args: new UpdateMarqueeRequest(marquee) };
                const deserialize = ReplyHandler.getBufferAsObject<Marquee>;
                return this.rpcRequest<Marquee>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
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
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'deleteMarquee', args: new DeleteMarqueeRequest(id) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.rpcRequest<number>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    listFiles$(subdir?: string): Observable<FileListResponse> {
        // args is {} for root, or { subdir: 'foo/bar' } for a subdir
        const args = subdir && subdir !== '/'
            ? { subdir: subdir.replace(/^\/+/, '') }
            : {};

        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, token }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'listFiles', args };
                const deserialize = ReplyHandler.getBufferAsObject as (buffer: Buffer) => FileListResponse;
                return this.rpcRequest<FileListResponse>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }

    uploadFile$(file: File): Observable<FileEntry> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection(),
            token: this.accessTokenService.getToken()
        }).pipe(
            // Read the file as bytes → base64 (no full string copies)
            switchMap(({ cfg, client, token }) =>
                from(file.arrayBuffer()).pipe(
                    map(buf => {
                        const b64 = Buffer.from(new Uint8Array(buf)).toString('base64');
                        return { cfg, client, token, b64 };
                    })
                )
            ),
            switchMap(({ cfg, client, token, b64 }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = {
                    function: 'uploadFile',
                    args: {
                        name: file.name,
                        contentType: file.type || 'application/octet-stream',
                        size: file.size,
                        bytes: b64
                    }
                };
                const deserialize = ReplyHandler.getBufferAsObject as (buffer: Buffer) => FileEntry;
                return this.rpcRequest<FileEntry>(client, Constants.reqTopic, replyTopic, payload, token, deserialize);
            })
        );
    }
}

