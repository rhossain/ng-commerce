import { Routes } from '@angular/router';
import { CartDetailsComponent } from './cart-details/cart-details.component';

const shoppingRoutes: Routes = [
  {
    path: 'cart',
    component: CartDetailsComponent,
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
