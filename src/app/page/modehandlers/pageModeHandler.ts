import { Rectangle } from "../../utilities/rectangle";




// interface for handler
export abstract class PageModeHandler {

    constructor(
        protected svg: SVGSVGElement
    ) {}    

    abstract onClick(event: MouseEvent): void;
    abstract onMouseMove(event: MouseEvent): void;
    abstract onMouseUp(event: MouseEvent): void;
    abstract onMouseDown(event: MouseEvent): void;
    abstract onWheel(event: WheelEvent): void;

    hasViewBox(): boolean { return false; }
    getViewBox(): string { return ""; }

    hasRectangleInProgress(): boolean { return false; }
    hasRectangleComplete(): boolean { return false; }
    getRectangle(): Rectangle { return new Rectangle(0,0,0,0); }
  }
  

  