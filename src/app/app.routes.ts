import { Routes } from '@angular/router';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { ProfileComponent } from './auth/profile/profile.component';
import { AuthGuard } from './guards/auth.guard';
import { OrderHistoryComponent } from './components/order-history/order-history.component';

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
    {
        path: 'shop',
        loadComponent: () => import('../app/product/shop/shop.component'),
        title: 'Shop & Search'
    },
    {
        path: 'search-results',
        redirectTo: '/shop'
    },
    {
        path: 'search',
        redirectTo: '/shop'
    },
    { path: 'auth/login', component: LoginComponent },
    { path: 'auth/register', component: RegisterComponent },
    { path: 'auth/profile', component: ProfileComponent, canActivate: [AuthGuard] },
    { 
        path: 'orders', 
        component: OrderHistoryComponent,
        canActivate: [AuthGuard]
    },
];
