import { Marquee } from "./marquee";

export interface Fragment {
    id: number;
    sequence: number;
    marquee: Marquee;
    text: string;
}
