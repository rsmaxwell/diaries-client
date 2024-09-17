import { RouterModule, Routes } from '@angular/router';
import { ThingComponent } from './thing/thing.component';
import { DiariesComponent } from './diaries/diaries.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { DiaryComponent } from './diary/diary.component';
import { SigninComponent } from './user/signin/signin.component';
import { RegisterComponent } from './user/register/register.component';
import { AuthGuard } from './auth.guard';

exports: [ RouterModule ]

export const routes: Routes = [
    { path: '', redirectTo: 'diaries', pathMatch: 'full' },
    { path: 'register', component: RegisterComponent },
    { path: 'signin', component: SigninComponent },
    { path: 'dashboard', component: DashboardComponent },
    { path: 'diaries', component: DiariesComponent, canActivate: [AuthGuard] },
    { path: 'diary/:id', component: DiaryComponent, canActivate: [AuthGuard] },
    { path: 'thing', component: ThingComponent }
];
