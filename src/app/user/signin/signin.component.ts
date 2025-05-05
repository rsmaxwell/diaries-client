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
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../alerts/alert.service';
import { Signin } from '../../model/signin';
import { MqttSigninService } from '../mqtt.signin.service';

@Component({
  selector: 'app-signin.page',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    PlainfooterComponent,
    PlainheaderComponent,
    CommonModule
  ],
  templateUrl: './signin.component.html',
  styleUrl: './signin.component.scss'
})
export class SigninComponent implements OnDestroy {

  @Input() title?: string;

  hide = true;

  username = new FormControl('', [
    Validators.required,
    Validators.minLength(3),
    Validators.maxLength(20),
  ])
  password = new FormControl('', [
    Validators.required
  ]);

  form = new FormGroup({
    username: this.username,
    password: this.password
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mqttSigninService: MqttSigninService,
    private alertService: AlertService
  ) { }


  onSubmit(): void {
    console.log("SigninComponent.onSubmit")

    // reset alerts on submit
    this.alertService.clear();

    // Stop here if form is invalid
    if (this.form.invalid) {
      return;
    }

    let value: Signin = Signin.fromFormGroup(this.form)
    this.mqttSigninService.signin(value)
      .then(() => {
          console.log(`SigninComponent.onSubmit: success`)

          this.alertService.info(`${value.username} signed in`);
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
          this.router.navigateByUrl(returnUrl)
        })
      .catch((err) => {
          console.log(`SigninComponent.onSubmit: error: ${err}`)
          this.alertService.error(err);
      });
  }

  ngOnDestroy(): void {
    console.log("SigninComponent.ngOnDestroy")
  }

  onRegister(): void {
    console.log(`RegisterComponent.onRegister()`);
    this.router.navigateByUrl('register');
  }

  getErrorMessage(formControl: FormControl) {
    if (formControl.hasError('required')) {
      return "This field is required";
    }

    return '';
  }
}
