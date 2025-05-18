
import { Page } from "./page"
import { Marquee } from "./marquee"


export interface Reply {
    code: number
};
export interface ErrorReply extends Reply {
    message: string
};




export interface RequestTokenReply extends Reply {
    accessToken: string
};





