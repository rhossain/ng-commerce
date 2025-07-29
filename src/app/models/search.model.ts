// Simplified search.model.ts
import { ProductModel } from './product.model';

export interface SearchRequest {
  q?: string;
  category_id?: number | null;
  min_price?: number | null;
  max_price?: number | null;
  sort_by?: 'name' | 'price' | 'created_at' | 'id' | string; // ✅ Added 'id' and string fallback
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface SearchResponse {
  items: ProductModel[];
  pagination?: {
    current_page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
    next_page: number | null;
    prev_page: number | null;
  };
  // Alternative Xano response format
  itemsReceived?: number;
  curPage?: number;
  nextPage?: number | null;
  prevPage?: number | null;
  offset?: number;
  perPage?: number;
  itemsTotal?: number;
  pageTotal?: number;
  filters?: {
    search_query: string;
    category_id: number | null;
    min_price: number | null;
    max_price: number | null;
    sort_by: string;
    sort_order: string;
  };
}

export type SortOption = {
  value: string;
  label: string;
  field: string;
  order: 'asc' | 'desc';
};

export const SORT_OPTIONS: SortOption[] = [
  { value: 'relevance', label: 'Most Relevant', field: 'name', order: 'asc' },
  { value: 'price_low', label: 'Price: Low to High', field: 'price', order: 'asc' },
  { value: 'price_high', label: 'Price: High to Low', field: 'price', order: 'desc' },
  { value: 'newest', label: 'Newest First', field: 'created_at', order: 'desc' },
  { value: 'name_az', label: 'Name: A to Z', field: 'name', order: 'asc' },
  { value: 'name_za', label: 'Name: Z to A', field: 'name', order: 'desc' },
  { value: 'id_asc', label: 'ID: Low to High', field: 'id', order: 'asc' }, // ✅ Added ID options
  { value: 'id_desc', label: 'ID: High to Low', field: 'id', order: 'desc' }
];

export const PRICE_RANGES = [
  { min: 0, max: 25, label: 'Under $25' },
  { min: 25, max: 50, label: '$25 - $50' },
  { min: 50, max: 100, label: '$50 - $100' },
  { min: 100, max: 250, label: '$100 - $250' },
  { min: 250, max: 500, label: '$250 - $500' },
  { min: 500, max: 1000, label: '$500 - $1,000' },
  { min: 1000, max: Number.MAX_VALUE, label: '$1,000+' }
];

export const PER_PAGE_OPTIONS = [6, 12, 24, 36, 48];