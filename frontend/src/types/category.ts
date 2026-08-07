export interface ProductCategory {
  id: string;
  name: string;
  secondary_name: string;
  description: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryInput {
  name: string;
  description: string;
  display_order: number;
  is_active: boolean;
}
