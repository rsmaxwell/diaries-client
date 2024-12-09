
import { Connection } from "./connection";
import { Signin } from "./signin";


export class AuthorisedConnection {
    connection: Connection
    accessToken: string
    refreshToken: string
    refreshPeriod: number
    signin: Signin
    id: number

    constructor(connection: Connection, accessToken: string, refreshToken: string, refreshPeriod: number, signin: Signin, id: number) {
        this.connection = connection
        this.accessToken = accessToken
        this.refreshToken = refreshToken
        this.refreshPeriod = refreshPeriod
        this.signin = signin
        this.id = id
    }
}
