import { FormGroup } from "@angular/forms";
import { User } from "./user";
import { Reply } from "./reply";


export class Register {
    firstname: string;
    lastname: string;
    username: string;
    password: string;
    knownas: string;
    email: string;
    phone: string;

    constructor(firstname: string, lastname: string, username: string, password: string, knownas: string, email: string, phone: string) {
        this.firstname = firstname;
        this.lastname = lastname;
        this.username = username;
        this.password = password;
        this.knownas = knownas;
        this.email = email;
        this.phone = phone;
    }

    static fromUser(user: User): Register {
        let reg = new Register(
            user.firstname,
            user.lastname,
            user.username,
            '',
            user.knownas,
            user.email,
            user.phone,
        );
        return reg
    }

    static fromFormGroup(form: FormGroup): Register {
        let reg = new Register(
            form.value.firstname,
            form.value.lastname,
            form.value.username,
            form.value.password,
            form.value.knownas,
            form.value.email,
            form.value.phone
        );
        return reg
    }
}

export class RegisterRequest extends Register {

    constructor(register: Register) {
        super(
            register.firstname,
            register.lastname,
            register.username,
            register.password,
            register.knownas,
            register.email,
            register.phone,
        );
    }
}


export interface RegisterReply extends Reply {
    id: number
};

