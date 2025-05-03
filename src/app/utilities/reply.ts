import { Diary } from "../diary/diary"
import { Fragment } from "../model/fragment/fragment"
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
export type GetDiariesReply = Diary[];

export interface GetPageReply extends Reply {
    page: Page
    fragments: Fragment[];
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
    if (!(typeof obj === 'object')) {
        return(`Reply is not an object!`);
    } else if (!('code' in obj && typeof obj.code === 'number')) {
        return(`Unexpected reply`);
    } else if (!('message' in obj && typeof obj.message === 'string')) {
        return(`${obj["code"]}: Unexpected`);
    } else {
        return(`${obj["code"]}: ${obj["message"]}`);
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
export function isGetDiariesReply(obj: any): obj is Diary[] {
    return Array.isArray(obj) &&
        obj.every(d => typeof d === 'object' && 'id' in d && 'name' in d);
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
export function isAddFragmentReply(obj: any): obj is AddFragmentReply {
    return obj !== null &&
        typeof obj === 'object' &&
        'code' in obj && typeof obj.code === 'number' &&
        'id' in obj && typeof obj.id === 'number';
}
