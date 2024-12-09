import { FormGroup } from "@angular/forms";

export class Refresh {
    username: string;
    token: string;

    constructor(username: string, token: string) {
        this.username = username
        this.token = token
    }
}
