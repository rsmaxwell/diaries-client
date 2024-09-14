import { FormGroup } from "@angular/forms";
import { User } from "./user";


export class Register {
    firstname: string;
    lastname: string;
    username: string;
    password: string;
    knownas: string;
    email: string;
    phone: string;

    constructor() {
        this.firstname = ''
        this.lastname = ''
        this.username = ''
        this.password = ''
        this.knownas = ''
        this.email = ''
        this.phone = ''
    }

    static fromPerson(user: User): Register {
        let reg = new Register()
        reg.firstname = user.firstname
        reg.lastname = user.lastname
        reg.username = user.username
        reg.password = ''
        reg.knownas = user.knownas
        reg.email = user.email
        reg.phone = user.phone
        return reg
    }

    static fromFormGroup(form: FormGroup): Register {
        let reg = new Register()
        reg.firstname = form.value.firstname!
        reg.lastname = form.value.lastname!
        reg.username = form.value.username!
        reg.password = form.value.password!
        reg.knownas = form.value.knownas!
        reg.email = form.value.email!
        reg.phone = form.value.phone!
        return reg
    }
}


