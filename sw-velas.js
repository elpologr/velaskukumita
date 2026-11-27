// PROYECTO: Velas Kukúmita · Ruta: sw-velas.js (en la RAÍZ del repo de Velas, junto a index.html)
// Service worker de la app instalable de Velas. Reglas de SEGURIDAD (importan porque aquí inicia sesión el administrador):
//  1. SOLO atiende peticiones GET del propio sitio (+ el SDK de Firebase de www.gstatic.com, que es público y versionado).
//     Nunca toca POST: las acciones de administrador (Apps Script) ni pasan por aquí ni se guardan.
//  2. NUNCA intercepta ni guarda: script.google.com (Apps Script), identitytoolkit / securetoken (tokens), /__/auth/ (inicio de sesión),
//     docs.google.com (la hoja de productos: debe ser siempre la versión real), ni imágenes de imgbb.
//  3. Solo guarda respuestas correctas (200) del mismo sitio. Ningún token ni dato de sesión se guarda aquí:
//     Firebase guarda la sesión por su cuenta (IndexedDB), este archivo no la ve.
//  4. «Primero red, luego copia»: el administrador siempre recibe el código más nuevo; la copia solo se usa sin internet o si la red tarda más de 3 s.
// CUÁNDO SUBIR VERSION: solo si agregas o quitas archivos de la lista de abajo (los que ya están se actualizan solos con la red).
const VERSION = 3;
const CACHE = "velas-kukumita-v" + VERSION;
const ESPERA_RED = 3000;

const ARCHIVOS = [
  "./", "index.html", "style.css", "mesas.css",
  "app.js", "admin-producto-ui.js", "lista-precios-admin.js", "galeria-lista-precios.js", "descripciones-fijas.js",
  "sin-precio.js", "festividades.js", "destacados-fechas.js", "editar-recorte-principal.js", "zonas-imagen.js", "portada.js", "cuadricula.js", "mesas.js", "pwa-velas.js",
  "manifest-velas.webmanifest",
  "imagenes/icono-180-velas.png", "imagenes/icono-192-velas.png", "imagenes/icono-512-velas.png", "imagenes/icono-maskable-512-velas.png",
  "imagenes/velalogo.webp",
];

const PROHIBIDO = ["/__/auth/", "identitytoolkit", "securetoken", "googleapis.com/identitytoolkit"];

self.addEventListener("install", (ev) => {
  ev.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let fallos = 0;
    // De 6 en 6 para no saturar el celular ni GitHub Pages
    for (let i = 0; i < ARCHIVOS.length; i += 6) {
      await Promise.all(ARCHIVOS.slice(i, i + 6).map(async (u) => {
        try {
          const r = await fetch(new Request(u, { cache: "reload" }));
          if (r.ok) await cache.put(u, r); else console.warn("sw-velas.js: no se pudo guardar", u, r.status);
        } catch (e) { fallos++; }
      }));
    }
    // Si falló la red, se cancela: el service worker anterior (si lo hay) sigue activo y se reintenta después
    if (fallos > 0) throw new Error("sw-velas.js: la red falló en " + fallos + " archivos; se reintentará más tarde");
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("velas-kukumita-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function redLuegoCopia(req) {
  const cache = await caches.open(CACHE);
  const red = fetch(req).then((r) => {
    // Solo se guarda lo correcto y del mismo sitio (nunca redirecciones, errores ni respuestas opacas)
    if (r && r.ok && r.type === "basic") cache.put(req, r.clone()).catch(() => {});
    return r;
  });
  red.catch(() => {});
  try {
    const r = await Promise.race([red, new Promise((_, no) => setTimeout(() => no(new Error("lento")), ESPERA_RED))]);
    if (r && r.status >= 500) {
      const copia = await cache.match(req, { ignoreSearch: true });
      if (copia) return copia;
    }
    return r;
  } catch (e) {
    // ignoreSearch: la app se abre con «?app=1» y los archivos llevan «?v=»
    const copia = await cache.match(req, { ignoreSearch: true });
    if (copia) return copia;
    return red;
  }
}

async function copiaLuegoRed(req) {
  const cache = await caches.open(CACHE);
  const copia = await cache.match(req);
  if (copia) return copia;
  const r = await fetch(req);
  if (r && r.ok) cache.put(req, r.clone()).catch(() => {});
  return r;
}

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;                                   // regla 1: nunca POST
  const url = new URL(req.url);
  if (PROHIBIDO.some((p) => url.href.indexOf(p) !== -1)) return;       // regla 2: lo deja pasar directo a la red
  if (url.origin === self.location.origin) {
    ev.respondWith(redLuegoCopia(req));
  } else if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) {
    ev.respondWith(copiaLuegoRed(req));                               // SDK público y versionado (10.12.0)
  }
  // Todo lo demás (Apps Script, hoja de cálculo, imgbb, fuentes, WhatsApp…) no se toca
});
