import { RouterModule, Routes } from '@angular/router';
import { PagesComponent } from './pages/pages.component';
import { DiariesComponent } from './diaries/diaries.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { DiaryComponent } from './diary/diary.component';

exports: [ RouterModule ]

export const routes: Routes = [
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: 'dashboard', component: DashboardComponent },
    { path: 'diaries', component: DiariesComponent },
    { path: 'pages', component: PagesComponent },
    { path: 'diary/:id', component: DiaryComponent },
];
