import { ProductModel, ProductVariant } from "./product.model";

export interface CartItem {
    product: ProductModel;
    variant: ProductVariant;
    quantity: number;
}