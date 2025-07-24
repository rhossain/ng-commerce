export interface EnvironmentConfiguration {
    env_name: string;
    production: boolean;
    apiBaseUrl: string;
    apiEndpoints: {
        product: {
            getAllProduct: string;
            getProduct: string,
            getFeaturedProduct: string,
            getNewProduct: string,
            addReview: string,
            updateReview: string,
            deleteReview: string,
            searchProducts: string,
            searchSuggestions: string,
            popularSearches: string
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
        },
        order: {
            createOrder: string;
            getUserOrders: string;
            getOrder: string;
            updateOrderStatus: string;
            cancelOrder: string;
        },
        shipping: {
            getShippingMethods: string;
            getUserAddresses: string;
            createAddress: string;
            updateAddress: string;
            validateAddress: string;
            deleteAddress: string;
            setDefaultAddress: string;
            getShippingZones: string;
            getShippingStatus: string;
            updateShippingStatus: string;
            trackPackage: string;
            calculateRates: string;
        },
        payment: {
            processPayment: string;
            getPaymentStatus: string;
            refundPayment: string;
        }
    }
}