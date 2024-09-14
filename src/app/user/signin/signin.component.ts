import { Component, Input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, FormsModule, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { PlainfooterComponent } from "../../headers/plainfooter/plainfooter.component";
import { PlainheaderComponent } from "../../headers/plainheader/plainheader.component";
import { AlertsComponent } from "../../alerts/alerts.component";
import { AlertbuttonsComponent } from "../../alertbuttons/alertbuttons.component";
import { ActivatedRoute, Router } from '@angular/router';
import { AlertService } from '../../alert.service';
import { UserService } from '../user.service';
import { Signin } from '../../model/signin';

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
    AlertbuttonsComponent,
    PlainfooterComponent,
    PlainheaderComponent,
    AlertsComponent,
    AlertbuttonsComponent,
    CommonModule
  ],
  templateUrl: './signin.component.html',
  styleUrl: './signin.component.scss'
})
export class SigninComponent implements OnDestroy {

  @Input() title?: string;

  submitted = false;
  hide = true;
  subscription!: Subscription

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
    private userService: UserService,
    private alertService: AlertService
  ) { }


  onSubmit(): void {
    console.log("SigninComponent.onSubmit")

    // reset alerts on submit
    this.alertService.clear();

    var username = this.form.value.username!
    var password = this.form.value.password!

    // Stop here if form is invalid
    if (this.form.invalid) {
      return;
    }

    let value: Signin = Signin.fromFormGroup(this.form)
    this.subscription = this.userService.signin(value)
      .subscribe({
        next: (response: any) => {
          console.log(`SigninComponent.onSubmit: response: ${response}`)
          this.alertService.info(`username: '${value.username}' signed in`);
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
          this.router.navigateByUrl(returnUrl);
        },
        error: (err: any) => {
          console.log(`SigninComponent.onSubmit: signin: error: ${err}`)
          this.alertService.error(err);
        },
        complete: () => {
          console.log("SigninComponent.onSubmit: complete")
        }
      })
  }

  ngOnDestroy(): void {
    console.log("SigninComponent.ngOnDestroy")
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
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
