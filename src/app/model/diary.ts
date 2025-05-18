import { Diary } from "../diary/diary";
import { Page } from "./page";
import { Reply } from "./reply";

export interface diary {
    id: number;
    name: string;
}

export interface GetDiaryReply extends Reply {
    diary: Diary
    pages: Page[];
};
