import { Injectable } from "@angular/core";
import { TokenService } from "./tokenService";

@Injectable({ providedIn: 'root' })
export class AccessTokenService extends TokenService {}