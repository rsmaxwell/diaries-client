import { Component, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { PlainfooterComponent } from "../../headers/plainfooter/plainfooter.component";
import { PlainheaderComponent } from "../../headers/plainheader/plainheader.component";
import { AlertsComponent } from "../../alerts/alerts.component";
import { AlertbuttonsComponent } from "../../alertbuttons/alertbuttons.component";
import { Router } from '@angular/router';
import { AlertService } from '../../alerts/alert.service';
import { PasswordStrength } from '../../utilities/passwordStrength';
import { Register } from '../../model/register';
import { MqttRegisterService } from '../mqtt.register.service';

@Component({
  selector: 'app-register.page',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    AlertbuttonsComponent,
    PlainfooterComponent,
    PlainheaderComponent,
    AlertsComponent,
    AlertbuttonsComponent,
    CommonModule
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent implements OnDestroy {

  @Input() title?: string;

  private submitted = false;

  hide = true;

  firstname = new FormControl('', [
    Validators.required,
    Validators.minLength(3),
    Validators.maxLength(20),
  ])
  lastname = new FormControl('', [
    Validators.required,
    Validators.minLength(3),
    Validators.maxLength(20),
  ])
  username = new FormControl('', [
    Validators.required,
    Validators.minLength(3),
    Validators.maxLength(20),
  ])
  email = new FormControl('', [
    Validators.required,
    Validators.email
  ])
  knownas = new FormControl('', [
    Validators.required,
    Validators.minLength(2),
    Validators.maxLength(20),
  ])
  phone = new FormControl('', [
    Validators.required,
    Validators.pattern("\\+?[0-9 ]*"),
    Validators.maxLength(20),
  ])
  password = new FormControl('', [
    Validators.required,
    PasswordStrength.createValidator()
  ]);

  form = new FormGroup({
    firstname: this.firstname,
    lastname: this.lastname,
    username: this.username,
    email: this.email,
    knownas: this.knownas,
    phone: this.phone,
    password: this.password
  });


  constructor(
    private router: Router,
    private mqttRegisterService: MqttRegisterService,
    private alertService: AlertService
  ) { }

  onSubmit(): void {
    console.log(`RegisterComponent.onSubmit()`);

    // reset alerts on submit
    this.alertService.clear();

    // stop here if form is invalid
    if (this.form.invalid) {
      return;
    }

    let value: Register = Register.fromFormGroup(this.form)

    this.mqttRegisterService.register(value)
      .then((id) => {
        console.log(`RegisterComponent.registered: '${value.username}' registered with id: '${id}'`)
        this.alertService.info(`username: '${value.username}' registered with id: '${id}'`);
        this.router.navigateByUrl('signin');
      })
      .catch((error) => {
        console.log(`RegisterComponent.onSubmit: error registering: '${error.message}'`)
        this.alertService.error(error.message);
      })
  }

  ngOnDestroy(): void {
    console.log("RegisterComponent.ngOnDestroy")
  }

  onSignin(): void {
    console.log(`RegisterComponent.onSignin()`);
    this.router.navigateByUrl('signin');
  }

  getErrorMessage(formControl: FormControl) {
    if (formControl.hasError('required')) {
      return "This field is required";
    }
    if (formControl.hasError('minlength')) {
      let requiredLength = formControl.errors!['minlength'].requiredLength
      return "The minimum length for this field is " + String(requiredLength) + " characters.";
    }
    if (formControl.hasError('maxlength')) {
      let requiredLength = formControl.errors!['maxlength'].requiredLength
      return "The maximum length for this field is " + String(requiredLength) + " characters.";
    }
    if (formControl.hasError('email')) {
      return "Not a valid email address";
    }
    if (formControl.hasError('pattern')) {
      return "Not a valid phone number";
    }
    if (formControl.hasError('passwordStrength')) {
      let key = formControl.errors!['passwordStrength']
      return PasswordStrength.getErrorMessage(key)
    }

    return '';
  }
}
