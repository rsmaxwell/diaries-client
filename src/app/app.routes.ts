import { RouterModule, Routes } from '@angular/router';
import { ThingComponent } from './thing/thing.component';
import { DiariesComponent } from './diaries/diaries.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { DiaryComponent } from './diary/diary.component';
import { SigninComponent } from './user/signin/signin.component';
import { RegisterComponent } from './user/register/register.component';

exports: [ RouterModule ]

export const routes: Routes = [
    { path: '', redirectTo: 'signin', pathMatch: 'full' },
    { path: 'register', component: RegisterComponent },
    { path: 'signin', component: SigninComponent },
    { path: 'dashboard', component: DashboardComponent },
    { path: 'diaries', component: DiariesComponent },
    { path: 'diary/:id', component: DiaryComponent },
    { path: 'thing', component: ThingComponent }
];
