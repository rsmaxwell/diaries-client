import { FormGroup } from "@angular/forms";
import { Reply } from "./reply";

export class Signin {
    username: string;
    password: string;

    constructor(username: string, password: string) {
        this.username = username
        this.password = password
    }

    static fromFormGroup(form: FormGroup): Signin {
        return new Signin(form.value.username, form.value.password)
    }
}

export class SigninRequest extends Signin {
    constructor(signin: Signin) {
        super(
            signin.username,
            signin.password
        );
    }
}

export interface SigninReply extends Reply {
    accessToken: string
    refreshToken: string
    refreshPeriod: number
    id: number
};