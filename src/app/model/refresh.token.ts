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
    token: string;

    constructor(token: string) {
        this.token = token;
    }
}
