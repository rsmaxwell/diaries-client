export class Fragment {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    style: string;

    constructor(id: string, x: number, y: number, width: number, height: number, style: string) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.style = style;
    }
}
