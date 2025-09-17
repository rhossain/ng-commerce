// models/wishlist.model.ts - Updated with proper ProductModel import
import { ProductModel } from './product.model';

export interface WishlistModel {
  id: number;
  created_at: number;
  added_at: number;
  user_id: number;
  product_id: number;
}

export interface WishlistWithProduct extends WishlistModel {
  product?: ProductModel; // Now properly typed as ProductModel
}

export interface CreateWishlistRequest {
  user_id: number;
  product_id: number;
  added_at: number;
}

export interface WishlistResponse {
  success: boolean;
  message?: string;
  data?: WishlistModel | WishlistWithProduct[];
}