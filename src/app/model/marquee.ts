import { Rectangle } from "../utilities/rectangle";

export class Marquee {
    id: number;
    version: number;
    fragmentId: number;
    pageId: number;
    rectangle: Rectangle;

    constructor(id: number, version: number, fragmentId: number, pageId: number, rectangle: Rectangle) {
        this.id = id;
        this.version = version;
        this.fragmentId = fragmentId;
        this.pageId = pageId;
        this.rectangle = rectangle;
    }
}

export class AddMarqueeRequest {
    pageId: number;
    fragmentId: number;
    x: number;
    y: number;
    width: number;
    height: number;

    constructor(pageId: number, fragmentId: number, rectangle: Rectangle) {
        this.pageId = pageId;
        this.fragmentId = fragmentId;
        this.x = rectangle.x;
        this.y = rectangle.y;
        this.width = rectangle.width;
        this.height = rectangle.height;
    }
}

export class UpdateMarqueeRequest {
    id: number;
    version: number;
    fragmentId: number;
    pageId: number;
    x: number;
    y: number;
    width: number;
    height: number;

    constructor(marquee: Marquee) {
        this.id = marquee.id;
        this.version = marquee.version;
        this.fragmentId = marquee.fragmentId;
        this.pageId = marquee.pageId;
        this.x = marquee.rectangle.x;
        this.y = marquee.rectangle.y;
        this.width = marquee.rectangle.width;
        this.height = marquee.rectangle.height;
    }
}

export class DeleteMarqueeRequest {
    id: number;

    constructor(id: number) {
        this.id = id;
    }
}

export class MarqueeReply {
    id: number;
    fragmentId: number;
    rectangle: Rectangle;

    constructor(id: number, fragmentId: number, rectangle: Rectangle) {
        this.id = id;
        this.fragmentId = fragmentId;
        this.rectangle = rectangle;
    }
}

