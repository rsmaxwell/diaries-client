import { FormGroup } from "@angular/forms";

export class RefreshToken {
    username: string;
    refreshToken: string;

    constructor(username: string, token: string) {
        this.username = username
        this.refreshToken = token
    }
}

export class RefreshTokenRequest extends RefreshToken {
}

export class RefreshTokenReply {
    accessToken: string;
    refreshPeriod: number;

    constructor(token: string, refreshPeriod: number) {
        this.accessToken = token;
        this.refreshPeriod = refreshPeriod;
    }
}
