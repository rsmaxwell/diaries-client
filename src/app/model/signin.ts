import { FormGroup } from "@angular/forms";

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
