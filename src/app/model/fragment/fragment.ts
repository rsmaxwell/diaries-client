import { Rectangle } from "../../utilities/rectangle";

export class Fragment {
    id: number;
    pageId: number;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;

    constructor(id: number, pageId: number, rectangle: Rectangle, text: string) {
        this.id = id;
        this.pageId = pageId;
        this.x = rectangle.x;
        this.y = rectangle.y;
        this.width = rectangle.width;
        this.height = rectangle.height;
        this.text = text;
    }
}

export class AddFragmentRequest {
    pageId: number;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;

    constructor(pageId: number, x: number, y: number, width: number, height:number, text: string) {
        this.pageId = pageId;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.text = text;
    }
}

export class UpdateFragmentRequest {
    id: number;
    pageId: number;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;

    constructor(id: number, pageId: number, x: number, y: number, width: number, height:number, text: string) {
        this.id = id;
        this.pageId = pageId;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.text = text;
    }
}

