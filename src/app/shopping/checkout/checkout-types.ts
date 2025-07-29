export interface PaymentMethod {
  id: string;
  name: string;
  icon: any;
  description: string;
  type: 'card' | 'digital_wallet' | 'bank';
}

export interface CheckoutTotals {
  cartSubtotal: number;
  shippingCost: number;
  taxAmount: number;
  discountAmount: number;
  orderTotal: number;
}

export interface StepValidation {
  shipping: boolean;
  billing: boolean;
  shippingMethod: boolean;
  payment: boolean;
}