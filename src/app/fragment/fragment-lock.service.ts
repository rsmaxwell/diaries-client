import { Injectable } from '@angular/core';
import { firstValueFrom, take } from 'rxjs';
import { RpcService } from '../mqtt/rpc.service';
import { AlertService } from '../alerts/alert.service';
import { RpcError } from '../mqtt/rpc.service';
import { HttpStatusCode } from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class FragmentLockService {

    constructor(
        private rpcService: RpcService,
        private alertService: AlertService
    ) { }

    async lockFragmentForEdit(fragmentId: number): Promise<boolean> {
        try {
            console.log(`FragmentLockService: locking fragment ${fragmentId} for edit`);

            await firstValueFrom(
                this.rpcService.lockFragment$(fragmentId).pipe(take(1))
            );

            console.log(`FragmentLockService: locked fragment ${fragmentId} for edit`);
            return true;

        } catch (err: unknown) {
            if (err instanceof RpcError && err.status === HttpStatusCode.Conflict) {
                console.info(
                    `FragmentLockService: fragment ${fragmentId} is already locked by another session`
                );

                this.alertService.info('This fragment is already locked by another session');
                return false;
            }

            console.warn(
                `FragmentLockService: failed to lock fragment ${fragmentId} for edit`,
                err
            );

            this.alertService.error('Could not lock the fragment');
            return false;
        }
    }

    async unlockFragmentAfterFailedEdit(fragmentId: number): Promise<void> {
        try {
            console.log(`FragmentLockService: unlocking fragment ${fragmentId} after failed edit`);

            await firstValueFrom(
                this.rpcService.unlockFragment$(fragmentId)
            );

        } catch (err) {
            console.warn(
                `FragmentLockService: failed to unlock fragment ${fragmentId} after failed edit`,
                err
            );
        }
    }
}