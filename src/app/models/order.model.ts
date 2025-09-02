import { UserModel } from "./user.model";
import { ProductModel, ProductVariant } from "./product.model";

export interface OrderModel {
  id: number;
  created_at: number;
  order_date: string;
  total_amount: number;
  status: OrderStatus;
  cart_item_id: number;
  shipping_methods_id: number;
  shipping_cost: number;
  shipping_addresses_id: number;
  notes: string;
  user_id: number;
  
  // Optional fields (not in your database but used in service)
  promotion_code?: string;
  discount_amount?: number;
  tax_amount?: number;
  
  // Xano addon relationships
  order_items?: OrderItem[];
  shipping_method?: ShippingMethod;
  shipping_address?: ShippingAddress;
  payment?: PaymentModel;
  shipping_status?: ShippingStatus;
  user?: UserModel;
}

// FIXED: Updated to match your exact database schema
export interface OrderItem {
  id: number;
  created_at: number;
  quantity: number;
  unit_price: number;
  total_price: number;
  order_id: number;
  product_id: number;
  product_variant_id: number; // CHANGED: This matches your database field name
  
  // Optional fields
  discount_amount?: number;
  notes?: string;
  
  // Xano addon relationships
  product?: ProductModel;
  variant?: ProductVariant;
  order?: OrderModel;
}

// Shipping Method Model
export interface ShippingMethod {
  id: number;
  created_at: number;
  name: string;
  type: string;
  carrier: string;
  base_cost: number;
  estimated_delivery_days: string;
  free_shipping_threshold: number;
  is_active: boolean;
  
  // Optional fields
  description?: string;
  max_weight?: number;
  restrictions?: string;
}

// Shipping Address Model
export interface ShippingAddress {
  id: number;
  created_at: number;
  first_name: string;
  last_name: string;
  company?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  phone: string;
  delivery_instructions?: string;
  is_validated: boolean;
  is_active: boolean;
  user_id: number;
  
  // Xano addon relationship
  user?: UserModel;
}

// Shipping Status Model
export interface ShippingStatus {
  id: number;
  created_at: number;
  status: string;
  tracking_number: string;
  carrier_update: string;
  estimated_delivery: string;
  updated_at: number;
  order_id: number;
  
  // Optional fields
  actual_delivery_date?: string;
  delivery_notes?: string;
  carrier_service?: string;
  
  // Xano addon relationship
  order?: OrderModel;
}

// Payment Model
export interface PaymentModel {
  id: number;
  created_at: number;
  amount: number;
  payment_method: string;
  status: PaymentStatus;
  order_id: number;
  
  // Optional fields
  transaction_id?: string;
  gateway_response?: any;
  gateway_transaction_id?: string;
  failure_reason?: string;
  refund_amount?: number;
  refund_date?: string;
  currency?: string;
  
  // Xano addon relationship
  order?: OrderModel;
}

// Order Status Type
export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'cancelled' 
  | 'refunded'
  | 'returned';

// Payment Status Type
export type PaymentStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'refunded'
  | 'partially_refunded';

// Shipping Status Type
export type ShippingStatusType = 
  | 'pending'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed_delivery'
  | 'returned_to_sender';

export interface CreateOrderRequest {
  shipping_address_id: number | null;
  shipping_method_id: number | null;
  payment_method?: string;
  items: OrderItemRequest[];
  promotion_code?: string | null;
  delivery_instructions?: string | null;
  notes?: string | null;
}

// FIXED: Updated to match database field names
export interface OrderItemRequest {
  product_id: number;
  product_variant_id: number; // CHANGED: This matches your database field name
  quantity: number;
  unit_price: number;
}

export interface OrderResponse {
  itemsReceived: number;
  curPage: number;
  nextPage: number | null;
  prevPage: number | null;
  offset: number;
  perPage: number;
  itemsTotal: number;
  pageTotal: number;
  items: OrderModel[];
}

export interface PaymentRequest {
  order_id: number;
  payment_method: string;
  amount: number;
  currency?: string;
  gateway_data?: {
    card_number?: string;
    expiry_date?: string;
    cvv?: string;
    cardholder_name?: string;
    billing_address?: Partial<ShippingAddress>;
    // PayPal specific
    paypal_email?: string;
    paypal_transaction_id?: string;
    // Other gateway specific fields
    [key: string]: any;
  };
}

export interface UpdateOrderRequest {
  status?: OrderStatus;
  shipping_address_id?: number;
  shipping_method_id?: number;
  notes?: string;
  tracking_number?: string;
}

export interface OrderFilterOptions {
  status?: OrderStatus;
  date_from?: string;
  date_to?: string;
  min_amount?: number;
  max_amount?: number;
  shipping_method_id?: number;
  search_term?: string;
}

export interface OrderSummary {
  id: number;
  status: OrderStatus;
  total_amount: number;
  order_date: string;
  item_count: number;
  shipping_method_name?: string;
}

export interface PromotionModel {
  id: number;
  created_at: number;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
  discount_value: number;
  minimum_order_amount?: number;
  maximum_discount_amount?: number;
  start_date: string;
  end_date: string;
  usage_limit?: number;
  usage_count: number;
  is_active: boolean;
  applicable_products?: number[]; // Product IDs
  applicable_categories?: number[]; // Category IDs
}

export interface OrderAnalytics {
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  orders_by_status: { [key in OrderStatus]: number };
  orders_by_month: { month: string; count: number; revenue: number }[];
  top_products: { product_id: number; product_name: string; quantity_sold: number }[];
  top_shipping_methods: { method_id: number; method_name: string; usage_count: number }[];
}

export interface InvoiceModel {
  id: number;
  order_id: number;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  tax_amount: number;
  shipping_cost: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  
  // Xano addon relationships
  order?: OrderModel;
}

export interface ReturnRequest {
  id: number;
  order_id: number;
  order_item_id: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requested_date: string;
  processed_date?: string;
  refund_amount: number;
  return_shipping_cost?: number;
  notes?: string;
  
  // Xano addon relationships
  order?: OrderModel;
  order_item?: OrderItem;
}

export interface WishlistItem {
  id: number;
  created_at: number;
  added_at: number;
  user_id: number;
  product_id: number;
  variant_id?: number; // NOTE: This can stay as variant_id since it's for wishlist, not orders
  
  // Xano addon relationships
  product?: ProductModel;
  variant?: ProductVariant;
  user?: UserModel;
}

export interface OrderTrackingEvent {
  id: number;
  order_id: number;
  event_type: 'status_change' | 'payment_processed' | 'item_shipped' | 'delivered' | 'note_added';
  description: string;
  created_at: number;
  created_by?: number; // User ID (admin or system)
  metadata?: any; // Additional event-specific data
  
  // Xano addon relationships
  order?: OrderModel;
  created_by_user?: UserModel;
}