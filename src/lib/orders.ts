import { demoSettings } from '../data'
import { supabase } from './supabase'
import type { CartItem, CustomerDetails, OrderStatus, Settings } from '../types'

export const formatMoney = (amount: number, currency = '$') =>
  `${currency}${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount)}`

const itemDetails = (item: CartItem) => [
  item.selected_variant,
  ...(item.selected_extras ?? []).map((extra) => `${extra.quantity}× ${extra.name}`),
].filter(Boolean).join(', ')

export async function saveOrder(items: CartItem[], customer: CustomerDetails, settings: Settings) {
  const subtotal = items.reduce((total, item) => total + item.sale_price * item.quantity, 0)
  const delivery = customer.fulfillment === 'delivery' ? settings.delivery_fee : 0
  const total = subtotal + delivery
  const order = {
    customer_name: customer.name,
    customer_phone: customer.phone,
    fulfillment_type: customer.fulfillment,
    delivery_address: customer.fulfillment === 'delivery' ? (customer.normalized_address || customer.address) : null,
    delivery_lat: customer.fulfillment === 'delivery' ? customer.delivery_lat : null,
    delivery_lng: customer.fulfillment === 'delivery' ? customer.delivery_lng : null,
    delivery_distance_km: customer.fulfillment === 'delivery' ? customer.delivery_distance_km : null,
    payment_method: customer.payment,
    cash_amount: customer.payment === 'cash' && customer.cash_amount ? Number(customer.cash_amount) : null,
    notes: customer.notes || null,
    subtotal,
    delivery_fee: delivery,
    total,
    status: 'new' as OrderStatus,
  }

  if (!supabase) {
    const fallback = { id: crypto.randomUUID(), ...order, items, created_at: new Date().toISOString() }
    const saved = JSON.parse(localStorage.getItem('burger-demo-orders') ?? '[]')
    localStorage.setItem('burger-demo-orders', JSON.stringify([fallback, ...saved]))
    return { total, delivery, order: fallback }
  }

  const orderItems = items.map((item) => ({
    product_id: item.id,
    product_name: `${item.name}${itemDetails(item) ? ` (${itemDetails(item)})` : ''}`,
    unit_price: item.sale_price,
    unit_cost: item.cost_price,
    quantity: item.quantity,
  }))
  const { data: orderId, error } = await supabase.rpc('create_order_with_items', {
    order_payload: order,
    item_payload: orderItems,
  })
  if (error) throw error
  return { total, delivery, order: { id: orderId } }
}

export function makeWhatsAppMessage(items: CartItem[], customer: CustomerDetails, settings: Settings, total: number, delivery: number) {
  const lines = items.map((item) => `- ${item.quantity}x ${item.name}${itemDetails(item) ? ` (${itemDetails(item)})` : ''} - ${formatMoney(item.sale_price * item.quantity, settings.currency_symbol)}`)
  const fulfillment = customer.fulfillment === 'delivery'
    ? `Delivery\nDirección: ${customer.normalized_address || customer.address}\nDistancia: ${customer.delivery_distance_km?.toFixed(1) ?? '-'} km\nCosto de envío: ${formatMoney(delivery, settings.currency_symbol)}`
    : `Retiro en persona\nDirección: ${settings.address}`
  const payment = customer.payment === 'transfer'
    ? `Transferencia\nMonto exacto: ${formatMoney(total, settings.currency_symbol)}\nAlias/CBU: ${settings.transfer_alias}\nTitular: ${settings.transfer_holder}${settings.transfer_bank ? `\nBanco: ${settings.transfer_bank}` : ''}`
    : `Efectivo — paga: ${formatMoney(total, settings.currency_symbol)}${customer.cash_amount ? ` (lleva ${formatMoney(Number(customer.cash_amount), settings.currency_symbol)})` : ''}`
  return [
    `*NUEVO PEDIDO — ${settings.business_name}*`,
    '------------------------------',
    '[ PEDIDO ]',
    ...lines,
    '------------------------------',
    `*TOTAL: ${formatMoney(total, settings.currency_symbol)}*`,
    '',
    `[ ENTREGA ]\n${fulfillment}`,
    '',
    `[ CLIENTE ]\n${customer.name}\nTel: ${customer.phone}`,
    '',
    `[ PAGO ]\n${payment}`,
    ...(customer.notes ? ['', `[ NOTAS ]\n${customer.notes}`] : []),
    '------------------------------',
    '*FIN DEL PEDIDO*',
  ].join('\n')
}

export function getSettingsFallback() { return demoSettings }
