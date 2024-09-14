import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export class PasswordStrength {

    static createValidator(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {

            const value = control.value;

            if (!value) {
                return { passwordStrength: 'required' };
            }

            const hasUpperCase = /[A-Z]+/.test(value);
            if (!hasUpperCase) {
                return { passwordStrength: 'hasUpperCase' };
            }

            const hasLowerCase = /[a-z]+/.test(value);
            if (!hasLowerCase) {
                return { passwordStrength: 'hasLowerCase' };
            }

            const hasNumeric = /[0-9]+/.test(value);
            if (!hasNumeric) {
                return { passwordStrength: 'hasNumeric' };
            }

            const hasSpecial = /[!@#$£%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(value);
            if (!hasSpecial) {
                return { passwordStrength: 'hasSpecial' };
            }

            const isLongEnough = value.length > 12;
            if (!isLongEnough) {
                return { passwordStrength: 'isLongEnough' };
            }

            return null;
        }
    }

    static messages: any = {
        required: 'You must enter a value',
        hasUpperCase: 'Needs an uppercase character',
        hasLowerCase: 'Needs an lowercase character',
        hasNumeric: 'Needs a numeric character',
        hasSpecial: 'Needs a special character',
        isLongEnough: 'Needs more characters'
    }

    static getErrorMessage(key: any) {
        return PasswordStrength.messages[key] || '';
    }
}