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
    
    updateId(id: number) {
        this.id = id;
    }
}

export class AddFragmentRequest {
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

export class UpdateFragmentRequest {
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

export class DeleteFragmentRequest {
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
    
    static fromFragment(fragment: Fragment) {
        return new Marquee(fragment.id, new Rectangle(fragment.x, fragment.y, fragment.width, fragment.height));
      }
}
