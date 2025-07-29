import { Routes } from '@angular/router';
import { AuthGuard } from '../guards/auth.guard';
import { CartDetailsComponent } from './cart-details/cart-details.component';

const shoppingRoutes: Routes = [
  {
    path: 'cart',
    component: CartDetailsComponent,
  },
  {
    path: 'wishlist',
    loadComponent: () => import('../shopping/wishlist/wishlist.component'),
    canActivate: [AuthGuard]
  },
  {
    path: 'checkout',
    loadComponent: () => import('../shopping/checkout/checkout.component'),
    canActivate: [AuthGuard]
  },
];

export default shoppingRoutes;