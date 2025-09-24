export interface ProductCategory {
    id: number;
    created_at: any;
    name: string;
    image: string;
    productCount?: number; // <- optional count
}