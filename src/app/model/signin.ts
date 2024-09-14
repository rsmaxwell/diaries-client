import { FormGroup } from "@angular/forms";

export class Signin {
    username: string;
    password: string;

    constructor() {
        this.username = ''
        this.password = ''
    }

    static fromFormGroup(form: FormGroup): Signin {
        let s = new Signin()
        s.username = form.value.username!
        s.password = form.value.password!
        return s
    }
}
