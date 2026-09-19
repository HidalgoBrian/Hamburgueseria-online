# Hamburguesería online

Web de pedidos para un único local: catálogo mobile-first, carrito, checkout y envío del pedido por WhatsApp. Los pedidos se guardan antes de abrir WhatsApp.

## Ejecutar localmente

1. Instalá dependencias con `npm install`.
2. Copiá `.env.example` como `.env.local` y cargá las credenciales públicas de Supabase.
3. En Supabase SQL Editor ejecutá [supabase/schema.sql](supabase/schema.sql).
4. Creá el usuario del dueño en **Authentication > Users** y agregá su UUID a `profiles`, como indica el final del esquema SQL.
5. Ejecutá `npm run dev` y visitá `/` para el menú o `/admin` para el panel.

Si el proyecto ya tenía el esquema instalado, ejecutá también [supabase/delivery-radius-migration.sql](supabase/delivery-radius-migration.sql) para activar la validación de delivery a 4 km desde París 1725, Isidro Casanova.

Para habilitar los precios y costos globales de medallones y adicionales, ejecutá una vez [supabase/global-addons-migration.sql](supabase/global-addons-migration.sql). Después se administran desde **Administración > Adicionales** y se aplican a todas las hamburguesas.

Sin variables de Supabase, el menú funciona en modo demostración local. No usar ese modo para producción: no hay login ni persistencia compartida.

## Datos a completar antes de publicar

- Nombre del local y número de WhatsApp (con código de país).
- Alias/CBU, banco y titular de transferencia.
- Dirección, horarios, zonas y costo de delivery.
- Email del dueño para el administrador inicial.
- Fotos reales de los productos, cargadas desde `/admin`.

## Despliegue

Importá el repositorio en Vercel y configurá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en sus variables de entorno. Para uso comercial, usar Vercel Pro.
