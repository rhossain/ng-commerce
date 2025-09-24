export type SidebarKey = string; // e.g. 'cart', 'filters', 'product-preview'

export interface SidebarConfig {
  title?: string;
  position?: 'left' | 'right';
  width?: string;
  closeOnClickOutside?: boolean;
  data?: any; // optional custom data
}

export interface SidebarState {
  isOpen: boolean;
  config?: SidebarConfig;
}
