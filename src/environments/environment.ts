import { EnvironmentConfiguration } from "../app/models/environment-config";

const devUrl = 'https://x8ki-letl-twmt.n7.xano.io/api:3XvU42qz';

export const environment:EnvironmentConfiguration = {
    env_name: "dev",
    production: false,
    apiBaseUrl: devUrl,
    apiEndpoints: {
        product: {
            getAllProduct: "product",
            getProduct: "product",
            getFeaturedProduct: "products/featured",
            getNewProduct: "products/new"
        },
        product_images: {
            getAllImages: "product_images",
            getImage: "product_images"
        },
        category: {
            getAllCategory: "category",
            getCategory: "category",
            getCategoryProductCount: "category-product-counts",
        }
    }
}