import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { ProfileComponent } from './components/profile/profile.component';
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
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: 'profile', component: ProfileComponent, canActivate: [AuthGuard] }
];
