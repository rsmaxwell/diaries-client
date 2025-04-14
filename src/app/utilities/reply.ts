import { Diary } from "../diary/diary"


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
};

export interface GetDiariesReply extends Reply {
    diaries: Diary[]
};
