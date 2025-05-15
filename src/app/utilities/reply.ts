import { HttpStatusCode } from "@angular/common/http"
import { Diary } from "../diary/diary"
import { Marquee } from "../model/marquee/marquee"
import { Page } from "../page/page"


export interface Reply {
    code: number
};
export interface ErrorReply extends Reply {
    message: string
};
export interface RegisterReply extends Reply {
    id: number
};
export interface SigninReply extends Reply {
    accessToken: string
    refreshToken: string
    refreshPeriod: number
    id: number
};
export interface GetDiaryReply extends Reply {
    diary: Diary
    pages: Page[];
};

export interface GetPageReply extends Reply {
    page: Page
    marquees: Marquee[];
};
export interface GetPagesReply extends Reply {
    pages: Page[]
};
export interface RequestTokenReply extends Reply {
    accessToken: string
};
export interface AddFragmentReply extends Reply {
    id: number
};





export function getUnexpectedReplyMessage(obj: any): string {

    console.log(`typeof obj: ${typeof obj}`);

    if (!(typeof obj === 'object')) {
        return (`Reply is not an object!`);
    } else if (!('code' in obj && typeof obj.code === 'number')) {
        return (`Unexpected reply`);
    } else if (!('message' in obj && typeof obj.message === 'string')) {
        return (`${obj["code"]}: Unexpected`);
    } else {
        return (`${obj["code"]}: ${obj["message"]}`);
    }
}
export function isRegisterReply(obj: any): obj is RegisterReply {
    return obj !== null &&
        typeof obj === 'object' &&
        'code' in obj && typeof obj.code === 'number' &&
        'id' in obj && typeof obj.id === 'number';
}
export function isSigninReply(obj: any): obj is SigninReply {
    return obj !== null &&
        typeof obj === 'object' &&
        'accessToken' in obj && typeof obj.accessToken === 'string' &&
        'refreshToken' in obj && typeof obj.refreshToken === 'string' &&
        'refreshPeriod' in obj && typeof obj.refreshPeriod === 'number' &&
        'id' in obj && typeof obj.id === 'number';
}
export function isGetDiaryReply(obj: any): obj is GetDiaryReply {
    return obj !== null &&
        typeof obj === 'object' &&
        'diary' in obj && typeof obj.diary === 'object' &&
        'pages' in obj && Array.isArray(obj.pages);
}
export function isGetPageReply(obj: any): obj is GetPageReply {
    return obj !== null &&
        typeof obj === 'object' &&
        'code' in obj && typeof obj.code === 'number' &&
        'page' in obj && typeof obj.page === 'object' &&
        'fragments' in obj && Array.isArray(obj.fragments);
}
export function isGetPagesReply(obj: any): obj is GetPagesReply {
    return obj !== null &&
        typeof obj === 'object' &&
        'code' in obj && typeof obj.code === 'number' &&
        'pages' in obj && Array.isArray(obj.pages);
}
export function isRequestTokenReply(obj: any): obj is RequestTokenReply {
    return obj !== null &&
        typeof obj === 'object' &&
        'code' in obj && typeof obj.code === 'number' &&
        'accessToken' in obj && typeof obj.accessToken === 'string';
}

export interface Status {
    code: number
    message: string
};
export function isStatus(obj: any): obj is Status {
    return obj !== null &&
        typeof obj === 'object' &&
        'code' in obj && typeof obj.code === 'number' &&
        'message' in obj && typeof obj.message === 'string';
}

export function checkReplyStatus(props: any): boolean {

    let status: Status;
    try {
        status = JSON.parse(props.userProperties.status) as Status;
    } catch (err) {
        console.log(`FragmentServiceAdd: Failed to parse status: ${err}`); 
        return false;
    }

    if (status.code != HttpStatusCode.Ok) {
        console.log(`FragmentServiceAdd: Bad reply status code: ${status.code}: ${status.message}`); 
        return false;
    }

    return true;
}