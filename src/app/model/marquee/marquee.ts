import { Rectangle } from "../../utilities/rectangle";

export class AddMarqueeRequest {
    pageId: number;
    x: number;
    y: number;
    width: number;
    height: number;

    constructor(pageId: number, rectangle: Rectangle) {
        this.pageId = pageId;
        this.x = rectangle.x;
        this.y = rectangle.y;
        this.width = rectangle.width;
        this.height = rectangle.height;
    }
}

export class UpdateMarqueeRequest {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;

    constructor(marquee: Marquee) {
        this.id = marquee.id;
        this.x = marquee.rectangle.x;
        this.y = marquee.rectangle.y;
        this.width = marquee.rectangle.width;
        this.height = marquee.rectangle.height;
    }
}

export class DeleteMarqueeRequest {
    id: number;

    constructor(marquee: Marquee) {
        this.id = marquee.id;
    }
}

export class Marquee {
    id: number;
    rectangle: Rectangle;

    constructor(id: number, rectangle: Rectangle) {
        this.id = id;
        this.rectangle = rectangle;
    }
}

export class MarqueeReply {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;

    constructor(id: number, rectangle: Rectangle) {
        this.id = id;
        this.x = rectangle.x;
        this.y = rectangle.y;
        this.width = rectangle.width;
        this.height = rectangle.height;
    }
}

