// ══════════════════════════════════════════════════════════════════════════════
// VELAS KUKÚMITA — Portada del catálogo + botón ⚙️ de configuración (solo administradores)
// Se carga DESPUÉS de app.js (usa: auth, _esAdminUI, ADMIN_ENDPOINT, SHEET_ID, parsearCSV, listaProductos,
// mostrarToast y cargarDesdeGoogleSheets).
//
// QUÉ HACE
//   · La PÁGINA 1 del catálogo es una portada: NO muestra los productos de la hoja en su orden; solo filas de 3 productos
//     «reflejados» (copias) de los mejores productos, que siguen viviendo en su lugar de la hoja. Los productos de la hoja
//     empiezan a verse desde la PÁGINA 2 (30 por página).
//   · Por defecto cada fila es AUTOMÁTICA: fila 1 = primeros 3 productos de la página 2, fila 2 = primeros 3 de la página 3, …
//     (hasta 10 filas = páginas 2 a 11).
//   · Desde el ⚙️ el administrador puede cambiar cualquier fila por una sección (evento/temporada, etiqueta, más vendidos,
//     oferta) y ponerle un título. Las demás filas siguen en automático.
//   · Con filtros o búsqueda activos la portada no se usa (se ve la paginación normal).
//   · El botón ⚙️ (esquina superior derecha, fijo aunque se haga scroll) solo se dibuja para los correos de ADMIN_EMAILS.
//     La seguridad real está en el Apps Script (acción «portada» en codigo.gs), que vuelve a verificar el token de Firebase.
//
// DÓNDE SE GUARDA: pestaña «Portada» de la misma hoja de Google (la crea sola el Apps Script la primera vez que se guarda):
//   Fila | Filtro | Etiqueta        ·   Filtro = «tipo:cirios», «evento:navidad», «especial:masvendido», «especial:oferta»
//   o «especial:auto» (fila automática: primeros 3 productos de la página que le toca)
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    var POR_FILA = 3;          // productos por fila (una fila del catálogo en computadora)
    var MAX_FILAS = 10;        // filas de la portada (10 × 3 = 30, caben en la página 1). La fila N toma de la página N+1
    var POR_PAGINA = 30;       // debe coincidir con POR_PAGINA de la paginación en app.js
    var AUTO = 'especial:auto';
    var HOJA = 'Portada';
    var CACHE_KEY = 'velas_portada_v1';

    window._portadaCfg = null; // [{ filtro: 'evento:navidad', etiqueta: 'Navidad' }, …]  (null = aún no se lee)

    // ── Utilidades ──
    function normSlug(s) {
        return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').trim();
    }
    // «dia-de-muertos» y «dia-muertos» son el mismo evento (en el sitio aparecen escritos de las dos maneras)
    function claveSlug(s) { return normSlug(s).replace(/-(de|del|de-la|de-las|de-los|la|las|los)(?=-)/g, ''); }
    function bonito(s) {
        var t = String(s || '').replace(/[-_]+/g, ' ').trim();
        return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
    }
    var NOMBRES_EVENTO = {
        'navidad': '🎄 Navidad', 'dia-muertos': '💀 Día de Muertos', 'posada': 'Posadas', 'ano-nuevo': 'Año Nuevo',
        'san-valentin': 'San Valentín', 'dia-madres': 'Día de las Madres', 'dia-padre': 'Día del Padre', 'dia-nino': 'Día del Niño',
        'religioso': 'Religioso', 'baby-shower': 'Baby Shower', 'quince-anos': 'Quinceaños', 'primera-comunion': 'Primera Comunión'
    };
    function nombreFiltro(filtro) {
        var p = String(filtro || '').split(':'), tipo = p[0], v = p.slice(1).join(':');
        if (tipo === 'especial' && v === 'auto') return '';
        if (tipo === 'especial') return v === 'masvendido' ? 'Más vendidos' : v === 'oferta' ? 'En oferta' : bonito(v);
        if (tipo === 'evento') {
            var n = NOMBRES_EVENTO[v] || NOMBRES_EVENTO[claveSlug(v)] || bonito(v);
            return n.replace(/^[^\wÁÉÍÓÚÑáéíóúñ]+\s*/, '');   // sin el emoji, para usarlo como título por defecto
        }
        return bonito(v);
    }
    function esAdminActual() {
        var u = (typeof auth !== 'undefined') ? auth.currentUser : null;
        return (typeof _esAdminUI === 'function') && _esAdminUI(u);
    }
    function el(tag, cls, txt) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (txt != null) e.textContent = txt;
        return e;
    }

    // ── ¿Esta tarjeta pertenece a ese filtro? ──
    function coincide(card, filtro) {
        var p = String(filtro || '').split(':'), tipo = p[0], v = p.slice(1).join(':');
        if (!v) return false;
        if (tipo === 'tipo') {
            return (card.getAttribute('data-tipos') || '').split('|').some(function (t) { return normSlug(t) === normSlug(v); });
        }
        if (tipo === 'evento') {
            return (card.getAttribute('data-evento') || '').split('|').some(function (e) { return claveSlug(e) === claveSlug(v); });
        }
        if (tipo === 'especial') {
            if (v === 'masvendido') return card.getAttribute('data-mas-vendido') === '1';
            if (v === 'oferta') return card.getAttribute('data-oferta') === '1';
        }
        return false;
    }

    // ── Leer la configuración (pestaña «Portada», CSV público) ──
    // Las filas son POSICIONALES (la fila 3 es la fila 3): una fila vacía o inválida se vuelve «automática», no se elimina
    function limpiarFilas(arr) {
        return (arr || []).slice(0, MAX_FILAS).map(function (f) {
            var filtro = String((f && f.filtro) || '').trim();
            if (!/^(tipo|evento|especial):.+/.test(filtro)) return { filtro: AUTO, etiqueta: '' };
            return { filtro: filtro, etiqueta: String((f && f.etiqueta) || '').trim().slice(0, 60) };
        });
    }
    function leerConfig() {
        var id = (typeof SHEET_ID !== 'undefined') ? SHEET_ID : '';
        var url = 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(HOJA) + '&_=' + Date.now();
        return fetch(url).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        }).then(function (t) {
            var rows = parsearCSV(t), hd = -1, i;
            for (i = 0; i < Math.min(rows.length, 3); i++) {
                var cab = rows[i].map(normSlug);
                if (cab.indexOf('filtro') !== -1 && cab.indexOf('etiqueta') !== -1) { hd = i; break; }
            }
            if (hd < 0) return null;   // la pestaña «Portada» todavía no existe
            var cb = rows[hd].map(normSlug), iFi = cb.indexOf('fila'), iFl = cb.indexOf('filtro'), iEt = cb.indexOf('etiqueta'), lista = [];
            for (i = hd + 1; i < rows.length; i++) {
                lista.push({ n: iFi >= 0 ? (parseInt(rows[i][iFi], 10) || i) : i, filtro: rows[i][iFl] || '', etiqueta: rows[i][iEt] || '' });
            }
            lista.sort(function (a, b) { return a.n - b.n; });
            return limpiarFilas(lista);
        });
    }
    function cargarConfig() {
        var lectura = leerConfig().then(function (cfg) {
            if (cfg) { window._portadaCfg = cfg; try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); } catch (e) { /* sin almacenamiento */ } }
            else if (!window._portadaCfg) window._portadaCfg = [];
        }).catch(function (e) {
            console.warn('[portada] no se pudo leer la configuración:', e);
            try { var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); if (Array.isArray(c) && !window._portadaCfg) window._portadaCfg = limpiarFilas(c); } catch (x) { /* nada */ }
        });
        // El catálogo no se queda esperando más de 4 segundos a esta lectura
        return Promise.race([lectura, new Promise(function (ok) { setTimeout(ok, 4000); })]);
    }
    // app.js espera esta promesa antes de pintar el catálogo, para que la portada ya salga acomodada
    window.portadaListaPromesa = cargarConfig();

    // ── Portada: filas de copias en la página 1, con título opcional ──
    var obs = null, grupos = [], totalOriginales = 0;
    function sincronizarCabeceras() {
        grupos.forEach(function (g) {
            if (!g.cab) return;
            var hay = g.cards.some(function (c) { return !c.classList.contains('oculto') && !c.classList.contains('paginacion-oculto'); });
            g.cab.style.display = hay ? '' : 'none';
        });
    }
    var rafSync = 0;
    function pedirSync() { if (rafSync) return; rafSync = requestAnimationFrame(function () { rafSync = 0; sincronizarCabeceras(); }); }

    function esAuto(f) { return !f || !f.filtro || f.filtro === AUTO; }
    function productoPorIdx(idx) {
        var L = (typeof listaProductos !== 'undefined' && listaProductos) ? listaProductos : [];
        for (var k = 0; k < L.length; k++) { if (String(L[k].id) === String(idx)) return L[k]; }
        return null;
    }

    function aplicarPortada() {
        var grid = document.getElementById('gridProductos');
        if (!grid) return;
        if (obs) { obs.disconnect(); obs = null; }
        grid.querySelectorAll('.portada-cab, .portada-corte, .card-portada').forEach(function (n) { n.remove(); });
        grupos = [];
        var cards = Array.prototype.slice.call(grid.querySelectorAll(':scope > .card-dinamica'));
        totalOriginales = cards.length;
        if (!cards.length || typeof window._crearCardProducto !== 'function') return;
        var cfg = window._portadaCfg || [], usadas = new Set(), frag = document.createDocumentFragment();

        for (var i = 0; i < MAX_FILAS; i++) {
            var fila = cfg[i] || null, auto = esAuto(fila), elegidas;
            if (auto) {
                // Automática: primeros productos de la página (i + 2) de la hoja
                elegidas = cards.slice(i * POR_PAGINA, (i + 1) * POR_PAGINA).filter(function (c) { return !usadas.has(c); }).slice(0, POR_FILA);
            } else {
                // Sección elegida: primeros productos de toda la hoja con esa etiqueta / evento
                elegidas = cards.filter(function (c) { return !usadas.has(c) && coincide(c, fila.filtro); }).slice(0, POR_FILA);
            }
            if (!elegidas.length) continue;
            var copias = [];
            elegidas.forEach(function (c) {
                usadas.add(c);
                var p = productoPorIdx(c.getAttribute('data-idx'));
                if (!p) return;
                var copia = window._crearCardProducto(p, true);
                copia.classList.add('paginacion-oculto');   // la paginación la muestra solo en la página 1
                copias.push(copia);
            });
            if (!copias.length) continue;
            var titulo = (fila && fila.etiqueta) ? fila.etiqueta : (auto ? '' : nombreFiltro(fila.filtro));
            var cab = null;
            if (titulo) { cab = el('div', 'portada-cab'); cab.appendChild(el('h3', '', titulo)); frag.appendChild(cab); }
            copias.forEach(function (c) { frag.appendChild(c); });
            frag.appendChild(el('div', 'portada-corte'));   // corte de fila: lo que sigue empieza en una fila nueva
            grupos.push({ cab: cab, cards: copias });
        }
        if (!grupos.length) return;
        // Las copias van AL FINAL del grid: así cualquier búsqueda de «la tarjeta del producto X» encuentra primero la original
        grid.appendChild(frag);
        obs = new MutationObserver(pedirSync);
        obs.observe(grid, { attributes: true, attributeFilter: ['class'], subtree: true });
        sincronizarCabeceras();
    }
    window.aplicarPortada = aplicarPortada;
    // Utilidades que reutiliza cuadricula.js
    window._portadaUtil = { normSlug: normSlug, claveSlug: claveSlug, nombreFiltro: nombreFiltro };

    // La paginación (app.js) pregunta si la página 1 es la portada: solo si hay filas Y no hay filtro/búsqueda activos
    window._portadaHayPagina1 = function (nVisibles) {
        return grupos.length > 0 && nVisibles === totalOriginales;
    };

    // Cada vez que app.js vuelve a pintar el catálogo, se acomoda la portada
    var origRender = window.renderizarCatalogoCompleto;
    if (typeof origRender === 'function') {
        window.renderizarCatalogoCompleto = function () {
            var r = origRender.apply(this, arguments);
            try { aplicarPortada(); } catch (e) { console.warn('[portada]', e); }
            return r;
        };
    }

    // ══════════════ Administrador: botón ⚙️ y panel ══════════════
    var btn = null, modal = null, filas = [], guardando = false;

    // Opciones de filtro que existen en los productos cargados
    function opcionesFiltro() {
        var tipos = {}, eventos = {}, L = (typeof listaProductos !== 'undefined' && listaProductos) ? listaProductos : [];
        L.forEach(function (p) {
            (p.tipos || []).forEach(function (t) { var k = normSlug(t); if (k && k !== 'sin-etiqueta') tipos[k] = (tipos[k] || 0) + 1; });
            String(p.eventos || '').split('|').forEach(function (e) {
                var k = claveSlug(e); if (k && k !== 'sin-evento' && k !== 'sin') eventos[k] = (eventos[k] || 0) + 1;
            });
        });
        var ops = [];
        Object.keys(eventos).sort().forEach(function (k) { ops.push({ valor: 'evento:' + k, texto: 'Evento / temporada: ' + nombreFiltro('evento:' + k), n: eventos[k] }); });
        Object.keys(tipos).sort().forEach(function (k) { ops.push({ valor: 'tipo:' + k, texto: 'Etiqueta: ' + nombreFiltro('tipo:' + k), n: tipos[k] }); });
        ops.push({ valor: 'especial:masvendido', texto: 'Especial: Más vendidos', n: L.filter(function (p) { return p.masVendido; }).length });
        ops.push({ valor: 'especial:oferta', texto: 'Especial: En oferta', n: L.filter(function (p) { return p.oferta; }).length });
        return ops;
    }
    function adivinar(ops, pista) {
        var q = normSlug(pista), hallada = '';
        ops.forEach(function (o) { if (!hallada && normSlug(o.texto).indexOf(q) !== -1) hallada = o.valor; });
        return hallada;
    }
    function estado(msg, error) {
        var s = document.getElementById('cfgPortadaEstado'); if (!s) return;
        s.textContent = msg || ''; s.style.color = error ? '#c0392b' : '#8c7565';
    }

    function pintarFilas() {
        var cont = document.getElementById('cfgPortadaFilas'); if (!cont) return;
        var ops = opcionesFiltro();
        cont.innerHTML = '';
        filas.forEach(function (f, i) {
            var caja = el('div', 'cfgp-fila');
            caja.appendChild(el('div', 'cfgp-num', 'Fila ' + (i + 1)));
            var sel = document.createElement('select'); sel.className = 'cfgp-sel';
            var vacio = document.createElement('option'); vacio.value = AUTO; vacio.textContent = 'Automático — primeros 3 de la página ' + (i + 2); sel.appendChild(vacio);
            var existe = false;
            ops.forEach(function (o) {
                var op = document.createElement('option'); op.value = o.valor; op.textContent = o.texto + '  (' + o.n + ')'; sel.appendChild(op);
                if (o.valor === f.filtro) existe = true;
            });
            if (f.filtro && !existe) { var raro = document.createElement('option'); raro.value = f.filtro; raro.textContent = nombreFiltro(f.filtro) + ' (sin productos)'; sel.appendChild(raro); }
            sel.value = f.filtro || AUTO;
            var inp = document.createElement('input'); inp.type = 'text'; inp.className = 'cfgp-inp'; inp.maxLength = 60;
            inp.placeholder = 'Título de la fila (opcional)'; inp.value = f.etiqueta || '';
            sel.addEventListener('change', function () {
                var anterior = nombreFiltro(f.filtro);
                f.filtro = sel.value;
                if (!f.etiqueta || f.etiqueta === anterior) { f.etiqueta = f.filtro ? nombreFiltro(f.filtro) : ''; inp.value = f.etiqueta; }   // (automático → sin título)
            });
            inp.addEventListener('input', function () { f.etiqueta = inp.value; });
            caja.appendChild(sel); caja.appendChild(inp);
            cont.appendChild(caja);
        });
    }
    function $(id) { return document.getElementById(id); }

    function construirModal() {
        if (modal) return;
        modal = el('div', ''); modal.id = 'modalConfigPortada';
        modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'Configuración del sitio');
        modal.innerHTML =
            '<div class="cfgp-caja">' +
                '<div class="cfgp-cab"><h3>⚙️ Configuración</h3><button type="button" class="cfgp-x" id="cfgPortadaCerrar" aria-label="Cerrar">✕</button></div>' +
                '<div class="cfgp-cuerpo">' +
                    '<div class="cfgp-bloque-cuadricula">' +
                        '<button type="button" class="cfgp-cuadricula" id="btnAbrirCuadricula">🧱 Cuadrícula de productos</button>' +
                        '<p class="cfgp-ayuda">Ve todos los productos juntos (10 por fila, solo en computadora) y arrástralos para cambiarlos de posición.</p>' +
                    '</div>' +
                    '<h4>Filas de la portada (página 1)</h4>' +
                    '<p class="cfgp-ayuda">La <b>página 1</b> solo muestra estas filas de 3 productos; los productos de la hoja empiezan en la página 2. ' +
                    'En <b>Automático</b>, la fila 1 muestra los primeros 3 productos de la página 2, la fila 2 los de la página 3, y así sucesivamente. ' +
                    'Cambia cualquier fila por un evento/temporada, una etiqueta, más vendidos u ofertas, y ponle título si quieres.</p>' +
                    '<div id="cfgPortadaFilas"></div>' +
                    '<div class="cfgp-estado" id="cfgPortadaEstado"></div>' +
                '</div>' +
                '<div class="cfgp-pie">' +
                    '<button type="button" class="cfgp-btn" id="cfgPortadaCancelar">Cancelar</button>' +
                    '<button type="button" class="cfgp-btn principal" id="cfgPortadaGuardar">Guardar</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (e) { if (e.target === modal) cerrarPanel(); });
        $('cfgPortadaCerrar').addEventListener('click', cerrarPanel);
        $('cfgPortadaCancelar').addEventListener('click', cerrarPanel);
        $('cfgPortadaGuardar').addEventListener('click', guardar);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('abierto')) cerrarPanel(); });
    }
    function abrirPanel() {
        if (!esAdminActual()) return;
        construirModal();
        var cfg = window._portadaCfg || [];
        filas = [];
        for (var k = 0; k < MAX_FILAS; k++) {
            var c = cfg[k];
            filas.push(c ? { filtro: c.filtro || AUTO, etiqueta: c.etiqueta || '' } : { filtro: AUTO, etiqueta: '' });
        }
        estado('');
        pintarFilas();
        modal.classList.add('abierto');
        document.body.style.overflow = 'hidden';
    }
    function cerrarPanel() {
        if (!modal) return;
        modal.classList.remove('abierto');
        document.body.style.overflow = '';
    }

    function guardar() {
        if (guardando) return;
        var user = (typeof auth !== 'undefined') ? auth.currentUser : null;
        if (!esAdminActual() || !user) { estado('Tu sesión no está autorizada.', true); return; }
        var nuevo = limpiarFilas(filas);
        // No se guardan las filas automáticas del final que no tienen título (así «todo automático» = portada sin configuración)
        while (nuevo.length && nuevo[nuevo.length - 1].filtro === AUTO && !nuevo[nuevo.length - 1].etiqueta) nuevo.pop();
        guardando = true; $('cfgPortadaGuardar').disabled = true; estado('Guardando…');
        user.getIdToken(true).then(function (tok) {
            return fetch(ADMIN_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ idToken: tok, accion: 'portada', filas: nuevo })
            });
        }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d.ok) throw new Error(d.error || 'Error del servidor');
            window._portadaCfg = nuevo;
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(nuevo)); } catch (e) { /* sin almacenamiento */ }
            cerrarPanel();
            if (typeof mostrarToast === 'function') mostrarToast('✅ Portada guardada');
            if (typeof cargarDesdeGoogleSheets === 'function') cargarDesdeGoogleSheets();   // vuelve a pintar el catálogo con el nuevo orden
        }).catch(function (e) {
            var m = String((e && e.message) || e);
            if (/Falta el nombre|Precio inv/i.test(m)) m = 'el Apps Script todavía no tiene la acción de portada: pega el codigo.gs nuevo y publícalo otra vez.';
            estado('No se pudo guardar: ' + m, true);
        }).then(function () { guardando = false; var g = $('cfgPortadaGuardar'); if (g) g.disabled = false; });
    }

    function crearBoton() {
        if (btn) return;
        btn = el('button', '', '⚙️'); btn.id = 'btnConfigSitio'; btn.type = 'button';
        btn.setAttribute('aria-label', 'Configuración del sitio'); btn.title = 'Configuración';
        btn.style.display = 'none';
        btn.addEventListener('click', abrirPanel);
        document.body.appendChild(btn);
    }
    function actualizarBoton() {
        crearBoton();
        var ok = esAdminActual();
        btn.style.display = ok ? 'flex' : 'none';
        if (!ok) cerrarPanel();
    }
    (function engancharAuth() {
        if (typeof auth === 'undefined' || !auth.onAuthStateChanged || typeof _esAdminUI !== 'function') { setTimeout(engancharAuth, 300); return; }
        crearBoton();
        auth.onAuthStateChanged(actualizarBoton);
        actualizarBoton();
    })();
})();
