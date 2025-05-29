import { Routes } from '@angular/router';

const shoppingRoutes: Routes = [
  {
    path: 'cart',
    loadComponent: () => import('../shopping/cart-details/cart-details.component'),
  },
  {
    path: 'wishlist',
    loadComponent: () => import('../shopping/wishlist/wishlist.component'),
  },
  {
    path: 'checkout',
    loadComponent: () => import('../shopping/checkout/checkout.component'),
  },
];

export default shoppingRoutes;
