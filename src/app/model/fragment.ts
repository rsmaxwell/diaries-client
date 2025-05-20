import { Marquee } from "./marquee";

export interface Fragment {
    id: number;
    year: number;
    month: number;
    day: number;
    sequence: number;
    marquee: Marquee;
    text: string;
}
