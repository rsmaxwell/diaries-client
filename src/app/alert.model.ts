
export class Alert {

    private static nextId = 0

    id: number;
    type!: AlertType;
    message!: string;
    autoClose!: boolean;
    fade!: boolean;
    dump!: {};

    constructor() {
        this.id = Alert.nextId++
        this.autoClose = false
    }
}

export enum AlertType {
    Success,
    Error,
    Info,
    Warning
}