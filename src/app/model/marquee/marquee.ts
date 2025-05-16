import { Rectangle } from "../../utilities/rectangle";

export class AddMarqueeRequest {
    pageId: number;
    x: number;
    y: number;
    width: number;
    height: number;
    sequence: number;

    constructor(pageId: number, rectangle: Rectangle, sequence: number) {
        this.pageId = pageId;
        this.x = rectangle.x;
        this.y = rectangle.y;
        this.width = rectangle.width;
        this.height = rectangle.height;
        this.sequence = sequence;
    }
}

export class UpdateMarqueeRequest {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    sequence: number;

    constructor(marquee: Marquee) {
        this.id = marquee.id;
        this.x = marquee.rectangle.x;
        this.y = marquee.rectangle.y;
        this.width = marquee.rectangle.width;
        this.height = marquee.rectangle.height;
        this.sequence = marquee.sequence;
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
    sequence: number;

    constructor(id: number, rectangle: Rectangle) {
        this.id = id;
        this.rectangle = rectangle;
        this.sequence = 0;
    }
}

export class MarqueeReply {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    sequence: number;

    constructor(id: number, rectangle: Rectangle, sequence: number) {
        this.id = id;
        this.x = rectangle.x;
        this.y = rectangle.y;
        this.width = rectangle.width;
        this.height = rectangle.height;
        this.sequence = sequence;
    }
}

