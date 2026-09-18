import type { Category, Product, Settings } from './types'

export const burgerCustomization = {
  variants: [
    { name: 'Simple', price: 10000 },
    { name: 'Doble', price: 12000 },
    { name: 'Triple', price: 14000 },
  ],
  extras: [
    { name: 'Bacon Extra', price: 1500 },
    { name: 'Pickles Extra', price: 1500 },
    { name: 'Lechuga Extra', price: 1500 },
    { name: 'Tomate Extra', price: 1500 },
    { name: 'Cebolla Caramelizada Extra', price: 1500 },
    { name: 'Huevo Extra', price: 1500 },
    { name: 'Queso Dambo Extra', price: 1500 },
    { name: 'Queso Cheddar Extra', price: 1500 },
  ],
}

export const demoSettings: Settings = {
  business_name: 'LA MANTECA',
  whatsapp_number: '5491168644174',
  transfer_alias: 'PENDIENTE.DE.CONFIGURAR',
  transfer_holder: 'Titular pendiente',
  transfer_bank: 'Banco pendiente',
  address: 'Dirección a configurar',
  opening_hours: 'Jueves a lunes · 20:00 a 00:00 h',
  delivery_fee: 0,
  delivery_zones: 'Zonas de delivery a configurar',
  currency_symbol: '$',
}

export const demoCategories: Category[] = [
  { id: 'burgers', name: 'Hamburguesas', sort_order: 1 },
  { id: 'fries', name: 'Papas fritas', sort_order: 2 },
  { id: 'drinks', name: 'Bebidas', sort_order: 3 },
]

export const demoProducts: Product[] = [
  { id: 'classic', name: 'Clásica', description: 'Medallón de 100 g, cheddar x2, bacon y cebolla caramelizada. Incluye papas.', sale_price: 10000, cost_price: 0, available: true, category_id: 'burgers', customization: burgerCustomization },
  { id: 'smoky', name: 'Smoky Bacon', description: 'Medallón de 100 g, cheddar, bacon crocante y barbacoa. Incluye papas.', sale_price: 10000, cost_price: 0, available: true, category_id: 'burgers', customization: burgerCustomization },
  { id: 'veggie', name: 'Veggie', description: 'Medallón vegetal, queso, rúcula y tomate. Incluye papas.', sale_price: 10000, cost_price: 0, available: true, category_id: 'burgers', customization: burgerCustomization },
  { id: 'fries', name: 'Papas fritas', description: 'Papas crocantes con condimento de la casa.', sale_price: 4200, cost_price: 0, available: true, category_id: 'fries' },
  { id: 'cola', name: 'Coca-Cola', description: 'Gaseosa fría en lata.', sale_price: 2500, cost_price: 0, available: true, category_id: 'drinks' },
  { id: 'water', name: 'Agua mineral', description: 'Agua sin gas fría.', sale_price: 1800, cost_price: 0, available: true, category_id: 'drinks' },
]
