
export class Alert {

    private static nextId = 0

    id: number;
    type: AlertType;
    message: string;
    autoClose: boolean;
    dump!: string;

    constructor() {
        this.id = Alert.nextId++
        this.autoClose = false
        this.message = ""
        this.type = AlertType.Success
    }
}

export enum AlertType {
    Success,
    Error,
    Info,
    Warning
}