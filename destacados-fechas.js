// ══════════════════════════════════════════════════════════════════════════════
// VELAS KUKÚMITA — «Fechas especiales»: productos principales al inicio de cada zona
// Se carga DESPUÉS de app.js y festividades.js (usa auth, _esAdminUI, ADMIN_ENDPOINT, SHEET_ID, parsearCSV, mostrarToast y window.actualizarPaginacion).
//
//   Al entrar a una fecha especial (Navidad, Boda…) el catálogo se filtra y los productos salen en el orden de la hoja.
//   Aquí el administrador elige, para cada fecha, cuáles productos quiere ver PRIMERO y en qué orden (hasta 30 = la primera página).
//     · Los elegidos van al inicio, en el orden elegido.
//     · Justo después siguen, sin dejar huecos, los demás productos de esa fecha (en su orden normal). Si solo eliges 1, los otros 29
//       lugares de la primera página los llenan los demás productos y la segunda parte empieza enseguida.
//     · Un producto elegido deja de aparecer en la parte de «los demás» (no se repite).
//   Funciona con el filtro de «Festividad» o de «Evento» que esté activo, entres por los botones de «Fechas especiales» o por «Filtros de productos».
//   Sin ese filtro (catálogo completo, otras secciones) el orden vuelve a ser el de la hoja: no se toca la hoja de productos.
//
//   Se guarda en la pestaña «DestacadosFechas» de la hoja (la crea sola el Apps Script con la acción «destacadosfechas», que vuelve a verificar
//   el token de Firebase y el correo; aquí solo se evita mostrar el botón a otras personas).
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    var HOJA = 'DestacadosFechas';
    var CACHE_KEY = 'velas_destacados_fechas_v1';
    var POR_PAGINA = 30;
    var mapa = {};            // 'festividad:navidad' → ['Nombre del producto', ...]
    var reordenado = false;   // ¿se movieron tarjetas? (para devolverlas a su orden al quitar el filtro)
    var barra = null, modal = null, trabajo = [], guardando = false, filtroModal = null;

    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
    function boton(txt, cls) { var b = el('button', cls, txt); b.type = 'button'; return b; }
    function aviso(m) { if (typeof mostrarToast === 'function') mostrarToast(m); }
    function esAdmin() { var u = (typeof auth !== 'undefined') ? auth.currentUser : null; return !!u && typeof _esAdminUI === 'function' && _esAdminUI(u); }
    function norm(t) { return String(t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' '); }
    function slug(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); }
    function grid() { return document.getElementById('gridProductos'); }
    function cards() { var g = grid(); return g ? Array.prototype.slice.call(g.querySelectorAll('.card-dinamica')) : []; }
    function idx(c) { return parseInt(c.getAttribute('data-idx'), 10) || 0; }
    function nombreDe(c) { return (c.getAttribute('data-nombre') || '').trim(); }
    function limpiar(arr) {
        var vistos = {}, out = [];
        (Array.isArray(arr) ? arr : []).forEach(function (n) {
            n = String(n || '').trim();
            var k = norm(n);
            if (n && !vistos[k] && out.length < POR_PAGINA) { vistos[k] = 1; out.push(n); }
        });
        return out;
    }

    // ── ¿Qué filtro de fecha está activo? (se lee de los mismos botones que marca app.js) ──
    function filtroActivo() {
        var b = document.querySelector('.btn-festividad-carrusel.activo-evento');
        var s = b && (b.getAttribute('data-festividad') || '').trim();
        if (s && s !== 'todos') return { clave: 'festividad:' + s, tipo: 'festividad', slug: s, btn: b };
        b = document.querySelector('.btn-evento-carrusel.activo-evento:not(.btn-forma-carrusel):not(.btn-festividad-carrusel)');
        s = b && (b.getAttribute('data-evento') || '').trim();
        if (s && s !== 'todos') return { clave: 'evento:' + s, tipo: 'evento', slug: s, btn: b };
        return null;
    }
    // Mismo criterio que usan filtrarPorFestividadCarrusel / filtrarPorEventoCarrusel
    function coincide(card, f) {
        var datos = (card.getAttribute('data-evento') || '').toLowerCase().split('|');
        if (f.tipo === 'evento') return datos.map(slug).filter(Boolean).indexOf(slug(f.slug)) !== -1;
        var lim = datos.map(function (s) { return s.trim(); }).filter(Boolean);
        return lim.indexOf(f.slug) !== -1 || (card.getAttribute('data-nombre') || '').toLowerCase().indexOf(f.slug.replace(/-/g, ' ')) !== -1;
    }
    function nombreFiltro(f) {
        var t = f.btn ? (f.btn.textContent || '').replace(/\s+/g, ' ').trim() : f.slug;
        return t || f.slug;
    }

    // ── Reordenar las tarjetas del catálogo (sin tocar la hoja) ──
    function colocarEnOrden(lista) {
        var g = grid(); if (!g) return;
        var actual = cards();
        var igual = actual.length === lista.length && actual.every(function (c, i) { return c === lista[i]; });
        if (igual) return;
        // Se deja una marca en el lugar de cada tarjeta y se reparte la nueva lista en esas mismas posiciones (así no se mueve nada más del grid)
        var marcas = actual.map(function (c) { var m = document.createTextNode(''); g.insertBefore(m, c); return m; });
        lista.forEach(function (c, i) { g.insertBefore(c, marcas[i]); });
        marcas.forEach(function (m) { if (m.parentNode) m.parentNode.removeChild(m); });
    }
    function reordenar() {
        var todas = cards();
        if (!todas.length) return;
        var f = filtroActivo();
        var nombres = f ? limpiar(mapa[f.clave]) : [];
        var normales = todas.slice().sort(function (a, b) { return idx(a) - idx(b); });
        if (!f || !nombres.length) {
            if (reordenado) { colocarEnOrden(normales); reordenado = false; }
            return;
        }
        var porNombre = {};
        normales.forEach(function (c) { if (coincide(c, f)) { var k = norm(nombreDe(c)); if (!porNombre[k]) porNombre[k] = c; } });
        var primeros = [], usados = {};
        nombres.forEach(function (n) {
            var c = porNombre[norm(n)];
            if (c && !usados[idx(c)]) { usados[idx(c)] = 1; primeros.push(c); }
        });
        if (!primeros.length) { if (reordenado) { colocarEnOrden(normales); reordenado = false; } return; }
        var resto = normales.filter(function (c) { return !usados[idx(c)]; });
        colocarEnOrden(primeros.concat(resto));
        reordenado = true;
    }

    // ── Enganche: justo antes de repartir los productos en páginas ──
    if (typeof window.actualizarPaginacion === 'function') {
        var original = window.actualizarPaginacion;
        window.actualizarPaginacion = function () {
            try { reordenar(); } catch (e) { console.warn('[destacados-fechas]', e); }
            var r = original.apply(this, arguments);
            try { actualizarBarra(); } catch (e) { /* nada */ }
            return r;
        };
    }

    // ── Estilos ──
    function estilos() {
        if (document.getElementById('estilosDestacadosFechas')) return;
        var s = el('style'); s.id = 'estilosDestacadosFechas';
        s.textContent = [
            '#dfBarra{max-width:1200px;margin:10px auto;padding:0 12px;text-align:center}',
            '#dfBarra button{padding:10px 16px;border:2px dashed #8c7565;border-radius:14px;background:#fff8ef;color:#5c4d43;font-weight:700;font-size:.95rem;cursor:pointer;font-family:inherit}',
            '#dfBarra button:hover{background:#f0eae4}',
            '#modalDestacados{display:none;position:fixed;inset:0;z-index:10060;background:rgba(0,0,0,.55);align-items:center;justify-content:center;padding:14px;box-sizing:border-box}',
            '#modalDestacados.abierto{display:flex}',
            '#modalDestacados .md-caja{background:#fff;color:#3b2f27;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;border-radius:18px;padding:18px 16px 14px;box-sizing:border-box;font-family:system-ui,sans-serif;box-shadow:0 12px 34px rgba(0,0,0,.4)}',
            '#modalDestacados h3{margin:0 0 4px;font-size:1.1rem}',
            '#modalDestacados h4{margin:14px 0 6px;font-size:.95rem;color:#5c4d43}',
            '#modalDestacados .md-nota{margin:0 0 10px;font-size:.85rem;color:#6b5a4f;line-height:1.4}',
            '#modalDestacados .md-item{display:flex;align-items:center;gap:6px;padding:6px 8px;border:1.5px solid #e8ddd5;border-radius:12px;margin-bottom:6px;font-size:.9rem;background:#faf7f4}',
            '#modalDestacados .md-item img{width:38px;height:38px;object-fit:cover;border-radius:8px;flex:0 0 auto;background:#efe7df}',
            '#modalDestacados .md-n{flex:1;min-width:0;word-break:break-word}',
            '#modalDestacados .md-pos{font-weight:800;color:#8c7565;min-width:22px;text-align:center}',
            '#modalDestacados .md-item button{width:34px;height:34px;border:1px solid #d4c5b8;border-radius:10px;background:#fff;cursor:pointer;font-size:15px;line-height:1;flex:0 0 auto}',
            '#modalDestacados .md-item button:disabled{opacity:.35;cursor:not-allowed}',
            '#modalDestacados .md-buscar{width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #d4c5b8;border-radius:10px;font-size:14px;margin-bottom:8px}',
            '#modalDestacados .md-lista{max-height:240px;overflow-y:auto;border:1px solid #e8ddd5;border-radius:12px;padding:6px}',
            '#modalDestacados .md-pick{cursor:pointer;width:100%;text-align:left;font-family:inherit;color:inherit}',
            '#modalDestacados .md-acc{display:flex;gap:8px;margin-top:14px}',
            '#modalDestacados .md-acc button{flex:1;padding:12px;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer}',
            '#modalDestacados .md-guardar{background:#8c7565;color:#fff}#modalDestacados .md-cancelar{background:#e8ddd5;color:#3b2f27}',
            '#modalDestacados .md-acc button:disabled{opacity:.5;cursor:not-allowed}',
            '#modalDestacados .md-msg{min-height:18px;margin-top:8px;font-size:.85rem;color:#6b5a4f}#modalDestacados .md-msg.error{color:#c0392b}'
        ].join('\n');
        document.head.appendChild(s);
    }

    // ── Botón del administrador (solo aparece con una fecha activa) ──
    function actualizarBarra() {
        var f = filtroActivo(), g = grid();
        if (!esAdmin() || !f || !g || !g.parentNode) { if (barra) barra.style.display = 'none'; return; }
        estilos();
        if (!barra) {
            barra = el('div'); barra.id = 'dfBarra';
            var b = boton('', ''); barra.appendChild(b);
            b.addEventListener('click', abrirPanel);
            g.parentNode.insertBefore(barra, g);
        }
        barra.style.display = '';
        var n = limpiar(mapa[f.clave]).length;
        barra.firstChild.textContent = '⭐ Elegir los productos principales de ' + nombreFiltro(f) + (n ? ' (' + n + ')' : '');
    }

    // ── Panel ──
    function msg(t, error) { var e = document.getElementById('mdMsg'); if (e) { e.textContent = t || ''; e.className = 'md-msg' + (error ? ' error' : ''); } }
    function cardPorNombre(n) { var k = norm(n), l = cards(); for (var i = 0; i < l.length; i++) if (norm(nombreDe(l[i])) === k) return l[i]; return null; }
    function miniatura(card) {
        var im = card && card.querySelector('.img-contenedor-dinamico img'), src = im ? im.getAttribute('src') : '';
        if (!src) return null;
        var t = document.createElement('img'); t.src = src; t.alt = ''; t.loading = 'lazy'; return t;
    }
    var buscarTxt = '';
    function pintarPanel() {
        var f = filtroModal; if (!f || !modal) return;
        var caja = modal.querySelector('.md-caja'); caja.textContent = '';
        caja.appendChild(el('h3', '', '⭐ Productos principales: ' + nombreFiltro(f)));
        caja.appendChild(el('p', 'md-nota', 'Estos salen primero al entrar a esta fecha, en este orden (hasta ' + POR_PAGINA + '). Después siguen, sin dejar huecos, todos los demás productos de la fecha; los que elijas aquí ya no se repiten en esa parte.'));

        caja.appendChild(el('h4', '', 'Al inicio (' + trabajo.length + '/' + POR_PAGINA + ')'));
        if (!trabajo.length) caja.appendChild(el('p', 'md-nota', 'Ninguno: se muestran todos en el orden normal de la hoja.'));
        trabajo.forEach(function (n, i) {
            var it = el('div', 'md-item');
            it.appendChild(el('span', 'md-pos', String(i + 1)));
            var mi = miniatura(cardPorNombre(n)); if (mi) it.appendChild(mi);
            it.appendChild(el('span', 'md-n', n));
            var sube = boton('▲'), baja = boton('▼'), quita = boton('✕');
            sube.disabled = i === 0; baja.disabled = i === trabajo.length - 1;
            sube.setAttribute('aria-label', 'Subir'); baja.setAttribute('aria-label', 'Bajar'); quita.setAttribute('aria-label', 'Quitar');
            sube.addEventListener('click', function () { var t = trabajo[i - 1]; trabajo[i - 1] = trabajo[i]; trabajo[i] = t; pintarPanel(); });
            baja.addEventListener('click', function () { var t = trabajo[i + 1]; trabajo[i + 1] = trabajo[i]; trabajo[i] = t; pintarPanel(); });
            quita.addEventListener('click', function () { trabajo.splice(i, 1); pintarPanel(); });
            it.appendChild(sube); it.appendChild(baja); it.appendChild(quita);
            caja.appendChild(it);
        });

        caja.appendChild(el('h4', '', 'Agregar un producto de esta fecha'));
        var inp = el('input', 'md-buscar'); inp.type = 'search'; inp.placeholder = 'Buscar por nombre…'; inp.value = buscarTxt;
        var lista = el('div', 'md-lista');
        caja.appendChild(inp); caja.appendChild(lista);
        function pintarLista() {
            lista.textContent = '';
            var usados = {}; trabajo.forEach(function (n) { usados[norm(n)] = 1; });
            var b = norm(buscarTxt), total = 0, mostrados = 0;
            cards().sort(function (a, c) { return idx(a) - idx(c); }).forEach(function (c) {
                var n = nombreDe(c);
                if (!n || usados[norm(n)] || !coincide(c, f)) return;
                if (b && norm(n).indexOf(b) === -1) return;
                total++;
                if (mostrados >= 40) return;
                mostrados++;
                var it = boton('', 'md-item md-pick');
                var mi = miniatura(c); if (mi) it.appendChild(mi);
                it.appendChild(el('span', 'md-n', n));
                it.addEventListener('click', function () {
                    if (trabajo.length >= POR_PAGINA) { msg('Máximo ' + POR_PAGINA + ' productos al inicio.', true); return; }
                    trabajo.push(n); pintarPanel();
                });
                lista.appendChild(it);
            });
            if (!total) lista.appendChild(el('p', 'md-nota', 'No hay más productos de esta fecha que coincidan.'));
            else if (total > mostrados) lista.appendChild(el('p', 'md-nota', '…y ' + (total - mostrados) + ' más. Escribe para filtrar.'));
        }
        inp.addEventListener('input', function () { buscarTxt = inp.value; pintarLista(); });
        pintarLista();

        var m = el('div', 'md-msg'); m.id = 'mdMsg'; caja.appendChild(m);
        var acc = el('div', 'md-acc');
        var g = boton('💾 Guardar', 'md-guardar'); g.id = 'mdGuardar';
        var c = boton('Cancelar', 'md-cancelar');
        g.addEventListener('click', guardar); c.addEventListener('click', cerrarPanel);
        acc.appendChild(g); acc.appendChild(c); caja.appendChild(acc);
    }
    function abrirPanel() {
        if (!esAdmin()) { aviso('Tu sesión no está autorizada.'); return; }
        var f = filtroActivo(); if (!f) return;
        estilos();
        if (!modal) {
            modal = el('div'); modal.id = 'modalDestacados'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
            modal.appendChild(el('div', 'md-caja'));
            modal.addEventListener('click', function (e) { if (e.target === modal && !guardando) cerrarPanel(); });
            document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('abierto') && !guardando) cerrarPanel(); });
            document.body.appendChild(modal);
        }
        filtroModal = f; buscarTxt = '';
        trabajo = limpiar(mapa[f.clave]);
        pintarPanel();
        modal.classList.add('abierto');
        document.body.style.overflow = 'hidden';
    }
    function cerrarPanel() { if (!modal) return; modal.classList.remove('abierto'); document.body.style.overflow = ''; }

    function guardar() {
        if (guardando || !filtroModal) return;
        var user = (typeof auth !== 'undefined') ? auth.currentUser : null;
        if (!esAdmin() || !user) { msg('Tu sesión no está autorizada.', true); return; }
        var f = filtroModal, nuevo = limpiar(trabajo);
        guardando = true; document.getElementById('mdGuardar').disabled = true; msg('Guardando en la hoja…');
        user.getIdToken(true).then(function (tok) {
            return fetch(ADMIN_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // evita el preflight CORS que Apps Script no responde
                body: JSON.stringify({ idToken: tok, accion: 'destacadosfechas', filtro: f.clave, productos: nuevo })
            });
        }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d.ok) throw new Error(d.error || 'Error del servidor');
            if (nuevo.length) mapa[f.clave] = nuevo; else delete mapa[f.clave];
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(mapa)); } catch (e) { /* sin almacenamiento */ }
            cerrarPanel();
            if (typeof window.actualizarPaginacion === 'function') window.actualizarPaginacion();
            aviso('✅ Productos principales guardados');
        }).catch(function (e) {
            var t = String((e && e.message) || e);
            if (/Falta el nombre|Precio inv/i.test(t)) t = 'el Apps Script todavía no tiene la acción «destacadosfechas»: pega el codigo.gs nuevo y publícalo como versión nueva.';
            msg('No se pudo guardar: ' + t, true);
        }).then(function () { guardando = false; var g = document.getElementById('mdGuardar'); if (g) g.disabled = false; });
    }

    // ── Leer lo guardado (pestaña «DestacadosFechas», CSV público; si no existe todavía, no hay ninguno) ──
    function leer() {
        if (typeof SHEET_ID === 'undefined' || typeof parsearCSV !== 'function') return Promise.resolve(null);
        var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(HOJA) + '&_=' + Date.now();
        return fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); }).then(function (t) {
            var filas = parsearCSV(t);
            // Si la pestaña no existe, Google devuelve otra hoja: se valida el encabezado
            if (!filas.length || (filas[0][0] || '').trim().toLowerCase() !== 'filtro' || (filas[0][1] || '').trim().toLowerCase() !== 'productos') return null;
            var nuevo = {};
            for (var i = 1; i < filas.length; i++) {
                var clave = (filas[i][0] || '').trim(), lista = [];
                try { lista = limpiar(JSON.parse(filas[i][1] || '[]')); } catch (e) { }
                if (/^(festividad|evento):[a-z0-9-]{1,60}$/.test(clave) && lista.length) nuevo[clave] = lista;
            }
            return nuevo;
        });
    }

    function iniciar() {
        try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (c && typeof c === 'object') mapa = c; } catch (e) { /* nada */ }
        leer().then(function (m) {
            if (!m) return;
            mapa = m;
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(m)); } catch (e) { /* sin almacenamiento */ }
            if (filtroActivo() && typeof window.actualizarPaginacion === 'function') window.actualizarPaginacion();
        }).catch(function (e) { console.warn('[destacados-fechas] no se pudo leer la configuración:', e); });
        if (typeof auth !== 'undefined' && auth.onAuthStateChanged) auth.onAuthStateChanged(function () { actualizarBarra(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
