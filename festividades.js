// ══════════════════════════════════════════════════════════════════════════════
// PROYECTO: Velas Kukúmita · Ruta: festividades.js (raíz del repo de Velas) · Se carga DESPUÉS de app.js
// Zona «🎉 Fechas especiales»: botones cuadrados grandes (40 % más grandes que los de Biografía/Catálogo: 135 px → 189 px) que van
// justo debajo de los botones «Búscanos en Tienda / Bazar / Ver nuestras Mesas» y arriba de la barra Biografía/Catálogo.
//   · Al tocar un botón se abre el catálogo y se aplica ese filtro con las mismas funciones que ya usa «Filtros de productos»
//     (filtrarPorFestividadCarrusel / filtrarPorEventoCarrusel). No se inventa ningún filtro nuevo.
//   · Los botones disponibles son los filtros que ya existen en «Filtrar por Evento» y «Filtrar por Festividad».
//   · Solo los administradores (ADMIN_EMAILS) ven el ⚙️ para elegir cuáles botones salen y en qué orden (el 1.º es el primero).
//     Se guarda en la pestaña «Festividades» de la hoja (la crea sola el Apps Script con la acción «festividades»).
//     La seguridad real está en el Apps Script, que vuelve a verificar el token de Firebase y el correo; aquí solo se evita mostrar el ⚙️.
//   · Si todavía no hay nada guardado, sale solo «Navidad».
//   · Los botones van en UNA sola fila que se desliza hacia los lados (con el dedo o con las flechas ‹ ›): en computadora se ven 5 a la vez.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    var HOJA = 'Festividades';
    var CACHE_KEY = 'velas_festividades_v1';
    var MAX = 12;
    var DEFECTO = ['festividad:navidad'];
    var cfg = null;          // ['festividad:navidad', 'evento:boda', …] en el orden que se muestran
    var zona = null, fila = null, estadoEl = null, gear = null;
    var modal = null, sel = [], guardando = false;

    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
    function aviso(m) { if (typeof mostrarToast === 'function') mostrarToast(m); }
    function esAdmin() {
        var u = (typeof auth !== 'undefined') ? auth.currentUser : null;
        return (typeof _esAdminUI === 'function') && _esAdminUI(u);
    }
    function limpiar(arr) {
        var vistos = {}, out = [];
        (arr || []).forEach(function (f) {
            f = String(f || '').trim();
            if (/^(festividad|evento):[a-z0-9-]{1,60}$/.test(f) && !vistos[f] && out.length < MAX) { vistos[f] = 1; out.push(f); }
        });
        return out;
    }

    // ── Filtros que ya existen en la página (se leen de sus botones, así nunca se desfasan) ──
    function opciones() {
        var out = [], vistos = {};
        function recoger(selector, attr, tipo) {
            document.querySelectorAll(selector).forEach(function (b) {
                var slug = (b.getAttribute(attr) || '').trim();
                if (!slug || slug === 'todos' || !/^[a-z0-9-]+$/.test(slug)) return;
                var clave = tipo + ':' + slug;
                if (vistos[clave]) return; vistos[clave] = 1;
                var txt = (b.textContent || '').replace(/\s+/g, ' ').trim();
                var m = txt.match(/^(\S+)\s+(.+)$/), emoji = '🎉', nombre = txt;
                if (m && !/[\p{L}\p{N}]/u.test(m[1])) { emoji = m[1]; nombre = m[2]; }
                out.push({ filtro: clave, tipo: tipo, slug: slug, emoji: emoji, nombre: nombre, btn: b });
            });
        }
        recoger('.btn-festividad-carrusel', 'data-festividad', 'festividad');
        recoger('.btn-evento-carrusel:not(.btn-forma-carrusel):not(.btn-festividad-carrusel)', 'data-evento', 'evento');
        return out;
    }
    function porFiltro() { var m = {}; opciones().forEach(function (o) { m[o.filtro] = o; }); return m; }

    // ── Estilos (todo acotado a #zonaFestividades y #modalFestividades) ──
    function estilos() {
        if (document.getElementById('estilosFestividades')) return;
        var s = document.createElement('style'); s.id = 'estilosFestividades';
        s.textContent = [
            '#zonaFestividades{max-width:1200px;margin:0 auto;padding:22px 12px 0;text-align:center;box-sizing:border-box}',
            '#zonaFestividades .fest-cab{position:relative;display:flex;align-items:center;justify-content:center;min-height:44px}',
            '#zonaFestividades .fest-titulo{margin:0;font-family:"Playfair Display",Georgia,serif;font-size:1.9rem;font-weight:900;color:#3F2C25;letter-spacing:1px}',
            '#zonaFestividades .fest-gear{position:absolute;right:2px;top:50%;transform:translateY(-50%);width:42px;height:42px;border:1.5px solid #d4c5b8;border-radius:50%;background:#fff;font-size:20px;line-height:1;cursor:pointer}',
            '#zonaFestividades .fest-gear:hover{background:#e8ddd5}',
            '#zonaFestividades .fest-sub{margin:6px 0 14px;font-size:.85rem;color:#5c4d43}',
            '#zonaFestividades .fest-carrusel{position:relative;max-width:993px;width:100%;margin:0 auto}',   /* 5 botones de 189 px + 4 espacios de 12 px */
            '#zonaFestividades .fest-fila{display:flex;flex-wrap:nowrap!important;gap:12px;overflow-x:auto!important;width:100%;box-sizing:border-box;scroll-snap-type:x proximity;scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;padding:4px 2px 8px;scroll-behavior:smooth}',
            '#zonaFestividades .fest-fila::-webkit-scrollbar{display:none}',
            '#zonaFestividades .fest-fila>:first-child{margin-left:auto}#zonaFestividades .fest-fila>:last-child{margin-right:auto}',   /* centra si caben todos; si no caben, no corta el primero */
            '#zonaFestividades .fest-btn{flex:0 0 auto;scroll-snap-align:start;width:min(189px,calc((100% - 12px) / 2));aspect-ratio:1/1;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;',
            '  background:#f0eae4;border:2px solid #d4c5b8;color:#5c4d43;border-radius:34px;cursor:pointer;font-family:inherit;font-weight:700;line-height:1.15;padding:14px 10px;box-sizing:border-box;overflow:hidden;transition:background .22s,border-color .22s,color .22s}',
            '#zonaFestividades .fest-btn:hover{background:#e8ddd5;border-color:#b8a898}',
            '#zonaFestividades .fest-btn:active{background:#8c7565;border-color:#8c7565;color:#fff}',
            '#zonaFestividades .fest-btn:focus-visible,#zonaFestividades .fest-gear:focus-visible,#zonaFestividades .fest-flecha:focus-visible{outline:3px solid #8c7565;outline-offset:3px}',
            '#zonaFestividades .fest-flecha{position:absolute;top:50%;transform:translateY(-50%);z-index:2;width:46px;height:46px;border:none;border-radius:50%;background:rgba(63,44,37,.92);color:#fff;font-size:30px;line-height:1;padding:0 0 4px;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.35)}',
            '#zonaFestividades .fest-flecha:active{background:#8c7565}',
            '#zonaFestividades .fest-izq{left:4px}#zonaFestividades .fest-der{right:4px}',
            '#zonaFestividades .fest-emoji{font-size:3.15rem;line-height:1}',
            '#zonaFestividades .fest-label{font-size:1.4rem;word-break:break-word}',
            '#zonaFestividades .fest-vacio{padding:18px 12px;color:#8c7565;font-size:.95rem}',
            '#zonaFestividades .fest-estado{display:none;margin:14px auto 0;max-width:520px;padding:10px 14px;border-radius:14px;background:#f0eae4;border:1.5px solid #d4c5b8;color:#5c4d43;font-size:.95rem;font-weight:700}',
            '#zonaFestividades .fest-estado button{margin-left:10px;padding:6px 12px;border:none;border-radius:10px;background:#8c7565;color:#fff;font-weight:700;cursor:pointer}',
            '#zonaFestividades .fest-linea{width:100%;height:3px;background:linear-gradient(90deg,transparent,#3F2C25,transparent);margin:22px 0 0}',
            'body.modo-oscuro #zonaFestividades .fest-titulo{color:#eee}body.modo-oscuro #zonaFestividades .fest-sub{color:#ccc}',
            'body.modo-oscuro #zonaFestividades .fest-btn{background:#2a2a2a;border-color:#444;color:#ccc}',
            '#modalFestividades{display:none;position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.55);align-items:center;justify-content:center;padding:14px;box-sizing:border-box}',
            '#modalFestividades.abierto{display:flex}',
            '#modalFestividades .mf-caja{background:#fff;color:#3b2f27;width:100%;max-width:460px;max-height:88vh;overflow-y:auto;border-radius:18px;padding:18px 16px 14px;box-sizing:border-box;font-family:system-ui,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.4)}',
            '#modalFestividades h3{margin:0 0 4px;font-size:1.15rem}',
            '#modalFestividades .mf-nota{margin:0 0 12px;font-size:.85rem;color:#6b5a4f;line-height:1.4}',
            '#modalFestividades h4{margin:14px 0 6px;font-size:.95rem;color:#5c4d43}',
            '#modalFestividades .mf-item{display:flex;align-items:center;gap:6px;padding:7px 8px;border:1.5px solid #e8ddd5;border-radius:12px;margin-bottom:6px;font-size:.95rem;background:#faf7f4}',
            '#modalFestividades .mf-item .mf-n{flex:1;min-width:0}',
            '#modalFestividades .mf-item button{width:36px;height:36px;border:1px solid #d4c5b8;border-radius:10px;background:#fff;cursor:pointer;font-size:16px;line-height:1}',
            '#modalFestividades .mf-item button:disabled{opacity:.35;cursor:not-allowed}',
            '#modalFestividades .mf-pos{font-weight:800;color:#8c7565;min-width:22px;text-align:center}',
            '#modalFestividades .mf-acc{display:flex;gap:8px;margin-top:14px}',
            '#modalFestividades .mf-acc button{flex:1;padding:12px;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer}',
            '#modalFestividades .mf-guardar{background:#8c7565;color:#fff}#modalFestividades .mf-cancelar{background:#e8ddd5;color:#3b2f27}',
            '#modalFestividades .mf-acc button:disabled{opacity:.5;cursor:not-allowed}',
            '#modalFestividades .mf-msg{min-height:18px;margin-top:8px;font-size:.85rem;color:#6b5a4f}#modalFestividades .mf-msg.error{color:#c0392b}'
        ].join('\n');
        document.head.appendChild(s);
    }

    // ── Aplicar un filtro (mismo camino que «Filtros de productos») ──
    function aplicar(o) {
        if (typeof window.activarPill === 'function') window.activarPill('productos');   // cierra los carruseles de Ofertas / Más Vendidos si estaban abiertos
        if (o.tipo === 'festividad' && typeof window.filtrarPorFestividadCarrusel === 'function') window.filtrarPorFestividadCarrusel(o.btn, o.slug);
        else if (typeof window.filtrarPorEventoCarrusel === 'function') window.filtrarPorEventoCarrusel(o.btn, o.slug);
        if (typeof window.scrollToGrid === 'function') window.scrollToGrid();
        if (estadoEl) {
            estadoEl.textContent = 'Mostrando: ' + o.emoji + ' ' + o.nombre;
            var b = el('button', '', 'Ver todos los productos'); b.type = 'button';
            b.addEventListener('click', quitarFiltro);
            estadoEl.appendChild(b);
            estadoEl.style.display = 'block';
        }
    }
    function quitarFiltro() {
        var todos = document.querySelector('.btn-evento-carrusel[data-evento="todos"]');
        if (todos && typeof window.filtrarPorEventoCarrusel === 'function') window.filtrarPorEventoCarrusel(todos, 'todos');
        if (estadoEl) estadoEl.style.display = 'none';
        if (typeof window.scrollToGrid === 'function') window.scrollToGrid();
    }

    // ── Dibujar la zona ──
    function pintar() {
        estilos();
        var admin = esAdmin();
        var m = porFiltro();
        var lista = (cfg || []).map(function (f) { return m[f]; }).filter(Boolean);
        // La zona va justo después de los botones de Tienda / Bazar / Mesas: antes del primer panel o del catálogo que exista
        var barra = document.getElementById('panelPillOfertas') || document.getElementById('zona-catalogo');
        if (!barra || !barra.parentNode) return;
        if (!lista.length && !admin) { if (zona) zona.style.display = 'none'; return; }

        if (!zona) {
            zona = el('section'); zona.id = 'zonaFestividades'; zona.setAttribute('aria-label', 'Fechas especiales');
            barra.parentNode.insertBefore(zona, barra);
        }
        zona.style.display = '';
        zona.textContent = '';
        var cab = el('div', 'fest-cab');
        cab.appendChild(el('h2', 'fest-titulo', '🎉 Fechas especiales'));
        if (admin) {
            gear = el('button', 'fest-gear', '⚙️'); gear.type = 'button';
            gear.title = 'Elegir los botones de esta zona (solo administradores)'; gear.setAttribute('aria-label', 'Configurar fechas especiales');
            gear.addEventListener('click', abrirPanel);
            cab.appendChild(gear);
        }
        zona.appendChild(cab);
        zona.appendChild(el('p', 'fest-sub', lista.length ? 'Toca una fecha para ver sus productos' : ''));
        var car = el('div', 'fest-carrusel');
        fila = el('div', 'fest-fila');
        if (!lista.length) fila.appendChild(el('div', 'fest-vacio', 'Todavía no hay botones. Toca ⚙️ para elegir cuáles se muestran.'));
        lista.forEach(function (o) {
            var b = el('button', 'fest-btn'); b.type = 'button';
            b.appendChild(el('span', 'fest-emoji', o.emoji));
            b.appendChild(el('span', 'fest-label', o.nombre));
            b.addEventListener('click', function () { aplicar(o); });
            fila.appendChild(b);
        });
        var izq = el('button', 'fest-flecha fest-izq', '‹'); izq.type = 'button'; izq.setAttribute('aria-label', 'Ver las fechas anteriores');
        var der = el('button', 'fest-flecha fest-der', '›'); der.type = 'button'; der.setAttribute('aria-label', 'Ver más fechas');
        izq.style.display = 'none'; der.style.display = 'none';
        // Se desplaza de botón en botón: tantos como caben completos en pantalla (5 en computadora)
        function paso() {
            var b0 = fila.querySelector('.fest-btn');
            if (!b0) return fila.clientWidth;
            var uno = b0.offsetWidth + 12;
            return Math.max(1, Math.floor((fila.clientWidth + 12) / uno)) * uno;
        }
        function flechas() {
            var max = fila.scrollWidth - fila.clientWidth, x = fila.scrollLeft;
            var desborda = max > 6;
            izq.style.display = (desborda && x > 6) ? '' : 'none';
            der.style.display = (desborda && x < max - 6) ? '' : 'none';
        }
        izq.addEventListener('click', function () { fila.scrollBy({ left: -paso(), behavior: 'smooth' }); });
        der.addEventListener('click', function () { fila.scrollBy({ left: paso(), behavior: 'smooth' }); });
        fila.addEventListener('scroll', flechas, { passive: true });
        if (!pintar.resizeOk) { pintar.resizeOk = true; window.addEventListener('resize', function () { if (fila) flechas(); }); }
        car.appendChild(fila); car.appendChild(izq); car.appendChild(der);
        zona.appendChild(car);
        flechas();
        if (window.requestAnimationFrame) requestAnimationFrame(flechas);
        setTimeout(flechas, 400);   // por si las fuentes cargan después y cambian el ancho
        estadoEl = el('div', 'fest-estado'); estadoEl.setAttribute('role', 'status');
        zona.appendChild(estadoEl);
        zona.appendChild(el('div', 'fest-linea'));
    }

    // ── Panel del administrador ──
    function msg(t, esError) { var e = document.getElementById('mfMsg'); if (e) { e.textContent = t || ''; e.className = 'mf-msg' + (esError ? ' error' : ''); } }
    function pintarPanel() {
        var caja = modal.querySelector('.mf-caja'); caja.textContent = '';
        var m = porFiltro(), todas = opciones();
        caja.appendChild(el('h3', '', '🎉 Botones de «Fechas especiales»'));
        caja.appendChild(el('p', 'mf-nota', 'Elige cuáles botones se muestran y en qué orden. El de arriba es el primero que ve la gente. Al tocar un botón, el catálogo se filtra con ese evento o festividad.'));

        caja.appendChild(el('h4', '', 'En la zona (' + sel.length + '/' + MAX + ')'));
        if (!sel.length) caja.appendChild(el('p', 'mf-nota', 'Ninguno: la zona quedará oculta para el público.'));
        sel.forEach(function (f, i) {
            var o = m[f];
            var it = el('div', 'mf-item');
            it.appendChild(el('span', 'mf-pos', String(i + 1)));
            it.appendChild(el('span', 'mf-n', o ? (o.emoji + ' ' + o.nombre) : (f + ' (ya no existe)')));
            var sube = el('button', '', '▲'); sube.type = 'button'; sube.disabled = i === 0; sube.setAttribute('aria-label', 'Subir');
            var baja = el('button', '', '▼'); baja.type = 'button'; baja.disabled = i === sel.length - 1; baja.setAttribute('aria-label', 'Bajar');
            var quita = el('button', '', '✕'); quita.type = 'button'; quita.setAttribute('aria-label', 'Quitar');
            sube.addEventListener('click', function () { var t = sel[i - 1]; sel[i - 1] = sel[i]; sel[i] = t; pintarPanel(); });
            baja.addEventListener('click', function () { var t = sel[i + 1]; sel[i + 1] = sel[i]; sel[i] = t; pintarPanel(); });
            quita.addEventListener('click', function () { sel.splice(i, 1); pintarPanel(); });
            it.appendChild(sube); it.appendChild(baja); it.appendChild(quita);
            caja.appendChild(it);
        });

        var libres = todas.filter(function (o) { return sel.indexOf(o.filtro) === -1; });
        caja.appendChild(el('h4', '', 'Disponibles'));
        if (!libres.length) caja.appendChild(el('p', 'mf-nota', 'Ya están todos en la zona.'));
        libres.forEach(function (o) {
            var it = el('div', 'mf-item');
            it.appendChild(el('span', 'mf-n', o.emoji + ' ' + o.nombre));
            var mas = el('button', '', '➕'); mas.type = 'button'; mas.disabled = sel.length >= MAX; mas.setAttribute('aria-label', 'Agregar ' + o.nombre);
            mas.addEventListener('click', function () { if (sel.length < MAX) { sel.push(o.filtro); pintarPanel(); } });
            it.appendChild(mas); caja.appendChild(it);
        });

        var msgEl = el('div', 'mf-msg'); msgEl.id = 'mfMsg'; caja.appendChild(msgEl);
        var acc = el('div', 'mf-acc');
        var g = el('button', 'mf-guardar', '💾 Guardar'); g.type = 'button'; g.id = 'mfGuardar';
        var c = el('button', 'mf-cancelar', 'Cancelar'); c.type = 'button';
        g.addEventListener('click', guardar); c.addEventListener('click', cerrarPanel);
        acc.appendChild(g); acc.appendChild(c); caja.appendChild(acc);
    }
    function abrirPanel() {
        if (!esAdmin()) { aviso('Tu sesión no está autorizada.'); return; }
        estilos();
        if (!modal) {
            modal = el('div'); modal.id = 'modalFestividades'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
            modal.appendChild(el('div', 'mf-caja'));
            modal.addEventListener('click', function (e) { if (e.target === modal && !guardando) cerrarPanel(); });
            document.body.appendChild(modal);
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('abierto') && !guardando) cerrarPanel(); });
        }
        sel = limpiar(cfg || []);
        pintarPanel();
        modal.classList.add('abierto');
        document.body.style.overflow = 'hidden';
    }
    function cerrarPanel() { if (!modal) return; modal.classList.remove('abierto'); document.body.style.overflow = ''; }

    function guardar() {
        if (guardando) return;
        var user = (typeof auth !== 'undefined') ? auth.currentUser : null;
        if (!esAdmin() || !user) { msg('Tu sesión no está autorizada.', true); return; }
        var nuevo = limpiar(sel);
        guardando = true; document.getElementById('mfGuardar').disabled = true; msg('Guardando en la hoja…');
        user.getIdToken(true).then(function (tok) {
            return fetch(ADMIN_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // evita el preflight CORS que Apps Script no responde
                body: JSON.stringify({ idToken: tok, accion: 'festividades', filas: nuevo.map(function (f) { return { filtro: f }; }) })
            });
        }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d.ok) throw new Error(d.error || 'Error del servidor');
            cfg = nuevo;
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(nuevo)); } catch (e) { /* sin almacenamiento */ }
            cerrarPanel(); pintar(); aviso('✅ Fechas especiales guardadas');
        }).catch(function (e) {
            var t = String((e && e.message) || e);
            if (/Falta el nombre|Precio inv/i.test(t)) t = 'el Apps Script todavía no tiene la acción «festividades»: pega el codigo.gs nuevo y publícalo como versión nueva.';
            msg('No se pudo guardar: ' + t, true);
        }).then(function () { guardando = false; var g = document.getElementById('mfGuardar'); if (g) g.disabled = false; });
    }

    // ── Leer lo guardado (pestaña «Festividades», CSV público; si la pestaña no existe todavía, devuelve null) ──
    function normCab(s) { return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
    function leer() {
        var id = (typeof SHEET_ID !== 'undefined') ? SHEET_ID : '';
        var url = 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(HOJA) + '&_=' + Date.now();
        return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function (t) {
            var rows = parsearCSV(t), hd = -1, i;
            for (i = 0; i < Math.min(rows.length, 3); i++) {
                var c = rows[i].map(normCab);
                if (c.indexOf('orden') !== -1 && c.indexOf('filtro') !== -1) { hd = i; break; }   // si no existe la pestaña, Google devuelve otra hoja: se valida el encabezado
            }
            if (hd < 0) return null;
            var cb = rows[hd].map(normCab), iO = cb.indexOf('orden'), iF = cb.indexOf('filtro'), lista = [];
            for (i = hd + 1; i < rows.length; i++) lista.push({ n: parseInt(rows[i][iO], 10) || i, f: rows[i][iF] || '' });
            lista.sort(function (a, b) { return a.n - b.n; });
            return limpiar(lista.map(function (x) { return x.f; }));
        });
    }

    function iniciar() {
        var hayCache = false;
        try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (Array.isArray(c)) { cfg = limpiar(c); hayCache = true; } } catch (e) { /* nada */ }
        if (!hayCache) cfg = DEFECTO.slice();
        pintar();
        leer().then(function (l) {
            if (l) { cfg = l; try { localStorage.setItem(CACHE_KEY, JSON.stringify(l)); } catch (e) { /* sin almacenamiento */ } pintar(); }
        }).catch(function (e) { console.warn('[festividades] no se pudo leer la configuración:', e); });
        if (typeof auth !== 'undefined' && auth.onAuthStateChanged) auth.onAuthStateChanged(function () { pintar(); });   // al iniciar/cerrar sesión aparece o desaparece el ⚙️
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
