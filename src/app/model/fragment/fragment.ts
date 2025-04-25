import { Rectangle } from "../../utilities/rectangle";

export class Fragment {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;

    constructor(id: string, rectangle: Rectangle) {
        this.id = id;
        this.x = rectangle.x;
        this.y = rectangle.y;
        this.width = rectangle.width;
        this.height = rectangle.height;
    }
}
