export interface EnvironmentConfiguration {
    env_name: string;
    production: boolean;
    apiBaseUrl: string;
    apiEndpoints: {
        product: {
            getAllProduct: string;
            getProduct: string,
            getFeaturedProduct: string,
            getNewProduct: string
        },
        product_images: {
            getAllImages: string;
            getImage: string
        },
        category: {
            getAllCategory: string;
            getCategory: string;
            getCategoryProductCount: string;
        },
        auth: {
            setLogin: string;
            getProfile: string;
            setSignup: string;
        }
    }
}