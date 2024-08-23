import { RouterModule, Routes } from '@angular/router';
import { PagesComponent } from './pages/pages.component';
import { DiariesComponent } from './diaries/diaries.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { DiaryComponent } from './diary/diary.component';
import { SigninPageComponent } from './signin.page/signin.page.component';
import { DumpComponent } from './dump/dump.component';

exports: [ RouterModule ]

export const routes: Routes = [
    { path: '', redirectTo: 'signin', pathMatch: 'full' },
    { path: 'signin', component: SigninPageComponent },
    { path: 'dashboard', component: DashboardComponent },
    { path: 'diaries', component: DiariesComponent },
    { path: 'pages', component: PagesComponent },
    { path: 'diary/:id', component: DiaryComponent },
    { path: 'dump', component: DumpComponent },
];
