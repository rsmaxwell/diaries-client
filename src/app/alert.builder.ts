import { Alert, AlertType } from "./alert.model";


export class AlertBuilder {

    private alert: Alert = new Alert();

    autoClose(value: boolean) {
        this.alert.autoClose = value;
        return this;
    }

    id(id: string) {
        this.alert.id = id;
        return this;
    }

    message(message: string) {
        this.alert.message = message;
        return this;
    }

    keepAfterRouteChange(value: boolean) {
        this.alert.keepAfterRouteChange = value;
        return this;
    }

    type(type: AlertType) {
        this.alert.type = type;
        return this;
    }

    dump(dump: any) {
        this.alert.dump = dump;
        return this;
    }

    build(): Alert {
        return this.alert;
    }
}