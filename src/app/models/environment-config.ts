export interface EnvironmentConfiguration {
    env_name: string;
    production: boolean;
    apiBaseUrl: string;
    apiEndpoints: {
        product: {
            getAllProduct: string;
            getProduct: string
        },
        product_images: {
            getAllImages: string;
            getImage: string
        },
        category: {
            getAllCategory: string;
            getCategory: string;
        }
    }
}