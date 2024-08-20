
export class Alert {

    public static readonly defaultId = 'default-alert';

    id!: string;
    type!: AlertType;
    message!: string;
    autoClose!: boolean;
    keepAfterRouteChange?: boolean;
    fade!: boolean;
    dump!: {};

    constructor() {
        this.id = Alert.defaultId
        this.autoClose = false
        this.keepAfterRouteChange = false
    }
}

export enum AlertType {
    Success,
    Error,
    Info,
    Warning
}