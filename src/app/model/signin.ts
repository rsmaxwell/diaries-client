import { FormGroup } from "@angular/forms";
import { Reply } from "./reply";

export class Signin {
    username: string;
    password: string;
    sessionId: string;

    constructor(username: string, password: string, sessionId: string = Signin.newSessionId()) {
        this.username = username;
        this.password = password;
        this.sessionId = sessionId;
    }

    static fromFormGroup(form: FormGroup): Signin {
        return new Signin(form.value.username, form.value.password);
    }

    static newSessionId(): string {
        const key = "diaries.sessionId";
        const existing = sessionStorage.getItem(key);
        if (existing) return existing;

        const id = (crypto as any).randomUUID ? crypto.randomUUID() : (() => {
            const bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
        })();

        sessionStorage.setItem(key, id);
        return id;
    }
}

export class SigninRequest extends Signin {
    constructor(signin: Signin) {
        super(signin.username, signin.password, signin.sessionId);
    }
}

export interface SigninReply extends Reply {
    accessToken: string;
    refreshToken: string;
    refreshPeriod: number;
    userId: number;
    username: string;
    knownas: string;
}