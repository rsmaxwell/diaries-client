import { Rectangle } from "../../utilities/rectangle";

export class Fragment {
    clientId: string;
    id?: number;
    x: number;
    y: number;
    width: number;
    height: number;

    constructor(clientId: string, rectangle: Rectangle) {
        this.clientId = clientId;
        this.x = rectangle.x;
        this.y = rectangle.y;
        this.width = rectangle.width;
        this.height = rectangle.height;
    }
}

export class AddFragmentRequest {
    pageId: number;
    x: number;
    y: number;
    width: number;
    height: number;

    constructor(pageId: number, x: number, y: number, width: number, height:number) {
        this.pageId = pageId;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
}