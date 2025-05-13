import { Routes } from '@angular/router';

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
    }
];
