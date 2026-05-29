import { catchError, forkJoin, from, map, Observable, Subscriber, switchMap, tap, throwError } from "rxjs";
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
import { Router } from "@angular/router";

export class RpcError extends Error {
    constructor(
        public readonly status: number | undefined,
        public readonly statusMessage: string | undefined,
        public readonly payload?: Buffer
    ) {
        super(`Status ${status}: ${statusMessage}`);
        this.name = 'RpcError';
    }
}

@Injectable({ providedIn: 'root' })
export class RpcService {
    private readonly reqTopic = 'request';
    private subscribedTopics = new Set<string>();
    private listenerAttached = false;

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
        private refreshTokenService: RefreshTokenService,
        private router: Router
    ) {
        this.ensureListener()
    }

    // Register a single global message listener once
    private ensureListener(): void {
        from(this.mqtt.getConnection()).subscribe({
            next: client => {
                if (this.listenerAttached) {
                    return;
                }

                client.on('message', this.rpcDispatcher.bind(this));
                this.listenerAttached = true;

                console.log(
                    `RpcService.ensureListener: ListenerCount after attaching dispatcher:`,
                    client.listenerCount('message')
                );
            },
            error: err => console.error("RpcService.ensureListener: Error:", err)
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
                handler.observer.error(
                    new RpcError(undefined, 'Failed to parse status JSON', payload)
                );
                return;
            }
        }

        console.log(`rpcDispatcher: received status:`, status);
        //      console.log(`rpcDispatcher: raw userProperties.status:`, props?.userProperties?.["status"]);

        if (!status || status.code !== HttpStatusCode.Ok) {
            handler.observer.error(
                new RpcError(status?.code, status?.message, payload)
            );
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
                obs.error(new RpcError(undefined, 'Timeout'));
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

                console.log(`RpcService.rpcRequest: sending`, {
                    requestTopic,
                    function: (payload as any)?.function,
                    correlationId: corr,
                    replyTopic,
                    hasAccessToken: !!accessToken
                });

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

    private refreshAccessToken$(): Observable<RefreshTokenReply> {
        console.log('RpcService.refreshAccessToken$: refreshing access token');

        return this.refreshToken$().pipe(
            tap(reply => {
                console.log('RpcService.refreshAccessToken$: received new access token');
                this.accessTokenService.setToken(reply.accessToken);
            })
        );
    }

    private redirectToSignin(): void {
        this.accessTokenService.clearToken();
        this.refreshTokenService.clearToken();

        const returnUrl = this.router.url || '/';
        this.router.navigate(['/signin'], { queryParams: { returnUrl } });
    }

    private authorisedRpcRequest<R>(
        client: mqtt.MqttClient,
        replyTopic: string,
        payload: unknown,
        deserialize: (buf: Buffer) => R,
        timeout = 5000
    ): Observable<R> {

        const sendWithCurrentAccessToken$ = () => {
            const token = this.accessTokenService.getCurrentToken();

            if (!token) {
                return throwError(() => ({
                    status: HttpStatusCode.Unauthorized,
                    message: 'missing access token'
                }));
            }

            return this.rpcRequest<R>(
                client,
                Constants.reqTopic,
                replyTopic,
                payload,
                token,
                deserialize,
                timeout
            );
        };

        return sendWithCurrentAccessToken$().pipe(
            catchError(err => {
                if (err?.status !== HttpStatusCode.Unauthorized) {
                    return throwError(() => err);
                }

                console.warn('RpcService: access token missing/rejected; refreshing and retrying once');

                return this.refreshAccessToken$().pipe(
                    switchMap(() => sendWithCurrentAccessToken$()),
                    catchError(refreshOrRetryErr => {
                        console.warn(
                            'RpcService: refresh/retry failed; redirecting to signin',
                            refreshOrRetryErr
                        );

                        this.redirectToSignin();
                        return throwError(() => refreshOrRetryErr);
                    })
                );
            })
        );
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
            refreshToken: this.refreshTokenService.getToken()
        }).pipe(
            switchMap(({ cfg, client, refreshToken }) => {
                const username = this.accessTokenService.username ?? cfg.username;
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'refreshToken', args: new RefreshTokenRequest(username, refreshToken) };
                const deserialize = ReplyHandler.getBufferAsObject as (buffer: Buffer) => RefreshTokenReply;
                return this.rpcRequest<RefreshTokenReply>(client, Constants.reqTopic, replyTopic, payload, null, deserialize);
            })
        );
    }

    updateDiary$(diary: Diary): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'updateDiary', args: UpdateDiaryRequest.fromDiary(diary) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.authorisedRpcRequest<number>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }

    normaliseDiaries$(): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'normaliseDiaries' };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.authorisedRpcRequest<number>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }

    normalisePages$(): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'normalisePages' };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.authorisedRpcRequest<number>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }

    normaliseFragments$(year: number, month: number, day: number): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'normaliseFragments', args: new NormaliseFragmentsRequest(year, month, day) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.authorisedRpcRequest<number>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }

    updatePage$(page: Page): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'updatePage', args: UpdatePageRequest.fromPage(page) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.authorisedRpcRequest<number>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }

    addMarquee$(page: Page, fragmentId: number, rect: Rectangle): Observable<Marquee> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = {
                    function: 'addMarquee',
                    args: new AddMarqueeRequest(page.id, fragmentId, rect)
                };
                const deserialize = ReplyHandler.getBufferAsObject<Marquee>;

                return this.authorisedRpcRequest<Marquee>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }

    addFragment$(request: AddFragmentRequest): Observable<Fragment> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());

                const payload = {
                    function: 'addFragment',
                    args: request
                };

                const deserialize = ReplyHandler.getBufferAsObject<Fragment>;

                return this.authorisedRpcRequest<Fragment>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }

    updateFragment$(fragment: Fragment): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'updateFragment', args: UpdateFragmentRequest.fromFragment(fragment) };
                const deserialize = ReplyHandler.getBufferAsNumber
                return this.authorisedRpcRequest<number>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }

    deleteFragment$(id: number): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = {
                    function: 'deleteFragment',
                    args: new DeleteFragmentRequest(id)
                };
                const deserialize = ReplyHandler.getBufferAsNumber;

                return this.authorisedRpcRequest<number>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }

    lockFragment$(id: number): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'lockFragment', args: LockFragmentRequest.fromId(id) };
                const deserialize = ReplyHandler.getBufferAsNumber

                return this.authorisedRpcRequest<number>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }

    unlockFragment$(id: number): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'unlockFragment', args: UnlockFragmentRequest.fromId(id) };
                const deserialize = ReplyHandler.getBufferAsNumber

                return this.authorisedRpcRequest<number>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }

    updateMarquee$(marquee: Marquee): Observable<Marquee> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'updateMarquee', args: new UpdateMarqueeRequest(marquee) };
                const deserialize = ReplyHandler.getBufferAsObject<Marquee>;

                return this.authorisedRpcRequest<Marquee>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }

    deleteMarquee$(id: number): Observable<number> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'deleteMarquee', args: new DeleteMarqueeRequest(id) };
                const deserialize = ReplyHandler.getBufferAsNumber

                return this.authorisedRpcRequest<number>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
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
            client: this.mqtt.getConnection()
        }).pipe(
            switchMap(({ cfg, client }) => {
                const replyTopic = Constants.replyTopic(this.mqtt.getClientId());
                const payload = { function: 'listFiles', args };
                const deserialize = ReplyHandler.getBufferAsObject as (buffer: Buffer) => FileListResponse;

                return this.authorisedRpcRequest<FileListResponse>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }

    uploadFile$(file: File): Observable<FileEntry> {
        return forkJoin({
            cfg: this.configService.getConfig(),
            client: this.mqtt.getConnection()
        }).pipe(
            // Read the file as bytes → base64 (no full string copies)
            switchMap(({ cfg, client }) =>
                from(file.arrayBuffer()).pipe(
                    map(buf => {
                        const b64 = Buffer.from(new Uint8Array(buf)).toString('base64');
                        return { cfg, client, b64 };
                    })
                )
            ),
            switchMap(({ cfg, client, b64 }) => {
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

                return this.authorisedRpcRequest<FileEntry>(
                    client,
                    replyTopic,
                    payload,
                    deserialize
                );
            })
        );
    }
}

