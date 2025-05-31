export interface ProductModel {
    id: number;
    created_at: any;
    updated_at: any;
    name: string;
    description: string;
    slug: string;
    price: number;
    stock_quantity: number;
    isNewArrival: boolean;
    isFeatured: boolean;
    main_image_url?: string;
    options?: ProductOption[];
    variants?: ProductVariant[];
    brand?: string;
    category_id: number;
}

export interface ProductOption {
    id: number;
    name: string;
    values: string[];
    option_values?: ProductOptionValue[];
    product_id: number;
}

export interface ProductOptionValue {
    id: number;
    option_name: string;
    option_value: string;
    variant_id: number;
}
  
export interface ProductVariant {
    id: number;
    price: number;
    discountPrice?: number;
    totalSold: number;
    stock: number;
    sku: string;
    optionValues: { [key: string]: string };
    weight?: number;
    product_images: ProductImageModel[];
}

export interface ProductImageModel {
    id: number;
    created_at: any;
    image_url: string;
    product_id: number;
}

export interface ProductResponse {
    itemsReceived: number;
    curPage: number;
    nextPage: number | null;
    prevPage: number | null;
    offset: number;
    perPage: number;
    itemsTotal: number;
    pageTotal: number;
    items: ProductModel[];
}