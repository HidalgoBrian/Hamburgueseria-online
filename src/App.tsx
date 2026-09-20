import { useEffect, useMemo, useState } from "react";
import {
  Bike,
  ChevronRight,
  ClipboardList,
  Flame,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import {
  burgerCustomization,
  demoBurgerAddons,
  demoCategories,
  demoProducts,
  demoSettings,
} from "./data";
import { formatMoney, makeWhatsAppMessage, saveOrder } from "./lib/orders";
import { supabase } from "./lib/supabase";
import DeliveryCheckout from "./Checkout";
import type {
  BurgerAddon,
  BurgerCustomization,
  CartItem,
  CustomerDetails,
  Product,
  ProductExtra,
  ProductVariant,
  Settings,
} from "./types";

const initialCustomer: CustomerDetails = {
  name: "",
  phone: "",
  fulfillment: "delivery",
  address: "",
  payment: "transfer",
  cash_amount: "",
  notes: "",
};

export default function App() {
  const [products, setProducts] = useState<Product[]>(demoProducts);
  const [categories, setCategories] = useState(demoCategories);
  const [settings, setSettings] = useState<Settings>(demoSettings);
  const [burgerAddons, setBurgerAddons] =
    useState<BurgerAddon[]>(demoBurgerAddons);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [configuring, setConfiguring] = useState<Product | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!supabase) return;
    void Promise.all([
      supabase.from("products").select("*").order("sort_order").order("name"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("business_settings").select("*").limit(1).maybeSingle(),
      supabase.from("burger_addons").select("*").order("sort_order"),
    ]).then(([productResult, categoryResult, settingsResult, addonResult]) => {
      if (!productResult.error && productResult.data)
        setProducts(productResult.data);
      if (!categoryResult.error && categoryResult.data)
        setCategories(categoryResult.data);
      if (!settingsResult.error && settingsResult.data)
        setSettings(settingsResult.data);
      if (!addonResult.error && addonResult.data)
        setBurgerAddons(addonResult.data);
    });
  }, []);

  const visibleProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.available &&
          (selectedCategory === "all" ||
            product.category_id === selectedCategory),
      ),
    [products, selectedCategory],
  );
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cart.reduce(
    (total, item) => total + item.sale_price * item.quantity,
    0,
  );

  const customizationFor = (product: Product): BurgerCustomization | null => {
    const category = categories.find(
      (entry) => entry.id === product.category_id,
    );
    if (!category?.name.toLocaleLowerCase().includes("hamburgues")) return null;
    const pattyAddon = burgerAddons.find(
      (addon) => addon.kind === "patty" && addon.available,
    );
    const extraPattyPrice = Number(pattyAddon?.sale_price ?? 0);
    const extraPattyCost = Number(pattyAddon?.cost_price ?? 0);
    return {
      ...burgerCustomization,
      variants: burgerCustomization.variants.map((variant, index) => ({
        ...variant,
        price: product.sale_price + index * extraPattyPrice,
        cost: product.cost_price + index * extraPattyCost,
      })),
      extras: burgerAddons
        .filter((addon) => addon.kind === "extra" && addon.available)
        .map((addon) => ({
          name: addon.name,
          price: Number(addon.sale_price),
          cost: Number(addon.cost_price),
        })),
      extra_patty_price: extraPattyPrice,
      extra_patty_cost: extraPattyCost,
    };
  };

  const updateCart = (product: Product | CartItem, change: number) => {
    const cartKey = (product as CartItem).cart_key ?? product.id;
    setCart((items) => {
      const item = items.find(
        (entry) => (entry.cart_key ?? entry.id) === cartKey,
      );
      if (!item && change > 0) return [...items, { ...product, quantity: 1 }];
      if (!item) return items;
      const quantity = item.quantity + change;
      return quantity <= 0
        ? items.filter((entry) => (entry.cart_key ?? entry.id) !== cartKey)
        : items.map((entry) =>
            (entry.cart_key ?? entry.id) === cartKey
              ? { ...entry, quantity }
              : entry,
          );
    });
  };

  const addCustomizedProduct = (
    product: Product,
    variant: ProductVariant,
    extras: (ProductExtra & { quantity: number })[],
  ) => {
    const selectedExtras = extras.filter((extra) => extra.quantity > 0);
    const extrasTotal = selectedExtras.reduce(
      (total, extra) => total + extra.price * extra.quantity,
      0,
    );
    const extrasCost = selectedExtras.reduce(
      (total, extra) => total + extra.cost * extra.quantity,
      0,
    );
    const cartKey = `${product.id}-${variant.name}-${selectedExtras.map((extra) => `${extra.name}-${extra.quantity}`).join("|")}`;
    updateCart(
      {
        ...product,
        cart_key: cartKey,
        sale_price: variant.price + extrasTotal,
        cost_price: (variant.cost ?? product.cost_price) + extrasCost,
        selected_variant: variant.name,
        selected_extras: selectedExtras,
      },
      1,
    );
    setConfiguring(null);
  };

  const addFromMenu = (product: Product) => {
    if (customizationFor(product)) setConfiguring(product);
    else updateCart(product, 1);
  };

  return (
    <main className="min-h-screen bg-ink text-cream">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <a
            href="#menu"
            className="flex items-center gap-2 font-black tracking-tight"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg border-2 border-cream bg-ember text-sm text-cream">
              LM
            </span>
            <span>{settings.business_name}</span>
          </a>
          <button
            onClick={() => setCartOpen(true)}
            className="relative inline-flex items-center gap-2 rounded-full bg-cream px-4 py-2 font-bold text-ink transition hover:bg-mustard"
            aria-label="Abrir carrito"
          >
            <ShoppingBag size={18} />{" "}
            <span className="hidden sm:inline">Mi pedido</span>
            {itemCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1 text-xs text-white">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <section className="border-b border-white/10 bg-coal">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 sm:py-14 md:grid-cols-[1.4fr_.6fr] md:items-end">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[.18em] text-mustard">
              <Flame size={16} /> Fast · fresh · con sabor
            </p>
            <h1 className="max-w-2xl text-4xl font-black leading-none tracking-tight sm:text-6xl">
              La clave del sabor está acá.
            </h1>
            <p className="mt-5 max-w-xl font-sans text-cream/80">
              Elegí tus favoritos, definí delivery o retiro, y enviá el pedido
              completo por WhatsApp.
            </p>
            <div className="mt-5 flex items-center gap-2 text-sm">
              <Store size={17} className="text-mustard" />
              <span>{settings.opening_hours}</span>
            </div>
          </div>
          <div className="rounded-2xl border-4 border-cream bg-ember p-3 shadow-glow">
            <img
              src="/brand/la-manteca-brand.png"
              alt="La Manteca Burger — la clave del sabor"
              className="h-72 w-full object-contain sm:h-80"
            />
            <p className="border-t border-cream/30 pt-3 text-center text-sm font-bold tracking-wide text-cream">
              {settings.delivery_zones || "Estamos haciendo envíos"}
            </p>
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto max-w-6xl px-4 py-9 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[.16em] text-ember">
              Menú
            </p>
            <h2 className="text-3xl font-black">¿Qué se te antoja?</h2>
          </div>
          <p className="text-sm text-ember/80">
            {settings.delivery_fee > 0
              ? `Delivery: ${formatMoney(settings.delivery_fee, settings.currency_symbol)}`
              : "Consultá por delivery"}
          </p>
        </div>
        <div
          className="mb-7 flex gap-2 overflow-x-auto pb-2"
          role="tablist"
          aria-label="Categorías"
        >
          <CategoryButton
            active={selectedCategory === "all"}
            onClick={() => setSelectedCategory("all")}
          >
            Todo
          </CategoryButton>
          {categories.map((category) => (
            <CategoryButton
              key={category.id}
              active={selectedCategory === category.id}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </CategoryButton>
          ))}
        </div>
        {selectedCategory === "all" ? (
          <div className="space-y-12">
            {categories
              .filter((category) =>
                products.some(
                  (product) =>
                    product.available && product.category_id === category.id,
                ),
              )
              .map((category) => (
                <section
                  key={category.id}
                  aria-labelledby={`category-${category.id}`}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <h3
                      id={`category-${category.id}`}
                      className="text-2xl font-black text-ember"
                    >
                      {category.name}
                    </h3>
                    <span className="h-px flex-1 bg-ember/25" />
                  </div>
                  <ProductGrid
                    products={products.filter(
                      (product) =>
                        product.available &&
                        product.category_id === category.id,
                    )}
                    currency={settings.currency_symbol}
                    customizationFor={customizationFor}
                    onAdd={addFromMenu}
                  />
                </section>
              ))}
          </div>
        ) : (
          <ProductGrid
            products={visibleProducts}
            currency={settings.currency_symbol}
            customizationFor={customizationFor}
            onAdd={addFromMenu}
          />
        )}
      </section>

      {cartOpen && (
        <CartPanel
          cart={cart}
          subtotal={subtotal}
          settings={settings}
          onClose={() => setCartOpen(false)}
          onChange={updateCart}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />
      )}
      {configuring && (
        <ProductCustomizer
          product={configuring}
          customization={customizationFor(configuring)!}
          currency={settings.currency_symbol}
          onClose={() => setConfiguring(null)}
          onAdd={addCustomizedProduct}
        />
      )}
      {checkoutOpen && (
        <DeliveryCheckout
          cart={cart}
          settings={settings}
          onClose={() => setCheckoutOpen(false)}
          onSuccess={() => {
            setCart([]);
            setCheckoutOpen(false);
            setNotice("Pedido guardado. Se abrió WhatsApp para enviarlo.");
          }}
        />
      )}
      {notice && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-mustard px-5 py-3 text-sm font-bold text-ink shadow-glow"
        >
          {notice}
          <button
            onClick={() => setNotice("")}
            className="ml-3"
            aria-label="Cerrar aviso"
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}

function ProductGrid({
  products,
  currency,
  customizationFor,
  onAdd,
}: {
  products: Product[];
  currency: string;
  customizationFor: (product: Product) => BurgerCustomization | null;
  onAdd: (product: Product) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <article
          key={product.id}
          className="overflow-hidden rounded-2xl border border-white/10 bg-coal shadow-glow"
        >
          <div className="relative aspect-[16/9] bg-gradient-to-br from-[#a40f18] to-[#640910]">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-center text-sm text-cream/65">
                Foto del producto
                <br />
                pendiente de cargar
              </div>
            )}
            <span className="absolute left-3 top-3 rounded-full bg-ink/95 px-3 py-1 text-xs font-bold text-ember">
              Disponible
            </span>
          </div>
          <div className="p-5">
            <h3 className="text-xl font-black">{product.name}</h3>
            <p className="mt-2 min-h-10 text-sm leading-relaxed text-cream/65">
              {product.description}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3">
              <strong className="text-lg text-mustard">
                {formatMoney(
                  customizationFor(product)?.variants[0]?.price ??
                    product.sale_price,
                  currency,
                )}
              </strong>
              <button
                onClick={() => onAdd(product)}
                className="inline-flex items-center gap-1 rounded-full bg-ember px-4 py-2 text-sm font-bold text-white transition hover:bg-[#8b0b13]"
              >
                <Plus size={16} /> Agregar
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function CategoryButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${active ? "bg-cream text-ink" : "border border-ember/35 text-ember/85 hover:border-ember hover:text-ember"}`}
    >
      {children}
    </button>
  );
}

function ProductCustomizer({
  product,
  customization,
  currency,
  onClose,
  onAdd,
}: {
  product: Product;
  customization: BurgerCustomization;
  currency: string;
  onClose: () => void;
  onAdd: (
    product: Product,
    variant: ProductVariant,
    extras: (ProductExtra & { quantity: number })[],
  ) => void;
}) {
  const [variant, setVariant] = useState(customization.variants[0]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const extras = customization.extras.map((extra) => ({
    ...extra,
    quantity: quantities[extra.name] ?? 0,
  }));
  const extrasTotal = extras.reduce(
    (total, extra) => total + extra.price * extra.quantity,
    0,
  );
  const total = variant.price + extrasTotal;
  const changeExtra = (name: string, change: number) =>
    setQuantities((current) => ({
      ...current,
      [name]: Math.max(0, (current[name] ?? 0) + change),
    }));
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/65 sm:items-center sm:justify-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Personalizar ${product.name}`}
    >
      <section className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] bg-cream text-ember shadow-2xl sm:rounded-[2rem]">
        <header className="flex items-start justify-between border-b border-ember/15 px-5 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-ember/70">
              Personalizá tu pedido
            </p>
            <h2 className="mt-1 text-3xl font-black">{product.name}</h2>
            <p className="mt-2 max-w-sm font-sans text-sm leading-relaxed text-ember/80">
              {product.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-ember/10"
            aria-label="Cerrar opciones"
          >
            <X />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-black">Elegí la variante</h3>
              <span className="rounded-full bg-ember px-2.5 py-1 text-xs font-bold text-cream">
                Obligatorio
              </span>
            </div>
            <div className="space-y-2">
              {customization.variants.map((option) => (
                <button
                  type="button"
                  key={option.name}
                  onClick={() => setVariant(option)}
                  className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition ${variant.name === option.name ? "border-ember bg-ember text-cream" : "border-ember/20 bg-white/45 hover:border-ember/60"}`}
                >
                  <span className="font-black">{option.name}</span>
                  <span className="font-bold">
                    {formatMoney(option.price, currency)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-7">
            <h3 className="text-xl font-black">Extras para hamburguesas</h3>
            <div className="mt-3 divide-y divide-ember/15 rounded-2xl border border-ember/15 bg-white/40 px-4">
              {extras.map((extra) => (
                <div
                  key={extra.name}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-bold">{extra.name}</p>
                    <p className="font-sans text-sm text-ember/75">
                      {formatMoney(extra.price, currency)}
                    </p>
                  </div>
                  <div className="flex items-center rounded-full border border-ember/25 bg-cream">
                    <button
                      onClick={() => changeExtra(extra.name, -1)}
                      disabled={extra.quantity === 0}
                      className="p-2 disabled:opacity-30"
                      aria-label={`Quitar ${extra.name}`}
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-7 text-center text-sm font-black">
                      {extra.quantity}
                    </span>
                    <button
                      onClick={() => changeExtra(extra.name, 1)}
                      className="p-2"
                      aria-label={`Agregar ${extra.name}`}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <footer className="border-t border-ember/15 bg-cream px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-sans text-sm font-semibold">
              Total de tu hamburguesa
            </span>
            <strong className="text-2xl font-black">
              {formatMoney(total, currency)}
            </strong>
          </div>
          <button
            onClick={() => onAdd(product, variant, extras)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-ember px-5 py-3.5 font-black text-cream transition hover:bg-[#850a12]"
          >
            <ShoppingBag size={18} /> Agregar al pedido
          </button>
        </footer>
      </section>
    </div>
  );
}

function CartPanel({
  cart,
  subtotal,
  settings,
  onClose,
  onChange,
  onCheckout,
}: {
  cart: CartItem[];
  subtotal: number;
  settings: Settings;
  onClose: () => void;
  onChange: (product: Product, change: number) => void;
  onCheckout: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 bg-black/65"
      role="dialog"
      aria-modal="true"
      aria-label="Tu pedido"
    >
      <aside className="ml-auto flex h-full w-full max-w-md flex-col bg-coal shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <ShoppingBag /> Tu pedido
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-white/10"
            aria-label="Cerrar carrito"
          >
            <X />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {cart.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-cream/55">
              <div>
                <ShoppingBag className="mx-auto mb-3" size={36} />
                <p>Tu pedido está vacío.</p>
                <button
                  onClick={onClose}
                  className="mt-4 font-bold text-mustard"
                >
                  Ver menú
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white/5 text-ember">
                    <Flame size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{item.name}</p>
                    <p className="text-sm text-cream/60">
                      {formatMoney(item.sale_price, settings.currency_symbol)}{" "}
                      c/u
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-full border border-white/15">
                        <button
                          onClick={() => onChange(item, -1)}
                          className="p-1.5"
                          aria-label={`Quitar ${item.name}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-7 text-center text-sm font-bold">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onChange(item, 1)}
                          className="p-1.5"
                          aria-label={`Agregar ${item.name}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <strong>
                        {formatMoney(
                          item.sale_price * item.quantity,
                          settings.currency_symbol,
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {cart.length > 0 && (
          <div className="border-t border-white/10 p-5">
            <div className="mb-4 flex justify-between">
              <span className="text-cream/65">Subtotal</span>
              <strong>{formatMoney(subtotal, settings.currency_symbol)}</strong>
            </div>
            <button
              onClick={onCheckout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ember px-5 py-3 font-black text-white hover:bg-[#ff7137]"
            >
              Continuar pedido <ChevronRight size={18} />
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function Checkout({
  cart,
  settings,
  onClose,
  onSuccess,
}: {
  cart: CartItem[];
  settings: Settings;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [customer, setCustomer] = useState<CustomerDetails>(initialCustomer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const subtotal = cart.reduce(
    (total, item) => total + item.sale_price * item.quantity,
    0,
  );
  const delivery =
    customer.fulfillment === "delivery" ? settings.delivery_fee : 0;
  const total = subtotal + delivery;
  const change = (field: keyof CustomerDetails, value: string) =>
    setCustomer((valueNow) => ({ ...valueNow, [field]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await saveOrder(cart, customer, settings);
      const message = makeWhatsAppMessage(
        cart,
        customer,
        settings,
        total,
        delivery,
      );
      window.open(
        `https://wa.me/${settings.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer",
      );
      onSuccess();
    } catch {
      setError(
        "No pudimos guardar el pedido. Revisá la conexión e intentá otra vez.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto bg-black/65 p-3 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Finalizar pedido"
    >
      <form
        onSubmit={submit}
        className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-coal shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 p-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-ember">
              Último paso
            </p>
            <h2 className="text-xl font-black">Datos de entrega</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-white/10"
            aria-label="Cerrar"
          >
            <X />
          </button>
        </div>
        <div className="space-y-5 p-5">
          <Field
            label="Nombre y apellido"
            value={customer.name}
            onChange={(value) => change("name", value)}
            required
          />
          <Field
            label="Teléfono"
            type="tel"
            value={customer.phone}
            onChange={(value) => change("phone", value)}
            required
          />
          <div>
            <p className="mb-2 text-sm font-bold">¿Cómo lo recibís?</p>
            <div className="grid grid-cols-2 gap-2">
              <Choice
                checked={customer.fulfillment === "delivery"}
                onChange={() => change("fulfillment", "delivery")}
                icon={<Bike size={18} />}
                label="Delivery"
              />
              <Choice
                checked={customer.fulfillment === "pickup"}
                onChange={() => change("fulfillment", "pickup")}
                icon={<Store size={18} />}
                label="Retiro"
              />
            </div>
          </div>
          {customer.fulfillment === "delivery" && (
            <Field
              label="Dirección completa"
              value={customer.address}
              onChange={(value) => change("address", value)}
              required
            />
          )}
          <div>
            <p className="mb-2 text-sm font-bold">Forma de pago</p>
            <div className="grid grid-cols-2 gap-2">
              <Choice
                checked={customer.payment === "transfer"}
                onChange={() => change("payment", "transfer")}
                icon={<ClipboardList size={18} />}
                label="Transferencia"
              />
              <Choice
                checked={customer.payment === "cash"}
                onChange={() => change("payment", "cash")}
                icon={<span className="font-black">$</span>}
                label="Efectivo"
              />
            </div>
          </div>
          {customer.payment === "transfer" && (
            <div className="rounded-xl border border-mustard/30 bg-mustard/10 p-3 text-sm">
              <p className="font-bold text-mustard">Datos de transferencia</p>
              <p className="mt-1">Alias/CBU: {settings.transfer_alias}</p>
              <p>Titular: {settings.transfer_holder}</p>
            </div>
          )}
          {customer.payment === "cash" && (
            <Field
              label="¿Con cuánto pagás? (opcional)"
              type="number"
              value={customer.cash_amount}
              onChange={(value) => change("cash_amount", value)}
            />
          )}
          <Field
            label="Notas para el pedido (opcional)"
            value={customer.notes}
            onChange={(value) => change("notes", value)}
            textarea
          />
          <div className="rounded-xl bg-white/5 p-4 text-sm">
            <div className="flex justify-between text-cream/65">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal, settings.currency_symbol)}</span>
            </div>
            {delivery > 0 && (
              <div className="mt-1 flex justify-between text-cream/65">
                <span>Delivery</span>
                <span>{formatMoney(delivery, settings.currency_symbol)}</span>
              </div>
            )}
            <div className="mt-3 flex justify-between text-lg font-black">
              <span>Total</span>
              <span className="text-mustard">
                {formatMoney(total, settings.currency_symbol)}
              </span>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm font-bold text-red-300">
              {error}
            </p>
          )}
          <button
            disabled={saving}
            className="w-full rounded-xl bg-ember px-5 py-3 font-black text-white disabled:opacity-60"
          >
            {saving ? "Guardando pedido…" : "Guardar y pedir por WhatsApp"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  textarea?: boolean;
}) {
  const common = {
    value,
    required,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onChange(event.target.value),
    className:
      "mt-1 w-full rounded-xl border border-white/15 bg-ink px-3 py-2.5 text-cream outline-none placeholder:text-cream/30 focus:border-mustard",
  };
  return (
    <label className="block text-sm font-bold">
      {label}
      {textarea ? (
        <textarea {...common} rows={3} />
      ) : (
        <input {...common} type={type} />
      )}
    </label>
  );
}
function Choice({
  checked,
  onChange,
  icon,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold ${checked ? "border-mustard bg-mustard/15 text-mustard" : "border-white/15 text-cream/70"}`}
    >
      {icon}
      {label}
    </button>
  );
}
