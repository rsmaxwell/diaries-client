import { Alert, AlertType } from "./alert.model";


export class AlertBuilder {

    private alert: Alert = new Alert();

    autoClose(value: boolean) {
        console.log(`AlertBuilder.autoClose; value: ` + value)
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

    dump(dump: any) {
        this.alert.dump = dump;
        return this;
    }

    success() {
        this.alert.type = AlertType.Success;
        return this;
    }

    error() {
        this.alert.type = AlertType.Error;
        return this;
    }

    info() {
        this.alert.type = AlertType.Info;
        return this;
    }

    warning() {
        this.alert.type = AlertType.Warning;
        return this;
    }

    build(): Alert {
        console.log(`AlertBuilder.build; this.alert.autoClose: ` + this.alert.autoClose)
        return this.alert;
    }
}