import { useState } from 'react'
import { Bike, CheckCircle2, ClipboardList, LoaderCircle, MapPin, Store, X, XCircle } from 'lucide-react'
import { demoSettings } from './data'
import { formatMoney, makeWhatsAppMessage, saveOrder } from './lib/orders'
import type { CartItem, CustomerDetails, Settings } from './types'

const initialCustomer: CustomerDetails = { name: '', phone: '', fulfillment: 'delivery', address: '', payment: 'transfer', cash_amount: '', notes: '' }
type Verification = { status: 'idle' | 'checking' | 'valid' | 'invalid'; message: string }
type GeorefAddress = { nomenclatura: string; ubicacion: { lat: number | null; lon: number | null } }

const distanceInKm = (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
  const toRadians = (value: number) => value * Math.PI / 180
  const deltaLat = toRadians(toLat - fromLat)
  const deltaLng = toRadians(toLng - fromLng)
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(deltaLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

export default function DeliveryCheckout({ cart, settings, onClose, onSuccess }: { cart: CartItem[]; settings: Settings; onClose: () => void; onSuccess: () => void }) {
  const [customer, setCustomer] = useState<CustomerDetails>(initialCustomer)
  const [verification, setVerification] = useState<Verification>({ status: 'idle', message: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const subtotal = cart.reduce((total, item) => total + item.sale_price * item.quantity, 0)
  const delivery = customer.fulfillment === 'delivery' ? settings.delivery_fee : 0
  const total = subtotal + delivery
  const radius = Number(settings.delivery_radius_km || demoSettings.delivery_radius_km)
  const storeLat = Number(settings.latitude || demoSettings.latitude)
  const storeLng = Number(settings.longitude || demoSettings.longitude)

  const change = (field: keyof CustomerDetails, value: string) => {
    setCustomer((current) => field === 'address'
      ? { ...current, address: value, normalized_address: undefined, delivery_lat: undefined, delivery_lng: undefined, delivery_distance_km: undefined }
      : { ...current, [field]: value })
    if (field === 'address') setVerification({ status: 'idle', message: '' })
  }

  const verifyAddress = async () => {
    setError('')
    const rawAddress = customer.address.trim()
    const commaParts = rawAddress.split(',').map((part) => part.trim()).filter(Boolean)
    const addressMatch = rawAddress.match(/^(.+\s+\d+[a-zA-Z]?)\s+(.+)$/)
    const street = commaParts.length > 1 ? commaParts[0] : addressMatch?.[1]
    const locality = commaParts.length > 1 ? commaParts.slice(1).join(', ') : addressMatch?.[2]
    if (!street || !locality) {
      setVerification({ status: 'invalid', message: 'Ingresá calle, altura y localidad. Ejemplo: París 1725 Isidro Casanova.' })
      return
    }
    setVerification({ status: 'checking', message: 'Verificando dirección…' })
    try {
      const query = new URLSearchParams({ direccion: street, localidad: locality, provincia: 'Buenos Aires', max: '5' })
      const response = await fetch(`https://apis.datos.gob.ar/georef/api/v2.0/direcciones?${query}`)
      if (!response.ok) throw new Error('Georef no disponible')
      const data = await response.json() as { direcciones?: GeorefAddress[] }
      const candidate = data.direcciones?.find((entry) => entry.ubicacion.lat != null && entry.ubicacion.lon != null)
      if (!candidate || candidate.ubicacion.lat == null || candidate.ubicacion.lon == null) {
        setVerification({ status: 'invalid', message: 'No pudimos ubicar esa dirección. Revisá la calle, altura y localidad.' })
        return
      }
      const distance = distanceInKm(storeLat, storeLng, candidate.ubicacion.lat, candidate.ubicacion.lon)
      setCustomer((current) => ({ ...current, normalized_address: candidate.nomenclatura, delivery_lat: candidate.ubicacion.lat!, delivery_lng: candidate.ubicacion.lon!, delivery_distance_km: distance }))
      setVerification(distance <= radius
        ? { status: 'valid', message: `Dirección dentro del área de entrega: ${distance.toFixed(1)} km del local.` }
        : { status: 'invalid', message: `La dirección está a ${distance.toFixed(1)} km. El delivery llega hasta ${radius} km; podés elegir retiro.` })
    } catch {
      setVerification({ status: 'invalid', message: 'No pudimos verificar la dirección ahora. Intentá nuevamente o elegí retiro.' })
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (customer.fulfillment === 'delivery' && verification.status !== 'valid') {
      setError('Verificá una dirección dentro del radio antes de continuar.')
      return
    }
    setSaving(true)
    try {
      await saveOrder(cart, customer, settings)
      const message = makeWhatsAppMessage(cart, customer, settings, total, delivery)
      window.open(`https://wa.me/${settings.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      onSuccess()
    } catch (caught) {
      const message = caught instanceof Error && caught.message.includes('DELIVERY_OUT_OF_RANGE')
        ? 'La dirección está fuera del radio de delivery.'
        : 'No pudimos guardar el pedido. Revisá la conexión e intentá otra vez.'
      setError(message)
    } finally { setSaving(false) }
  }

  return <div className="fixed inset-0 z-40 overflow-y-auto bg-black/65 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label="Finalizar pedido"><form onSubmit={submit} className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-coal shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 p-5"><div><p className="text-sm font-bold uppercase tracking-wider text-mustard">Último paso</p><h2 className="text-xl font-black">Datos de entrega</h2></div><button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Cerrar"><X /></button></div><div className="space-y-5 p-5"><Field label="Nombre y apellido" value={customer.name} onChange={(value) => change('name', value)} required /><Field label="Teléfono" type="tel" value={customer.phone} onChange={(value) => change('phone', value)} required /><div><p className="mb-2 text-sm font-bold">¿Cómo lo recibís?</p><div className="grid grid-cols-2 gap-2"><Choice checked={customer.fulfillment === 'delivery'} onChange={() => change('fulfillment', 'delivery')} icon={<Bike size={18} />} label="Delivery" /><Choice checked={customer.fulfillment === 'pickup'} onChange={() => { change('fulfillment', 'pickup'); setError('') }} icon={<Store size={18} />} label="Retiro" /></div></div>{customer.fulfillment === 'delivery' && <div><Field label="Dirección (calle, altura y localidad)" value={customer.address} onChange={(value) => change('address', value)} required /><p className="mt-1 font-sans text-xs text-cream/65">Ejemplo: París 1725 Isidro Casanova. La coma es opcional. Radio máximo: {radius} km.</p><button type="button" onClick={verifyAddress} disabled={verification.status === 'checking' || !customer.address.trim()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-mustard/50 px-4 py-2.5 text-sm font-bold text-mustard disabled:opacity-50">{verification.status === 'checking' ? <LoaderCircle className="animate-spin" size={17} /> : <MapPin size={17} />} Verificar dirección</button>{verification.message && <div role="status" className={`mt-3 flex items-start gap-2 rounded-xl p-3 font-sans text-sm ${verification.status === 'valid' ? 'bg-green-950/35 text-green-100' : verification.status === 'invalid' ? 'bg-red-950/35 text-red-100' : 'bg-white/5 text-cream/75'}`}>{verification.status === 'valid' ? <CheckCircle2 className="mt-0.5 shrink-0" size={17} /> : verification.status === 'invalid' ? <XCircle className="mt-0.5 shrink-0" size={17} /> : null}<span>{verification.message}</span></div>}</div>}<div><p className="mb-2 text-sm font-bold">Forma de pago</p><div className="grid grid-cols-2 gap-2"><Choice checked={customer.payment === 'transfer'} onChange={() => change('payment', 'transfer')} icon={<ClipboardList size={18} />} label="Transferencia" /><Choice checked={customer.payment === 'cash'} onChange={() => change('payment', 'cash')} icon={<span className="font-black">$</span>} label="Efectivo" /></div></div>{customer.payment === 'transfer' && <div className="rounded-xl border border-mustard/30 bg-mustard/10 p-3 text-sm"><p className="font-bold text-mustard">Datos de transferencia</p><p className="mt-1">Alias/CBU: {settings.transfer_alias}</p><p>Titular: {settings.transfer_holder}</p></div>}{customer.payment === 'cash' && <Field label="¿Con cuánto pagás? (opcional)" type="number" value={customer.cash_amount} onChange={(value) => change('cash_amount', value)} />}<Field label="Notas para el pedido (opcional)" value={customer.notes} onChange={(value) => change('notes', value)} textarea /><div className="rounded-xl bg-white/5 p-4 text-sm"><div className="flex justify-between text-cream/65"><span>Subtotal</span><span>{formatMoney(subtotal, settings.currency_symbol)}</span></div>{delivery > 0 && <div className="mt-1 flex justify-between text-cream/65"><span>Delivery</span><span>{formatMoney(delivery, settings.currency_symbol)}</span></div>}<div className="mt-3 flex justify-between text-lg font-black"><span>Total</span><span className="text-mustard">{formatMoney(total, settings.currency_symbol)}</span></div></div>{error && <p role="alert" className="text-sm font-bold text-red-200">{error}</p>}<button disabled={saving || (customer.fulfillment === 'delivery' && verification.status !== 'valid')} className="w-full rounded-xl bg-ember px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Guardando pedido…' : 'Guardar y pedir por WhatsApp'}</button></div></form></div>
}

function Field({ label, value, onChange, required, type = 'text', textarea = false }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; textarea?: boolean }) { const common = { value, required, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value), className: 'mt-1 w-full rounded-xl border border-white/15 bg-ink px-3 py-2.5 text-cream outline-none placeholder:text-cream/30 focus:border-mustard' }; return <label className="block text-sm font-bold">{label}{textarea ? <textarea {...common} rows={3} /> : <input {...common} type={type} />}</label> }
function Choice({ checked, onChange, icon, label }: { checked: boolean; onChange: () => void; icon: React.ReactNode; label: string }) { return <button type="button" onClick={onChange} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold ${checked ? 'border-mustard bg-mustard/15 text-mustard' : 'border-white/15 text-cream/70'}`}>{icon}{label}</button> }
