import { Routes } from '@angular/router';

const productRoutes: Routes = [
    {
        path: '',
        pathMatch: 'full',
        redirectTo: 'shop'
    },
    {
        path: 'shop',
        loadComponent: () => import('../product/shop/shop.component'),
    },
    {
        path: 'search',
        loadComponent: () => import('../product/search-result/search-result.component'),
    },
    {
        path: 'detail/:productId',
        loadComponent: () => import('../product/details/details.component'),
    },
];

export default productRoutes;
