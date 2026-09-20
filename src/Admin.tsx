import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Check,
  CircleDollarSign,
  LockKeyhole,
  LogOut,
  Package,
  Pencil,
  Save,
  Search,
  Settings2,
  Tags,
  Trash2,
} from "lucide-react";
import { formatMoney } from "./lib/orders";
import { supabase } from "./lib/supabase";
import { demoSettings } from "./data";
import type { BurgerAddon, Category, Product, Settings } from "./types";

type Tab = "dashboard" | "history" | "products" | "addons" | "settings";
const billableStatuses = new Set(["confirmed", "delivered"]);
const emptyProduct = {
  name: "",
  description: "",
  sale_price: 0,
  cost_price: 0,
  image_url: "",
  available: true,
  category_id: "",
  sort_order: 0,
};

export default function Admin() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => listener.subscription.unsubscribe();
  }, []);
  if (!ready)
    return (
      <main className="grid min-h-screen place-items-center bg-ink text-cream">
        Cargando…
      </main>
    );
  if (!supabase) return <ConfigRequired />;
  if (!session)
    return (
      <main className="grid min-h-screen place-items-center bg-ink px-4 text-cream">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const { error: authError } =
              await supabase!.auth.signInWithPassword({ email, password });
            if (authError) setError(authError.message);
          }}
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-coal p-6 shadow-glow"
        >
          <div className="mb-6 grid h-12 w-12 place-items-center rounded-full bg-ember text-ink">
            <LockKeyhole />
          </div>
          <p className="text-sm font-bold uppercase tracking-wider text-mustard">
            Administración
          </p>
          <h1 className="mt-1 text-3xl font-black">Ingresar al panel</h1>
          <label className="mt-6 block text-sm font-bold">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              className="mt-1 w-full rounded-xl border border-cream/20 bg-ink px-3 py-2.5 outline-none focus:border-mustard"
            />
          </label>
          <label className="mt-4 block text-sm font-bold">
            Contraseña
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              className="mt-1 w-full rounded-xl border border-cream/20 bg-ink px-3 py-2.5 outline-none focus:border-mustard"
            />
          </label>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          <button className="mt-6 w-full rounded-xl bg-ember py-3 font-black text-ink transition hover:bg-mustard">
            Ingresar
          </button>
        </form>
      </main>
    );
  return <OwnerPanel onSignOut={() => void supabase!.auth.signOut()} />;
}

function ConfigRequired() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink px-4 text-cream">
      <section className="max-w-lg rounded-2xl border border-mustard/30 bg-coal p-7">
        <LockKeyhole className="mb-4 text-mustard" />
        <h1 className="text-2xl font-black">Configurá Supabase para acceder</h1>
        <p className="mt-3 text-cream/70">
          Copiá <code>.env.example</code> como <code>.env.local</code> y
          completá la URL y la clave pública de tu proyecto. Después ejecutá el
          esquema de <code>supabase/schema.sql</code> y creá el usuario
          administrador en Authentication.
        </p>
      </section>
    </main>
  );
}

