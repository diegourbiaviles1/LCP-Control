# LCP Control · Foundation

Aplicación responsiva para una perfumería. **Iteración 1, solo lectura del catálogo de demostración.** Auth está integrado con Supabase; las tablas de negocio, escrituras, ventas y movimientos transaccionales aún no están implementados. No usar como inventario operativo todavía.

## Requisitos y ejecución

Node **22.12+** (validado con 24.19) y npm. Chrome instalado para la suite de navegador.

```sh
npm ci
npm run dev
```

Abrir [localhost:5173](http://localhost:5173). `/login` ofrece acceso privado y un enlace explícito a `/demo`. La demostración pública solo contiene productos genéricos y nunca crea una sesión de usuario. Las rutas `/`, `/inventory`, `/scanner`, `/sales`, `/products` y `/alerts` requieren autenticación y un rol válido.

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

| Variable                        | Uso                                                         |
| ------------------------------- | ----------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | URL HTTPS del proyecto                                      |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública `sb_publishable_…`; nunca secret/service_role |
| `VITE_DATA_MODE`                | `demo`: único adapter de datos implementado                 |

Sin configuración se puede explorar `/demo`; el login explica la configuración pendiente. Incluso con Auth conectado, el catálogo sigue marcado como demostración. Otro modo falla explícitamente y no consulta tablas inexistentes.

Crear usuarios desde Supabase administrativamente, desactivar altas públicas en la configuración de Auth y asignar `app_metadata.role` a `admin` u `operator` mediante un entorno administrativo confiable. No hay signup en la UI. Nunca asignar roles mediante `user_metadata`. El contrato de perfiles está encapsulado en `services/auth.ts`, preparado para sustituirse por perfiles reales.

El SDK conserva y renueva sesiones, notifica cambios y elimina la sesión local al salir. Los roles de la sesión pueden estar desactualizados hasta renovar el token: las futuras operaciones deberán comprobar permisos en PostgreSQL. **Las capacidades del frontend no sustituyen RLS.** No se crearon tablas ni políticas provisionales; tampoco endpoints de escritura. Los costos quedan en una proyección administrativa separada y no se entregan al inventario de consulta.

## Comprobaciones

```sh
npm run build
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run format
```

`build` ejecuta TypeScript y genera `dist/`. `preview` sirve esa compilación. Playwright inicia Vite y usa Chrome local (configurable en `playwright.config.ts`) con viewports 1440×1000 y 390×844. Las capturas y trazas se guardan en `test-results/`, ignorado por Git.

Las pruebas cubren permisos, cantidades, monedas, búsqueda por código, filtros, alertas, protección y restauración de sesión, logout, errores de login, callbacks duplicados, cancelación de búsquedas, arranque y liberación de cámara. Los flujos de navegador cubren rutas, responsive, filtros, scanner manual, diálogo y permiso rechazado.

La suite de navegador usa además un dispositivo de video simulado por Chrome y comprueba que todos sus tracks terminan al detener el lector y al navegar, sin errores de reproducción. Resultado de Foundation: 36 pruebas unitarias y 10 pruebas de navegador aprobadas; build, TypeScript y lint aprobados.

En el entorno de construcción de Codex solo había Node. Se descargó npm en `.tools/package/` (ignorado) y los comandos se ejecutaron mediante `node .tools/package/bin/npm-cli.js …`; no es necesario en una instalación normal con npm. Dependencias exactas y `package-lock.json` reproducibles.

## Escáner

`ScannerAdapter` aísla `html5-qrcode`, que se carga al iniciar la cámara. Se prefiere la cámara trasera; el navegador requiere permiso y contexto seguro: **HTTPS o localhost**. Abrir una IP de la red local por HTTP desde un teléfono no habilita la cámara. Para probar en un teléfono, servir por HTTPS con certificado confiable.

La primera lectura bloquea callbacks duplicados, detiene la cámara y consulta `productService.findByBarcode`. Salir de la pantalla cancela resultados pendientes y libera la cámara, incluso si todavía se estaba iniciando. Código vacío/inválido, permiso denegado, cámara ausente, dispositivo ocupado y producto desconocido tienen mensajes y reintento. También hay búsqueda manual: `LCP-0001` identifica Producto A. Los códigos se comparan exactamente, conservando ceros iniciales y mayúsculas; solo se recortan espacios externos.

El resultado muestra existencias en Bodega y Tienda. Las acciones autorizadas abren una explicación del próximo flujo; no modifican cantidades. Un administrador puede preparar un alta con el código precargado; el guardado aún no existe.

Pendiente validación de aceptación en cámara física Android/iOS y prueba contra un proyecto Supabase con cuentas reales: las pruebas automatizadas usan dobles controlados y no demuestran compatibilidad con todos los dispositivos ni la configuración de un proyecto externo.

## Arquitectura

```text
src/app                 routing, shell, estilos y límite de errores
src/components          controles accesibles, diálogo y estados
src/features/auth       sesión, login y guard de rutas
src/features/inventory  filtros, cantidades por ubicación y presentación
src/features/scanner    adapter de cámara, ciclo de vida y resultado
src/features/*          dashboard, alertas, catálogo y ventas pendientes
src/services            contratos y casos de consulta por dominio
src/services/adapters   datos genéricos de demostración, solo lectura
src/lib                 tipos, validación Zod, permisos y formatos
```

UI → servicios → adapter. Ninguna página importa fixtures ni consulta Supabase directamente. No hay Redux. El estado permanece local, salvo Auth y contexto de acceso. Los datos no son editables y se clonan antes de entregarlos. Un producto tiene cantidades simultáneas en `warehouse` y `store`; las alertas comparan el total con su mínimo. El filtro por ubicación muestra también cantidades cero para poder consultar faltantes.

NIO y USD se formatean con `Intl.NumberFormat` y no se suman entre monedas. Los futuros importes persistidos de dominio usan representaciones decimales y PostgreSQL deberá usar `numeric`, nunca float. Fechas centralizadas en `America/Managua`.

## Decisiones pendientes y próximo incremento

El contexto observado en el Instagram y catálogo público, junto con las preguntas que deben confirmarse antes del esquema, está registrado en [`docs/discovery/business-context.md`](docs/discovery/business-context.md).

Operador: entradas y ajustes denegados conservadoramente; creación de productos solo administrativa. Confirmar estas políticas antes de habilitar escrituras. Pendientes política NIO/USD y posibles pagos en dos monedas; no se inventaron tipos de cambio, impuestos ni descuentos.

Siguiente incremento: perfiles y autorización real, productos y lectura de inventario por ubicación con RLS y pruebas de acceso admin/operator. Luego movimientos atómicos y auditables, sin stock negativo, con costo promedio protegido en base de datos. Las ventas completas vendrán después. Dominios de clientes y proveedores permanecen separados, sin CRM ni UI adicional.

Para desplegar el build, usar hosting HTTPS con fallback de las rutas SPA a `index.html`. Ningún despliegue ni modificación remota se realizó en esta iteración.

Referencias verificadas: [Supabase Auth](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [Vite](https://vite.dev/guide/), [Tailwind Vite](https://tailwindcss.com/docs/installation/using-vite), [Html5Qrcode](https://scanapp.org/html5-qrcode-docs/docs/apis/classes/Html5Qrcode).
