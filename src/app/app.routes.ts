import { RouterModule, Routes } from '@angular/router';
import { DiariesComponent } from './diaries/diaries.component';
import { DiaryComponent } from './diary/diary.component';
import { PageComponent } from './page/page.component';
import { SigninComponent } from './user/signin/signin.component';
import { RegisterComponent } from './user/register/register.component';
import { AuthGuard } from './auth.guard';
import { StartupRedirectComponent } from './utilities/startupRedirect';
import { FragmentComponent } from './fragment/fragment.component';

exports: [ RouterModule ]

export const routes: Routes = [
    { path: '', component: StartupRedirectComponent },
    { path: 'register', component: RegisterComponent },
    { path: 'signin', component: SigninComponent },
    { path: 'diaries', component: DiariesComponent, canActivate: [AuthGuard] },
    { path: 'diary/:diaryId', component: DiaryComponent, canActivate: [AuthGuard] },
    { path: 'diary/:diaryId/:pageId', component: PageComponent, canActivate: [AuthGuard] },
    { path: 'diary/:diaryId/:pageId/:fragmentId', component: FragmentComponent }
];
