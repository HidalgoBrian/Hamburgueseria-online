import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
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
import type { Category, Product, Settings } from "./types";

type Tab = "dashboard" | "history" | "products" | "settings";
const billableStatuses = new Set(["confirmed", "delivered"]);
const emptyProduct = {
  name: "",
  description: "",
  sale_price: 0,
  cost_price: 0,
  image_url: "",
  available: true,
  category_id: "",
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
          <div className="mb-6 grid h-12 w-12 place-items-center rounded-full bg-ember">
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
              className="mt-1 w-full rounded-xl border border-white/15 bg-ink px-3 py-2.5"
            />
          </label>
          <label className="mt-4 block text-sm font-bold">
            Contraseña
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              className="mt-1 w-full rounded-xl border border-white/15 bg-ink px-3 py-2.5"
            />
          </label>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          <button className="mt-6 w-full rounded-xl bg-ember py-3 font-black">
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
  const [orders, setOrders] = useState<any[]>([]);
  const [settings, setSettings] = useState<Settings | null>(demoSettings);
  const [editing, setEditing] = useState<any>(null);
  const [categoryName, setCategoryName] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    const client: any = supabase;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [productData, categoryData, orderData, settingsData] =
      await Promise.all([
        client.from("products").select("*").order("name"),
        client.from("categories").select("*").order("sort_order"),
        client
          .from("orders")
          .select("*, order_items(*)")
          .gte("created_at", start.toISOString())
          .order("created_at", { ascending: false }),
        client.from("business_settings").select("*").limit(1).maybeSingle(),
      ]);
    if (productData.data) setProducts(productData.data);
    if (categoryData.data) setCategories(categoryData.data);
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
    <main className="min-h-screen bg-[#fff7e8] text-[#4f171c]">
      <header className="border-b border-[#7f0d14] bg-[#a91119] text-[#fff1ca] shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-mustard">
              Panel del dueño
            </p>
            <h1 className="text-xl font-black">Administración</h1>
          </div>
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#fff1ca]/80 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={17} /> Salir
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[190px_1fr]">
        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-[#ead8bd] bg-white p-2 shadow-sm lg:block lg:h-fit lg:space-y-2">
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
                id: "settings",
                label: "Configuración",
                icon: <Settings2 size={17} />,
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex w-auto shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition lg:w-full ${tab === item.id ? "bg-[#b8171d] text-white shadow-sm" : "text-[#6e3337] hover:bg-[#fff0cf] hover:text-[#a40f18]"}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <section>
          {message && (
            <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
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
        <p className="text-sm font-bold uppercase tracking-widest text-[#b8171d]">
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
            className="rounded-2xl border border-[#ead8bd] bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-semibold text-[#77585a]">
              {metric.label}
            </p>
            <p className="mt-2 text-3xl font-black text-[#b8171d]">
              {metric.value}
            </p>
            <p className="mt-2 text-xs text-[#8d7475]">{metric.help}</p>
          </div>
        ))}
      </div>
      <div className="mt-7 overflow-hidden rounded-2xl border border-[#ead8bd] bg-white shadow-sm">
        <div className="border-b border-[#eee1cf] bg-[#fffaf1] p-5">
          <h3 className="font-black">Pedidos de hoy</h3>
        </div>
        {orders.length === 0 ? (
          <p className="p-5 text-sm text-[#816568]">
            Todavía no hay pedidos hoy.
          </p>
        ) : (
          <div className="divide-y divide-[#eee1cf]">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-bold">{order.customer_name}</p>
                  <p className="text-sm text-[#816568]">
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
      className="rounded-lg border border-[#ddb76e] bg-[#fff2ca] px-2 py-1.5 text-sm font-semibold text-[#75151b] outline-none focus:border-[#b8171d]"
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

  return (
    <>
      <div className="mb-6">
        <p className="text-sm font-bold uppercase tracking-widest text-[#b8171d]">
          Pedidos guardados
        </p>
        <h2 className="text-3xl font-black">Historial de pedidos</h2>
      </div>

      <div className="rounded-2xl border border-[#ead8bd] bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.4fr]">
          <label className="text-sm font-bold">
            Desde
            <input
              type="date"
              required
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#dec9a8] bg-[#fffaf1] px-3 py-2.5 outline-none focus:border-[#b8171d]"
            />
          </label>
          <label className="text-sm font-bold">
            Hasta
            <input
              type="date"
              required
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#dec9a8] bg-[#fffaf1] px-3 py-2.5 outline-none focus:border-[#b8171d]"
            />
          </label>
          <label className="text-sm font-bold">
            Estado
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-1 w-full rounded-xl border border-[#dec9a8] bg-[#fffaf1] px-3 py-2.5 outline-none focus:border-[#b8171d]"
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
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9b7779]"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cliente, producto o dirección"
                className="w-full rounded-xl border border-[#dec9a8] bg-[#fffaf1] py-2.5 pl-9 pr-3 outline-none focus:border-[#b8171d]"
              />
            </span>
          </label>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
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
            className="rounded-2xl border border-[#ead8bd] bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold text-[#77585a]">
              {metric.label}
            </p>
            <p className="mt-1 text-2xl font-black text-[#b8171d]">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-[#ead8bd] bg-white shadow-sm">
        <div className="border-b border-[#eee1cf] bg-[#fffaf1] p-4">
          <h3 className="font-black">Detalle del período</h3>
          <p className="mt-1 text-xs text-[#816568]">
            La facturación y ganancia solo incluyen pedidos confirmados o
            entregados.
          </p>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-[#816568]">Cargando pedidos…</p>
        ) : visibleOrders.length === 0 ? (
          <p className="p-5 text-sm text-[#816568]">
            No hay pedidos que coincidan con estos filtros.
          </p>
        ) : (
          <div className="divide-y divide-[#eee1cf]">
            {visibleOrders.map((order) => (
              <details key={order.id} className="group p-4 open:bg-[#fffaf1]">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                  <div className="min-w-[180px] flex-1">
                    <p className="font-bold">{order.customer_name}</p>
                    <p className="text-sm text-[#816568]">
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
                    <span className="text-xs font-bold text-[#8a686b] group-open:hidden">
                      Ver detalle
                    </span>
                    <span className="hidden text-xs font-bold text-[#8a686b] group-open:inline">
                      Ocultar
                    </span>
                  </div>
                </summary>
                <div className="mt-4 grid gap-4 border-t border-[#ead8bd] pt-4 lg:grid-cols-[1.4fr_1fr]">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-[#b8171d]">
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
                  <div className="space-y-2 text-sm text-[#69474a]">
                    <p>
                      <strong className="text-[#4f171c]">Pago:</strong>{" "}
                      {order.payment_method === "transfer"
                        ? "Transferencia"
                        : "Efectivo"}
                    </p>
                    {order.delivery_address && (
                      <p>
                        <strong className="text-[#4f171c]">Dirección:</strong>{" "}
                        {order.delivery_address}
                      </p>
                    )}
                    {order.notes && (
                      <p>
                        <strong className="text-[#4f171c]">Notas:</strong>{" "}
                        {order.notes}
                      </p>
                    )}
                    <p className="break-all text-xs text-[#9a7e80]">
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
}: any) {
  const selectedCategory = categories.find(
    (category: Category) => category.id === editing?.category_id,
  );
  const isBurger = selectedCategory?.name
    .toLocaleLowerCase("es")
    .includes("hamburgues");
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
          <p className="text-sm font-bold uppercase tracking-widest text-[#b8171d]">
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
          className="rounded-xl bg-[#b8171d] px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-[#991018]"
        >
          Nuevo producto
        </button>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <div className="rounded-2xl border border-[#ead8bd] bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-black">
            <Tags size={18} /> Categorías
          </h3>
          <form onSubmit={addCategory} className="mt-4 flex gap-2">
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Nueva categoría"
              className="min-w-0 flex-1 rounded-xl border border-[#dec9a8] bg-[#fffaf1] px-3 py-2 text-[#4f171c] outline-none focus:border-[#b8171d]"
            />
            <button className="rounded-xl bg-[#b8171d] px-3 font-black text-white hover:bg-[#991018]">
              Agregar
            </button>
          </form>
          <div className="mt-4 space-y-2">
            {categories.map((category: Category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-xl border border-[#f0e3d1] bg-[#fffaf1] px-3 py-2"
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
                  className="text-[#a56b70] hover:text-[#b8171d]"
                  aria-label={`Eliminar ${category.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#ead8bd] bg-white shadow-sm">
          <div className="border-b border-[#eee1cf] bg-[#fffaf1] p-5">
            <h3 className="font-black">Productos</h3>
          </div>
          {products.map((product: Product) => (
            <div
              key={product.id}
              className="flex items-center justify-between gap-3 border-b border-[#eee1cf] p-4 last:border-0 hover:bg-[#fffaf1]"
            >
              <div>
                <p className="font-bold">{product.name}</p>
                <p className="text-sm text-[#816568]">
                  {formatMoney(product.sale_price)} ·{" "}
                  {product.available ? "Disponible" : "No disponible"}
                </p>
              </div>
              <button
                onClick={() => setEditing(product)}
                className="rounded-lg p-2 text-[#b8171d] hover:bg-[#fde8d0]"
                aria-label={`Editar ${product.name}`}
              >
                <Pencil size={17} />
              </button>
            </div>
          ))}
        </div>
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/65 p-4">
          <form
            onSubmit={onSave}
            className="mx-auto my-5 max-w-xl rounded-2xl bg-[#fff7e8] p-6 text-[#4f171c] shadow-2xl"
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
                label="Costo"
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
                  className="mt-1 w-full rounded-xl border border-[#dec9a8] bg-white px-3 py-2.5 text-[#4f171c] outline-none focus:border-[#b8171d]"
                >
                  {categories.map((category: Category) => (
                    <option value={category.id} key={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              {isBurger && (
                <AdminField
                  label="Precio por medallón extra"
                  type="number"
                  value={editing.customization?.extra_patty_price ?? 2000}
                  onChange={(value: string) =>
                    setEditing({
                      ...editing,
                      customization: {
                        ...(editing.customization ?? {}),
                        extra_patty_price: Number(value),
                      },
                    })
                  }
                />
              )}
            </div>
            {isBurger && (
              <p className="mt-2 text-xs text-[#816568]">
                La Doble suma un medallón extra y la Triple suma dos sobre el
                precio de venta.
              </p>
            )}
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
            <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b8171d] py-3 font-black text-white hover:bg-[#991018]">
              <Save size={17} /> Guardar producto
            </button>
          </form>
        </div>
      )}
    </>
  );
}
function SettingsForm({ settings, setSettings, onSave }: any) {
  if (!settings)
    return <p className="text-[#816568]">Cargando configuración…</p>;
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
      className="max-w-2xl rounded-2xl border border-[#ead8bd] bg-white p-6 shadow-sm"
    >
      <p className="text-sm font-bold uppercase tracking-widest text-[#b8171d]">
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
      <p className="mt-3 text-xs text-[#816568]">
        El radio se calcula en línea recta desde las coordenadas del local.
      </p>
      <button className="mt-5 flex items-center gap-2 rounded-xl bg-[#b8171d] px-5 py-3 font-black text-white hover:bg-[#991018]">
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
      "mt-1 w-full rounded-xl border border-[#dec9a8] bg-[#fffaf1] px-3 py-2.5 text-[#4f171c] outline-none focus:border-[#b8171d]",
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
          <span className="mt-2 block text-xs font-normal text-[#816568]">
            o subí una foto real del producto:
          </span>
          <input
            onChange={uploadPhoto}
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-xs font-normal text-[#816568] file:mr-3 file:rounded-lg file:border-0 file:bg-[#b8171d] file:px-3 file:py-2 file:font-bold file:text-white"
          />
        </>
      )}
    </label>
  );
}