function OwnerPanel({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addons, setAddons] = useState<BurgerAddon[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [settings, setSettings] = useState<Settings | null>(demoSettings);
  const [editing, setEditing] = useState<any>(null);
  const [categoryName, setCategoryName] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    const client: any = supabase;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [
      orderedProductData,
      categoryData,
      addonData,
      orderData,
      settingsData,
    ] = await Promise.all([
      client.from("products").select("*").order("sort_order").order("name"),
      client.from("categories").select("*").order("sort_order"),
      client.from("burger_addons").select("*").order("sort_order"),
      client
        .from("orders")
        .select("*, order_items(*)")
        .gte("created_at", start.toISOString())
        .order("created_at", { ascending: false }),
      client.from("business_settings").select("*").limit(1).maybeSingle(),
    ]);
    const productData = orderedProductData.error
      ? await client.from("products").select("*").order("name")
      : orderedProductData;
    if (productData.data) setProducts(productData.data);
    if (categoryData.data) setCategories(categoryData.data);
    if (addonData.data) setAddons(addonData.data);
    if (orderData.data) setOrders(orderData.data);
    if (settingsData.data) setSettings(settingsData.data);
  };
  useEffect(() => {
    void load();
  }, []);
  const metrics = useMemo(() => {
    const billable = orders.filter((order) =>
      billableStatuses.has(order.status),
    );
    const revenue = billable.reduce(
      (sum, order) => sum + Number(order.total),
      0,
    );
    const costs = billable
      .flatMap((order) => order.order_items ?? [])
      .reduce(
        (sum: number, item: any) =>
          sum + Number(item.unit_cost) * Number(item.quantity),
        0,
      );
    return { count: billable.length, revenue, profit: revenue - costs };
  }, [orders]);
  const updateTodayOrderStatus = (orderId: string, nextStatus: string) => {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status: nextStatus } : order,
      ),
    );
  };
  const saveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    const client: any = supabase;
    const payload = {
      ...editing,
      sale_price: Number(editing.sale_price),
      cost_price: Number(editing.cost_price),
      image_url: editing.image_url || null,
      sort_order: editing.id
        ? Number(editing.sort_order ?? 0)
        : products
            .filter((product) => product.category_id === editing.category_id)
            .reduce(
              (highest, product) =>
                Math.max(highest, Number(product.sort_order ?? 0)),
              -1,
            ) + 1,
    };
    const result = editing.id
      ? await client.from("products").update(payload).eq("id", editing.id)
      : await client.from("products").insert(payload);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setEditing(null);
    setMessage("Producto guardado.");
    void load();
  };
  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    const client: any = supabase;
    const result = settings.id
      ? await client
          .from("business_settings")
          .update(settings)
          .eq("id", settings.id)
      : await client.from("business_settings").insert(settings);
    setMessage(result.error?.message ?? "Configuración guardada.");
    void load();
  };
  return (
    <main className="min-h-screen bg-ink text-cream">
      <header className="border-b border-mustard/30 bg-coal text-cream shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/brand/la-manteca-mascot-v2.png"
              alt="La Manteca"
              className="h-12 w-12 scale-110 object-contain drop-shadow-[0_4px_8px_rgba(210,74,22,0.25)]"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-mustard">
                Panel del dueño
              </p>
              <h1 className="text-xl font-black">Administración</h1>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-cream/70 hover:bg-white/5 hover:text-cream"
          >
            <LogOut size={17} /> Salir
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[190px_1fr]">
        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-cream/15 bg-coal p-2 shadow-[0_12px_30px_rgba(0,0,0,0.22)] lg:block lg:h-fit lg:space-y-2">
          {(
            [
              {
                id: "dashboard",
                label: "Resumen",
                icon: <BarChart3 size={17} />,
              },
              {
                id: "history",
                label: "Historial",
                icon: <CalendarDays size={17} />,
              },
              { id: "products", label: "Menú", icon: <Package size={17} /> },
              {
                id: "addons",
                label: "Adicionales",
                icon: <CircleDollarSign size={17} />,
              },
              {
                id: "settings",
                label: "Configuración",
                icon: <Settings2 size={17} />,
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex w-auto shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition lg:w-full ${tab === item.id ? "bg-ember text-ink shadow-sm" : "text-cream/70 hover:bg-mustard/10 hover:text-mustard"}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <section>
          {message && (
            <p className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-sm font-bold text-emerald-200">
              {message}
            </p>
          )}
          {tab === "dashboard" && (
            <Dashboard
              metrics={metrics}
              orders={orders}
              onStatusChange={updateTodayOrderStatus}
            />
          )}
          {tab === "history" && <OrderHistory />}
          {tab === "products" && (
            <MenuManager
              products={products}
              categories={categories}
              editing={editing}
              setEditing={setEditing}
              onSave={saveProduct}
              categoryName={categoryName}
              setCategoryName={setCategoryName}
              reload={load}
              setMessage={setMessage}
            />
          )}
          {tab === "addons" && (
            <AddonsManager
              addons={addons}
              reload={load}
              setMessage={setMessage}
            />
          )}
          {tab === "settings" && (
            <SettingsForm
              settings={settings}
              setSettings={setSettings}
              onSave={saveSettings}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function Dashboard({
  metrics,
  orders,
  onStatusChange,
}: {
  metrics: { count: number; revenue: number; profit: number };
  orders: any[];
  onStatusChange: (orderId: string, status: string) => void;
}) {
  const money = (value: number) => formatMoney(value);
  return (
    <>
      <div className="mb-6">
        <p className="text-sm font-bold uppercase tracking-widest text-mustard">
          Hoy
        </p>
        <h2 className="text-3xl font-black">Resumen de pedidos</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Pedidos facturados",
            value: metrics.count,
            help: "Solo confirmados o entregados",
          },
          {
            label: "Facturación",
            value: money(metrics.revenue),
            help: "Solo confirmados o entregados",
          },
          {
            label: "Ganancia bruta",
            value: money(metrics.profit),
            help: "Ventas menos costo de productos",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-cream/15 bg-coal p-5 shadow-[0_12px_30px_rgba(0,0,0,0.2)]"
          >
            <p className="text-sm font-semibold text-cream/65">
              {metric.label}
            </p>
            <p className="mt-2 text-3xl font-black text-mustard">
              {metric.value}
            </p>
            <p className="mt-2 text-xs text-cream/50">{metric.help}</p>
          </div>
        ))}
      </div>
      <div className="mt-7 overflow-hidden rounded-2xl border border-cream/15 bg-coal shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
        <div className="border-b border-cream/10 bg-ink/60 p-5">
          <h3 className="font-black">Pedidos de hoy</h3>
        </div>
        {orders.length === 0 ? (
          <p className="p-5 text-sm text-cream/60">
            Todavía no hay pedidos hoy.
          </p>
        ) : (
          <div className="divide-y divide-cream/10">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-bold">{order.customer_name}</p>
                  <p className="text-sm text-cream/60">
                    {order.fulfillment_type === "delivery"
                      ? "Delivery"
                      : "Retiro"}{" "}
                    ·{" "}
                    {order.payment_method === "transfer"
                      ? "Transferencia"
                      : "Efectivo"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <strong>{money(Number(order.total))}</strong>
                  <StatusSelect
                    order={order}
                    onChanged={(nextStatus) =>
                      onStatusChange(order.id, nextStatus)
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
function StatusSelect({
  order,
  onChanged,
}: {
  order: any;
  onChanged?: (status: string) => void;
}) {
  const [value, setValue] = useState(order.status);
  return (
    <select
      aria-label="Estado del pedido"
      value={value}
      onClick={(event) => event.stopPropagation()}
      onChange={async (event) => {
        const previous = value;
        const next = event.target.value;
        setValue(next);
        const { error } = await (supabase as any)
          .from("orders")
          .update({ status: next })
          .eq("id", order.id);
        if (error) {
          setValue(previous);
          return;
        }
        onChanged?.(next);
      }}
      className="rounded-lg border border-mustard/50 bg-mustard/10 px-2 py-1.5 text-sm font-semibold text-cream outline-none focus:border-ember"
    >
      {[
        ["new", "Nuevo"],
        ["confirmed", "Confirmado"],
        ["preparing", "Preparando"],
        ["delivered", "Entregado"],
        ["cancelled", "Cancelado"],
      ].map(([id, label]) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  );
}

const statusOptions = [
  ["new", "Nuevo"],
  ["confirmed", "Confirmado"],
  ["preparing", "Preparando"],
  ["delivered", "Entregado"],
  ["cancelled", "Cancelado"],
] as const;

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function OrderHistory() {
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return toDateInput(date);
  });
  const [to, setTo] = useState(() => toDateInput(new Date()));
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(`${to}T00:00:00`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        setError("Elegí una fecha desde y una fecha hasta.");
        setOrders([]);
        setLoading(false);
        return;
      }
      if (start > end) {
        setError("La fecha desde no puede ser posterior a la fecha hasta.");
        setOrders([]);
        setLoading(false);
        return;
      }
      end.setDate(end.getDate() + 1);
      setLoading(true);
      setError("");

      const collected: any[] = [];
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        let query = (supabase as any)
          .from("orders")
          .select("*, order_items(*)")
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString())
          .order("created_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (status !== "all") query = query.eq("status", status);
        const result = await query;
        if (!active) return;
        if (result.error) {
          setError("No pudimos cargar el historial de pedidos.");
          setOrders([]);
          setLoading(false);
          return;
        }
        const page = result.data ?? [];
        collected.push(...page);
        if (page.length < pageSize) break;
      }
      if (active) {
        setOrders(collected);
        setLoading(false);
      }
    };
    void loadHistory();
    return () => {
      active = false;
    };
  }, [from, to, status]);

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return orders.filter((order) => {
      if (status !== "all" && order.status !== status) return false;
      if (!term) return true;
      const searchable = [
        order.customer_name,
        order.delivery_address,
        order.notes,
        ...(order.order_items ?? []).map((item: any) => item.product_name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es");
      return searchable.includes(term);
    });
  }, [orders, search, status]);

  const metrics = useMemo(() => {
    const billableOrders = visibleOrders.filter((order) =>
      billableStatuses.has(order.status),
    );
    const revenue = billableOrders.reduce(
      (sum, order) => sum + Number(order.total),
      0,
    );
    const costs = billableOrders
      .flatMap((order) => order.order_items ?? [])
      .reduce(
        (sum: number, item: any) =>
          sum + Number(item.unit_cost) * Number(item.quantity),
        0,
      );
    return { count: visibleOrders.length, revenue, profit: revenue - costs };
  }, [visibleOrders]);

  const updateLocalStatus = (orderId: string, nextStatus: string) => {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status: nextStatus } : order,
      ),
    );
  };

  const deleteOrder = async (order: any) => {
    const orderDate = new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(order.created_at));
    if (
      !confirm(
        `¿Eliminar el pedido de ${order.customer_name} del ${orderDate}?\n\nEsta acción no se puede deshacer.`,
      )
    )
      return;
    const result = await (supabase as any)
      .from("orders")
      .delete()
      .eq("id", order.id);
    if (result.error) {
      setError("No pudimos eliminar el pedido. Intentá nuevamente.");
      return;
    }
    setOrders((current) => current.filter((item) => item.id !== order.id));
  };

  return (
    <>
      <div className="mb-6">
        <p className="text-sm font-bold uppercase tracking-widest text-mustard">
          Pedidos guardados
        </p>
        <h2 className="text-3xl font-black">Historial de pedidos</h2>
      </div>

      <div className="rounded-2xl border border-cream/15 bg-coal p-4 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.4fr]">
          <label className="text-sm font-bold">
            Desde
            <input
              type="date"
              required
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full rounded-xl border border-cream/20 bg-ink px-3 py-2.5 text-cream outline-none [color-scheme:dark] focus:border-mustard"
            />
          </label>
          <label className="text-sm font-bold">
            Hasta
            <input
              type="date"
              required
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-xl border border-cream/20 bg-ink px-3 py-2.5 text-cream outline-none [color-scheme:dark] focus:border-mustard"
            />
          </label>
          <label className="text-sm font-bold">
            Estado
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-1 w-full rounded-xl border border-cream/20 bg-ink px-3 py-2.5 text-cream outline-none focus:border-mustard"
            >
              <option value="all">Todos</option>
              {statusOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Buscar
            <span className="relative mt-1 block">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cream/40"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cliente, producto o dirección"
                className="w-full rounded-xl border border-cream/20 bg-ink py-2.5 pl-9 pr-3 text-cream outline-none placeholder:text-cream/35 focus:border-mustard"
              />
            </span>
          </label>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-sm font-bold text-red-200">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Pedidos encontrados", value: metrics.count },
          { label: "Facturación", value: formatMoney(metrics.revenue) },
          { label: "Ganancia bruta", value: formatMoney(metrics.profit) },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-cream/15 bg-coal p-4 shadow-[0_12px_30px_rgba(0,0,0,0.2)]"
          >
            <p className="text-xs font-semibold text-cream/65">
              {metric.label}
            </p>
            <p className="mt-1 text-2xl font-black text-mustard">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-cream/15 bg-coal shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
        <div className="border-b border-cream/10 bg-ink/60 p-4">
          <h3 className="font-black">Detalle del período</h3>
          <p className="mt-1 text-xs text-cream/60">
            La facturación y ganancia solo incluyen pedidos confirmados o
            entregados.
          </p>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-cream/60">Cargando pedidos…</p>
        ) : visibleOrders.length === 0 ? (
          <p className="p-5 text-sm text-cream/60">
            No hay pedidos que coincidan con estos filtros.
          </p>
        ) : (
          <div className="divide-y divide-cream/10">
            {visibleOrders.map((order) => (
              <details key={order.id} className="group p-4 open:bg-mustard/5">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-[180px] flex-1">
                    <p className="font-bold">{order.customer_name}</p>
                    <p className="text-sm text-cream/60">
                      {new Intl.DateTimeFormat("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(order.created_at))}
                      {" · "}
                      {order.fulfillment_type === "delivery"
                        ? "Delivery"
                        : "Retiro"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <strong>{formatMoney(Number(order.total))}</strong>
                    <StatusSelect
                      order={order}
                      onChanged={(nextStatus) =>
                        updateLocalStatus(order.id, nextStatus)
                      }
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void deleteOrder(order);
                      }}
                      className="rounded-lg border border-red-500/30 bg-red-950/30 p-2 text-red-300 transition hover:bg-red-900/45"
                      aria-label={`Eliminar pedido de ${order.customer_name}`}
                      title="Eliminar pedido"
                    >
                      <Trash2 size={17} />
                    </button>
                    <span className="text-xs font-bold text-cream/50 group-open:hidden">
                      Ver detalle
                    </span>
                    <span className="hidden text-xs font-bold text-cream/50 group-open:inline">
                      Ocultar
                    </span>
                  </div>
                </summary>
                <div className="mt-4 grid gap-4 border-t border-cream/15 pt-4 lg:grid-cols-[1.4fr_1fr]">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-mustard">
                      Productos
                    </p>
                    <div className="mt-2 space-y-2">
                      {(order.order_items ?? []).map((item: any) => (
                        <div
                          key={item.id}
                          className="flex justify-between gap-3 text-sm"
                        >
                          <span>
                            {item.quantity}× {item.product_name}
                          </span>
                          <strong>
                            {formatMoney(
                              Number(item.unit_price) * Number(item.quantity),
                            )}
                          </strong>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-cream/70">
                    <p>
                      <strong className="text-cream">Pago:</strong>{" "}
                      {order.payment_method === "transfer"
                        ? "Transferencia"
                        : "Efectivo"}
                    </p>
                    {order.delivery_address && (
                      <p>
                        <strong className="text-cream">Dirección:</strong>{" "}
                        {order.delivery_address}
                      </p>
                    )}
                    {order.notes && (
                      <p>
                        <strong className="text-cream">Notas:</strong>{" "}
                        {order.notes}
                      </p>
                    )}
                    <p className="break-all text-xs text-cream/40">
                      Pedido {order.id}
                    </p>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function MenuManager({
  products,
  categories,
  editing,
  setEditing,
  onSave,
  categoryName,
  setCategoryName,
  reload,
  setMessage,
}: any) {
  const orderedProducts: Product[] = [
    ...categories.flatMap((category: Category) =>
      products
        .filter((product: Product) => product.category_id === category.id)
        .sort(
          (first: Product, second: Product) =>
            Number(first.sort_order ?? 0) - Number(second.sort_order ?? 0) ||
            first.name.localeCompare(second.name, "es"),
        ),
    ),
    ...products.filter(
      (product: Product) =>
        !categories.some(
          (category: Category) => category.id === product.category_id,
        ),
    ),
  ];

  const moveProduct = async (product: Product, direction: -1 | 1) => {
    const siblings = orderedProducts.filter(
      (item) => item.category_id === product.category_id,
    );
    const currentIndex = siblings.findIndex((item) => item.id === product.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length)
      return;
    const reordered = [...siblings];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];
    const results = await Promise.all(
      reordered.map((item, index) =>
        (supabase as any)
          .from("products")
          .update({ sort_order: index })
          .eq("id", item.id),
      ),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) {
      setMessage(failed.error.message);
      return;
    }
    setMessage(`${product.name} cambió de posición.`);
    await reload();
  };

  const addCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoryName.trim()) return;
    await (supabase as any)
      .from("categories")
      .insert({ name: categoryName.trim(), sort_order: categories.length + 1 });
    setCategoryName("");
    void reload();
  };
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-mustard">
            Catálogo
          </p>
          <h2 className="text-3xl font-black">Productos y categorías</h2>
        </div>
        <button
          onClick={() =>
            setEditing({
              ...emptyProduct,
              category_id: categories[0]?.id ?? "",
            })
          }
          className="rounded-xl bg-ember px-4 py-2.5 text-sm font-black text-ink shadow-sm transition hover:bg-mustard"
        >
          Nuevo producto
        </button>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <div className="rounded-2xl border border-cream/15 bg-coal p-5 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
          <h3 className="flex items-center gap-2 font-black">
            <Tags size={18} /> Categorías
          </h3>
          <form onSubmit={addCategory} className="mt-4 flex gap-2">
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Nueva categoría"
              className="min-w-0 flex-1 rounded-xl border border-cream/20 bg-ink px-3 py-2 text-cream outline-none placeholder:text-cream/35 focus:border-mustard"
            />
            <button className="rounded-xl bg-ember px-3 font-black text-ink transition hover:bg-mustard">
              Agregar
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {categories.map((category: Category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-xl border border-cream/10 bg-ink px-3 py-2"
              >
                <span>{category.name}</span>
                <button
                  onClick={async () => {
                    if (confirm(`¿Eliminar ${category.name}?`)) {
                      await (supabase as any)
                        .from("categories")
                        .delete()
                        .eq("id", category.id);
                      void reload();
                    }
                  }}
                  className="text-cream/45 transition hover:text-ember"
                  aria-label={`Eliminar ${category.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-cream/15 bg-coal shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
          <div className="border-b border-cream/10 bg-ink/60 p-5">
            <h3 className="font-black">Productos</h3>
          </div>
          {orderedProducts.map((product: Product) => {
            const siblings = orderedProducts.filter(
              (item) => item.category_id === product.category_id,
            );
            const position = siblings.findIndex(
              (item) => item.id === product.id,
            );
            const category = categories.find(
              (item: Category) => item.id === product.category_id,
            );
            return (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 border-b border-cream/10 p-4 last:border-0 hover:bg-mustard/5"
              >
                <div>
                  <p className="font-bold">{product.name}</p>
                  <p className="text-sm text-cream/60">
                    {category?.name ?? "Sin categoría"} ·{" "}
                    {formatMoney(product.sale_price)} ·{" "}
                    {product.available ? "Disponible" : "No disponible"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={position === 0}
                    onClick={() => void moveProduct(product, -1)}
                    className="rounded-lg p-2 text-ember transition hover:bg-ember/10 disabled:cursor-not-allowed disabled:opacity-25"
                    aria-label={`Subir ${product.name}`}
                    title="Mostrar antes"
                  >
                    <ArrowUp size={17} />
                  </button>
                  <button
                    type="button"
                    disabled={position === siblings.length - 1}
                    onClick={() => void moveProduct(product, 1)}
                    className="rounded-lg p-2 text-ember transition hover:bg-ember/10 disabled:cursor-not-allowed disabled:opacity-25"
                    aria-label={`Bajar ${product.name}`}
                    title="Mostrar después"
                  >
                    <ArrowDown size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(product)}
                    className="rounded-lg p-2 text-ember transition hover:bg-ember/10"
                    aria-label={`Editar ${product.name}`}
                    title="Editar producto"
                  >
                    <Pencil size={17} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 p-4">
          <form
            onSubmit={onSave}
            className="mx-auto my-5 max-w-xl rounded-2xl border border-cream/15 bg-coal p-6 text-cream shadow-2xl"
          >
            <div className="mb-5 flex justify-between">
              <h3 className="text-xl font-black">
                {editing.id ? "Editar producto" : "Nuevo producto"}
              </h3>
              <button type="button" onClick={() => setEditing(null)}>
                ×
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminField
                label="Nombre"
                value={editing.name}
                onChange={(value: string) =>
                  setEditing({ ...editing, name: value })
                }
              />
              <AdminField
                label="Precio de venta"
                type="number"
                value={editing.sale_price}
                onChange={(value: string) =>
                  setEditing({ ...editing, sale_price: value })
                }
              />
              <AdminField
                label="Costo base del producto"
                type="number"
                value={editing.cost_price}
                onChange={(value: string) =>
                  setEditing({ ...editing, cost_price: value })
                }
              />
              <label className="text-sm font-bold">
                Categoría
                <select
                  value={editing.category_id}
                  onChange={(event) =>
                    setEditing({ ...editing, category_id: event.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-cream/20 bg-ink px-3 py-2.5 text-cream outline-none focus:border-mustard"
                >
                  {categories.map((category: Category) => (
                    <option value={category.id} key={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <AdminField
              label="Descripción"
              value={editing.description}
              onChange={(value: string) =>
                setEditing({ ...editing, description: value })
              }
              textarea
            />
            <AdminField
              label="URL de la foto (subida a Storage)"
              value={editing.image_url ?? ""}
              onChange={(value: string) =>
                setEditing({ ...editing, image_url: value })
              }
            />
            <label className="mt-4 flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={editing.available}
                onChange={(event) =>
                  setEditing({ ...editing, available: event.target.checked })
                }
              />{" "}
              Disponible en el menú
            </label>
            <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-ember py-3 font-black text-ink transition hover:bg-mustard">
              <Save size={17} /> Guardar producto
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function AddonsManager({
  addons,
  reload,
  setMessage,
}: {
  addons: BurgerAddon[];
  reload: () => Promise<void>;
  setMessage: (message: string) => void;
}) {
  const createAddon = async () => {
    const nextOrder =
      addons.reduce(
        (highest, addon) => Math.max(highest, addon.sort_order),
        0,
      ) + 1;
    const result = await (supabase as any).from("burger_addons").insert({
      name: "Nuevo adicional",
      sale_price: 0,
      cost_price: 0,
      kind: "extra",
      available: true,
      sort_order: nextOrder,
    });
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setMessage("Adicional creado. Ya podés editarlo.");
    await reload();
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-mustard">
            Configuración global
          </p>
          <h2 className="text-3xl font-black">Adicionales y costos</h2>
          <p className="mt-2 max-w-2xl text-sm text-cream/60">
            Estos valores se aplican a todas las hamburguesas. El costo base de
            cada producto corresponde a la versión Simple; los costos de
            medallones y adicionales se suman automáticamente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void createAddon()}
          className="rounded-xl bg-ember px-4 py-2.5 text-sm font-black text-ink shadow-sm transition hover:bg-mustard"
        >
          + Nuevo adicional
        </button>
      </div>

      {addons.length === 0 ? (
        <div className="rounded-2xl border border-mustard/40 bg-mustard/10 p-5 text-sm text-cream">
          No se encontró la configuración de adicionales. Ejecutá la migración
          <code className="mx-1 font-bold">
            supabase/global-addons-migration.sql
          </code>
          en Supabase.
        </div>
      ) : (
        <div className="space-y-4">
          {addons.map((addon) => (
            <AddonRow
              key={addon.id}
              addon={addon}
              reload={reload}
              setMessage={setMessage}
            />
          ))}
        </div>
      )}
    </>
  );
}

function AddonRow({
  addon,
  reload,
  setMessage,
}: {
  addon: BurgerAddon;
  reload: () => Promise<void>;
  setMessage: (message: string) => void;
}) {
  const [draft, setDraft] = useState(addon);
  useEffect(() => setDraft(addon), [addon]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await (supabase as any)
      .from("burger_addons")
      .update({
        name: draft.name.trim(),
        sale_price: Number(draft.sale_price),
        cost_price: Number(draft.cost_price),
        available: draft.kind === "patty" ? true : draft.available,
      })
      .eq("id", draft.id);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setMessage(`${draft.name} guardado para todas las hamburguesas.`);
    await reload();
  };

  const remove = async () => {
    if (!confirm(`¿Eliminar el adicional ${addon.name}?`)) return;
    const result = await (supabase as any)
      .from("burger_addons")
      .delete()
      .eq("id", addon.id);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    setMessage("Adicional eliminado.");
    await reload();
  };

  return (
    <form
      onSubmit={save}
      className="rounded-2xl border border-cream/15 bg-coal p-4 shadow-[0_12px_30px_rgba(0,0,0,0.2)]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-black ${draft.kind === "patty" ? "bg-ember text-ink" : "bg-mustard/15 text-mustard"}`}
        >
          {draft.kind === "patty" ? "Variantes Doble/Triple" : "Adicional"}
        </span>
        {draft.kind === "extra" && (
          <label className="flex items-center gap-2 text-xs font-bold text-cream/70">
            <input
              type="checkbox"
              className="accent-ember"
              checked={draft.available}
              onChange={(event) =>
                setDraft({ ...draft, available: event.target.checked })
              }
            />
            Visible
          </label>
        )}
      </div>
      <div className="grid items-end gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
        <label className="text-sm font-bold">
          Nombre
          <input
            required
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
            className="mt-1 w-full rounded-xl border border-cream/20 bg-ink px-3 py-2.5 text-cream outline-none focus:border-mustard"
          />
        </label>
        <label className="text-sm font-bold">
          Precio de venta
          <input
            required
            min="0"
            step="1"
            type="number"
            value={draft.sale_price}
            onChange={(event) =>
              setDraft({ ...draft, sale_price: Number(event.target.value) })
            }
            className="mt-1 w-full rounded-xl border border-cream/20 bg-ink px-3 py-2.5 text-cream outline-none focus:border-mustard"
          />
        </label>
        <label className="text-sm font-bold">
          Costo para el local
          <input
            required
            min="0"
            step="1"
            type="number"
            value={draft.cost_price}
            onChange={(event) =>
              setDraft({ ...draft, cost_price: Number(event.target.value) })
            }
            className="mt-1 w-full rounded-xl border border-cream/20 bg-ink px-3 py-2.5 text-cream outline-none focus:border-mustard"
          />
        </label>
        <div className="flex gap-2">
          <button
            className="grid h-11 place-items-center rounded-xl bg-ember px-4 font-black text-ink transition hover:bg-mustard"
            title="Guardar cambios"
            aria-label={`Guardar ${draft.name}`}
          >
            <Save size={18} />
          </button>
          {draft.kind === "extra" && (
            <button
              type="button"
              onClick={() => void remove()}
              className="grid h-11 w-11 place-items-center rounded-xl border border-red-500/30 bg-red-950/30 text-red-300 transition hover:bg-red-900/45"
              title="Eliminar adicional"
              aria-label={`Eliminar ${draft.name}`}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>
      {draft.kind === "patty" && (
        <p className="mt-3 text-xs text-cream/60">
          La Doble suma una vez este precio y costo; la Triple los suma dos
          veces.
        </p>
      )}
    </form>
  );
}

function SettingsForm({ settings, setSettings, onSave }: any) {
  if (!settings)
    return <p className="text-cream/60">Cargando configuración…</p>;
  const numericFields = [
    "delivery_fee",
    "delivery_radius_km",
    "latitude",
    "longitude",
  ];
  const update = (key: string, value: string) =>
    setSettings({
      ...settings,
      [key]: numericFields.includes(key) ? Number(value) : value,
    });
  return (
    <form
      onSubmit={onSave}
      className="max-w-2xl rounded-2xl border border-cream/15 bg-coal p-6 shadow-[0_12px_30px_rgba(0,0,0,0.2)]"
    >
      <p className="text-sm font-bold uppercase tracking-widest text-mustard">
        Negocio
      </p>
      <h2 className="mb-6 text-3xl font-black">Configuración</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <AdminField
          label="Nombre del local"
          value={settings.business_name}
          onChange={(v: string) => update("business_name", v)}
        />
        <AdminField
          label="WhatsApp (código país + número)"
          value={settings.whatsapp_number}
          onChange={(v: string) => update("whatsapp_number", v)}
        />
        <AdminField
          label="Alias / CBU"
          value={settings.transfer_alias}
          onChange={(v: string) => update("transfer_alias", v)}
        />
        <AdminField
          label="Titular"
          value={settings.transfer_holder}
          onChange={(v: string) => update("transfer_holder", v)}
        />
        <AdminField
          label="Banco"
          value={settings.transfer_bank ?? ""}
          onChange={(v: string) => update("transfer_bank", v)}
        />
        <AdminField
          label="Costo de delivery"
          type="number"
          value={settings.delivery_fee}
          onChange={(v: string) => update("delivery_fee", v)}
        />
        <AdminField
          label="Radio de delivery (km)"
          type="number"
          value={settings.delivery_radius_km}
          onChange={(v: string) => update("delivery_radius_km", v)}
        />
        <AdminField
          label="Dirección"
          value={settings.address}
          onChange={(v: string) => update("address", v)}
        />
        <AdminField
          label="Horarios"
          value={settings.opening_hours}
          onChange={(v: string) => update("opening_hours", v)}
        />
        <AdminField
          label="Latitud del local"
          type="number"
          value={settings.latitude}
          onChange={(v: string) => update("latitude", v)}
        />
        <AdminField
          label="Longitud del local"
          type="number"
          value={settings.longitude}
          onChange={(v: string) => update("longitude", v)}
        />
      </div>
      <AdminField
        label="Zonas de delivery"
        value={settings.delivery_zones}
        onChange={(v: string) => update("delivery_zones", v)}
        textarea
      />
      <p className="mt-3 text-xs text-cream/60">
        El radio se calcula en línea recta desde las coordenadas del local.
      </p>
      <button className="mt-5 flex items-center gap-2 rounded-xl bg-ember px-5 py-3 font-black text-ink transition hover:bg-mustard">
        <Check size={18} /> Guardar configuración
      </button>
    </form>
  );
}
function AdminField({
  label,
  value,
  onChange,
  type = "text",
  textarea = false,
}: any) {
  const common = {
    value: value ?? "",
    onChange: (event: any) => onChange(event.target.value),
    className:
      "mt-1 w-full rounded-xl border border-cream/20 bg-ink px-3 py-2.5 text-cream outline-none placeholder:text-cream/35 focus:border-mustard",
  };
  const isPhoto = label === "URL de la foto (subida a Storage)";
  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !supabase) return;
    const filename = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(filename, file, { upsert: false });
    if (!error)
      onChange(
        supabase.storage.from("product-images").getPublicUrl(filename).data
          .publicUrl,
      );
  };
  return (
    <label className={`block text-sm font-bold ${textarea ? "mt-4" : ""}`}>
      {label}
      {textarea ? (
        <textarea {...common} rows={3} />
      ) : (
        <input {...common} type={type} required />
      )}
      {isPhoto && (
        <>
          <span className="mt-2 block text-xs font-normal text-cream/60">
            o subí una foto real del producto:
          </span>
          <input
            onChange={uploadPhoto}
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-xs font-normal text-cream/60 file:mr-3 file:rounded-lg file:border-0 file:bg-ember file:px-3 file:py-2 file:font-bold file:text-ink"
          />
        </>
      )}
    </label>
  );
}
