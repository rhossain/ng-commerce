import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { ProfileComponent } from './auth/profile/profile.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'home'
    },
    {
        path: 'home',
        loadComponent: () => import('../app/components/home/home.component'),
    },
    {
        path: 'contact',
        loadComponent: () => import('../app/components/contact/contact.component'),
    },
    {
        path: 'product',
        loadChildren: () => import('../app/product/product.routes')
    },
    {
        path: 'shopping',
        loadChildren: () => import('../app/shopping/shopping.routes')
    },
    { path: 'auth/login', component: LoginComponent },
    { path: 'auth/register', component: RegisterComponent },
    { path: 'auth/profile', component: ProfileComponent, canActivate: [AuthGuard] }
];
