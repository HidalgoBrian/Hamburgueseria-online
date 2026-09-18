export type FulfillmentType = 'delivery' | 'pickup'
export type PaymentMethod = 'transfer' | 'cash'
export type OrderStatus = 'new' | 'confirmed' | 'preparing' | 'delivered' | 'cancelled'

export interface Category { id: string; name: string; sort_order?: number }
export interface Product {
  id: string
  name: string
  description: string
  sale_price: number
  cost_price: number
  image_url?: string | null
  available: boolean
  category_id: string
  customization?: BurgerCustomization | null
}
export interface Settings {
  id?: string
  business_name: string
  whatsapp_number: string
  transfer_alias: string
  transfer_holder: string
  transfer_bank: string
  address: string
  opening_hours: string
  delivery_fee: number
  delivery_zones: string
  currency_symbol: string
}
export interface ProductVariant { name: string; price: number }
export interface ProductExtra { name: string; price: number }
export interface BurgerCustomization { variants: ProductVariant[]; extras: ProductExtra[] }
export interface SelectedExtra extends ProductExtra { quantity: number }
export interface CartItem extends Product {
  quantity: number
  cart_key?: string
  selected_variant?: string
  selected_extras?: SelectedExtra[]
}
export interface CustomerDetails {
  name: string
  phone: string
  fulfillment: FulfillmentType
  address: string
  payment: PaymentMethod
  cash_amount: string
  notes: string
}
