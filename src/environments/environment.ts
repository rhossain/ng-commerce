import { EnvironmentConfiguration } from "../app/models/environment-config";

const devUrl = 'https://x8ki-letl-twmt.n7.xano.io/api:3XvU42qz';

export const environment: EnvironmentConfiguration = {
    env_name: "dev",
    production: false,
    apiBaseUrl: devUrl,
    apiEndpoints: {
        product: {
            getAllProduct: "product",
            getProduct: "product",
            getFeaturedProduct: "products/featured",
            getNewProduct: "products/new",
            addReview: "review",
            updateReview: "review",
            deleteReview: "review",
            searchProducts: "products/search",
            searchSuggestions: "products/search-suggestions",
            popularSearches: "products/popular-searches"
        },
        product_images: {
            getAllImages: "product_images",
            getImage: "product_images"
        },
        category: {
            getAllCategory: "category",
            getCategory: "category",
            getCategoryProductCount: "category-product-counts",
        },
        auth: {
            setLogin: "auth/login",
            getProfile: "auth/me",
            setSignup: "auth/signup"
        },
        order: {
            createOrder: "order",
            getUserOrders: "order",
            getOrder: "order",
            updateOrderStatus: "order",
            cancelOrder: "order",
        },
        order_items: {
            createItem: "order_items",
            bulkCreate: "order_items/bulk", // For future bulk creation if needed
        },
        shipping: {
            // ✅ Direct Xano table endpoints
            getShippingMethods: "shipping_methods",
            getUserAddresses: "shipping_addresses",
            createAddress: "shipping_addresses",
            updateAddress: "shipping_addresses",
            deleteAddress: "shipping_addresses",
            setDefaultAddress: "shipping_addresses",
            
            // ✅ Specialized endpoints
            validateAddress: "shipping_addresses/validate",
            getShippingZones: "shipping_zones",
            getShippingStatus: "shipping_status", 
            updateShippingStatus: "shipping_status",
            trackPackage: "shipping_tracking",
            calculateRates: "shipping_methods/calculate-rates",
        },
        payment: {
            processPayment: "payment",
            getPaymentStatus: "payment",
            refundPayment: "payment"
        }
    }
};