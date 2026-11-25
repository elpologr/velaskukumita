// ══════════════════════════════════════════════════════════════════════════════
// VELAS KUKÚMITA — Mesas (vista 2.5D PÚBLICA)
// Se carga DESPUÉS de app.js (usa: auth, _esAdminUI, mostrarToast, SHEET_ID y ADMIN_ENDPOINT).
//
// PASO 1: las mesas con vista 2.5D (cámara inclinada: se ve la cara de arriba y el grosor del frente) y un texto por mesa.
//   · Cualquier visitante puede ver las mesas, moverse (arrastrar, pellizcar, rueda) y tocar una
//     mesa para acercarla y leer su texto. No puede cambiar nada.
//   · Solo los administradores (_esAdminUI) ven el botón «✏️ Editar» para escribir el texto de cada mesa.
//     El servidor lo vuelve a comprobar con el token de Firebase (acción «mesaTexto» en codigp.gs),
//     así que ocultar el botón no es la seguridad: la seguridad real está en el Apps Script.
//
// Dónde viven los datos: pestaña «Mesas» de la misma hoja de Google (SHEET_ID). Se lee como CSV vía gviz
// (público, igual que el resto del sitio) y se escribe solo por el Apps Script. La pestaña se crea sola
// la primera vez que un administrador guarda un texto. También se puede editar a mano en la hoja.
//
// Se dibuja en <canvas> (muchas celdas en HTML serían demasiado pesadas). Pasos siguientes: piezas
// (productos) sobre las celdas, que abrirán el submenú de producto con carrito y favoritos.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // ── Medidas de la mesa grande (celdas) ──
    var NC = 200, NF = 60;       // 200 columnas × 60 filas de celdas
    var MC = 20, MF = 15;        // cada mesa chica: 20 columnas × 15 filas
    var G = 3;                   // hueco entre mesas a lo ancho (columnas)
    var GF = 6;                  // hueco entre una mesa y la de arriba (filas): ahí se escribe el texto de cada mesa
    var MESAS_C = NC / MC, MESAS_F = NF / MF;   // 10 × 4 = 40 mesas
    var TW = 64, TH = 40;        // ancho y alto de una celda en pantalla (vista 2.5D: TH < TW da la sensación de inclinación)
    var M = 1.5;
    var DEPTH = 28;              // grosor del tablero (la cara frontal que se ve)
    var MAX_ESCALA = 4;
    var MAX_TEXTO = 500;         // máximo de letras por mesa (el servidor lo vuelve a limitar)
    var CACHE_KEY = 'velas_mesas_textos_v1';
    var HOJA = 'Mesas';
    var SHEET_ID_RESPALDO = '1jin2wMYingvbPD2csGxIbm5AhulfRvCRvIzAKJTUNMw';
    var ENDPOINT_RESPALDO = 'https://script.google.com/macros/s/AKfycbyDp6hVMXjv8pNpbpmadzilQN-pOC2jitBiV1bn6meNdDteKEw-814ZvicOPYmxdTcH/exec';
    var AC = NC + (MESAS_C - 1) * G, AF = NF + (MESAS_F - 1) * GF;   // medidas totales con huecos

    var S = {
        textos: {}, recientes: {}, sel: null, editando: false, cola: Promise.resolve(),
        scale: 0.05, ox: 0, oy: 0, w: 0, h: 0, dpr: 1, minEscala: 0.03, fitEscala: 0.05,
        raf: 0, anim: 0, abierta: false, ajustada: false
    };
    var root = null, cv = null;

    function $(id) { return document.getElementById(id); }
    function proj(c, r) { return [c * TW, r * TH]; }   // 2.5D: columnas → X, filas → Y (acortada por la inclinación)
    function clave(mr, mc) { return mr + ',' + mc; }
    function numeroMesa(mr, mc) { return mr * MESAS_C + mc + 1; }
    function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
    function esAdmin() {
        var u = (typeof auth !== 'undefined') ? auth.currentUser : null;
        return (typeof _esAdminUI === 'function') && _esAdminUI(u);
    }
    function endpoint() { return window.ADMIN_ENDPOINT || ENDPOINT_RESPALDO; }

    // ── Administrador: botón «Editar» ──
    function actualizarAdmin() {
        if (!root) return;
        var admin = esAdmin();
        $('mesasEditar').style.display = admin ? 'block' : 'none';
        if (!admin && S.editando) alternarEdicion(false);
    }
    (function engancharAuth() {
        if (typeof auth === 'undefined' || !auth.onAuthStateChanged || typeof _esAdminUI !== 'function') {
            setTimeout(engancharAuth, 300);
            return;
        }
        auth.onAuthStateChanged(actualizarAdmin);
        actualizarAdmin();
    })();

    // ── Construcción de la pantalla (una sola vez) ──
    function construir() {
        if (root) return;
        root = document.createElement('div');
        root.id = 'pantallaMesas';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'Nuestras Mesas');
        root.innerHTML =
            '<div class="mesas-header">' +
                '<button class="mesas-volver" type="button" id="mesasVolver" aria-label="Volver">‹</button>' +
                '<h3>Nuestras Mesas</h3>' +
                '<button class="mesas-editar" type="button" id="mesasEditar">✏️ Editar</button>' +
            '</div>' +
            '<div class="mesas-lienzo" id="mesasLienzo">' +
                '<canvas id="mesasCanvas"></canvas>' +
                '<div class="mesas-zoom">' +
                    '<button type="button" id="mesasMas" aria-label="Acercar">+</button>' +
                    '<button type="button" id="mesasMenos" aria-label="Alejar">−</button>' +
                    '<button type="button" id="mesasAjustar" aria-label="Ver todas las mesas">⤢</button>' +
                '</div>' +
                '<div class="mesas-caption" id="mesasCaption"></div>' +
                '<div class="mesas-panel-admin" id="mesasPanelAdmin">' +
                    '<div class="mesas-panel-titulo" id="mesasPanelTitulo"></div>' +
                    '<textarea id="mesasTexto" class="mesas-texto" rows="3" maxlength="' + MAX_TEXTO + '" placeholder="Texto de esta mesa…"></textarea>' +
                    '<div class="mesas-fila">' +
                        '<button type="button" class="mesas-btn principal" id="mesasGuardar">Guardar texto</button>' +
                        '<button type="button" class="mesas-btn peligro" id="mesasQuitar">Quitar texto</button>' +
                    '</div>' +
                    '<div class="mesas-estado" id="mesasEstado"></div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(root);
        cv = $('mesasCanvas');

        $('mesasVolver').addEventListener('click', cerrarMesas);
        $('mesasMas').addEventListener('click', function () { zoomCentro(1.4); });
        $('mesasMenos').addEventListener('click', function () { zoomCentro(1 / 1.4); });
        $('mesasAjustar').addEventListener('click', function () { deseleccionar(); ajustarVista(); pedirDibujo(); });
        $('mesasEditar').addEventListener('click', function () { alternarEdicion(); });
        $('mesasGuardar').addEventListener('click', function () {
            if (!S.sel) return;
            enviar(S.sel.mr, S.sel.mc, $('mesasTexto').value, false);
        });
        $('mesasQuitar').addEventListener('click', function () {
            if (!S.sel) return;
            $('mesasTexto').value = '';
            enviar(S.sel.mr, S.sel.mc, '', false);
        });
        window.addEventListener('resize', function () { if (S.abierta) { medir(); pedirDibujo(); } });
        document.addEventListener('keydown', function (e) {
            if (S.abierta && e.key === 'Escape' && document.activeElement && document.activeElement.tagName !== 'TEXTAREA') cerrarMesas();
        });
        engancharGestos();
    }

    // ── Abrir / cerrar ──
    function abrirMesas() {
        construir();
        cargarCache();
        root.classList.add('abierta');
        document.body.style.overflow = 'hidden';
        S.abierta = true;
        actualizarAdmin();
        requestAnimationFrame(function () {
            medir();
            if (!S.ajustada) { ajustarVista(); S.ajustada = true; }
            actualizarPanel();
            pedirDibujo();
        });
        cargarTextos();
    }
    window.abrirMesas = abrirMesas;

    function cerrarMesas() {
        if (!root || !S.abierta) return;
        autoguardarSiHayCambios();
        if (S.editando) alternarEdicion(false);
        root.classList.remove('abierta');
        S.abierta = false;
        var perfil = document.getElementById('pantallaPerfil');
        if (!(perfil && perfil.classList.contains('activo'))) document.body.style.overflow = '';
    }
    window.cerrarMesas = cerrarMesas;

    // Enlace público: sitio?mesas=1 abre las mesas directo
    if (/(?:^|[?&])mesas=1(?:&|$)/.test(window.location.search)) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', abrirMesas);
        else abrirMesas();
    }

    // ── Vista: tamaño del lienzo, ajuste y zoom ──
    function medir() {
        var l = $('mesasLienzo'); if (!l || !cv) return;
        var r = l.getBoundingClientRect();
        S.w = Math.max(1, r.width); S.h = Math.max(1, r.height);
        S.dpr = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.round(S.w * S.dpr);
        cv.height = Math.round(S.h * S.dpr);
    }
    function ajustarVista() {
        var bw = (AC + 2 * M) * TW;
        var yArriba = -(M + GF / 2) * TH, yAbajo = (AF + M) * TH + DEPTH + 30;
        var k = Math.min(S.w * 0.94 / bw, S.h * 0.94 / (yAbajo - yArriba));
        S.fitEscala = k; S.minEscala = k * 0.7;
        S.scale = k;
        S.ox = S.w / 2 - (AC * TW / 2) * k;   // centra el conjunto de mesas
        S.oy = S.h / 2 - (yArriba + yAbajo) / 2 * k;
    }
    function limitarVista() {
        // Evita irse al vacío: el centro de la pantalla se queda dentro de la mesa
        var xmin = -TW, xmax = AC * TW + TW, ymin = -(GF / 2 + 1) * TH, ymax = AF * TH + DEPTH + TH;
        var cx = (S.w / 2 - S.ox) / S.scale, cy = (S.h / 2 - S.oy) / S.scale;
        cx = Math.max(xmin, Math.min(xmax, cx)); cy = Math.max(ymin, Math.min(ymax, cy));
        S.ox = S.w / 2 - cx * S.scale; S.oy = S.h / 2 - cy * S.scale;
    }
    function zoomEn(sx, sy, nueva) {
        nueva = Math.max(S.minEscala, Math.min(MAX_ESCALA, nueva));
        var wx = (sx - S.ox) / S.scale, wy = (sy - S.oy) / S.scale;
        S.scale = nueva;
        S.ox = sx - wx * nueva; S.oy = sy - wy * nueva;
        limitarVista();
        pedirDibujo();
    }
    function zoomCentro(f) { cancelAnimationFrame(S.anim); zoomEn(S.w / 2, S.h / 2, S.scale * f); }

    // Transición suave de la vista (al tocar una mesa)
    function animarA(esc, ox, oy) {
        cancelAnimationFrame(S.anim);
        var e0 = S.scale, x0 = S.ox, y0 = S.oy, t0 = null, dur = 380;
        function paso(ts) {
            if (t0 === null) t0 = ts;
            var p = Math.min(1, (ts - t0) / dur); p = 1 - Math.pow(1 - p, 3);
            S.scale = e0 + (esc - e0) * p; S.ox = x0 + (ox - x0) * p; S.oy = y0 + (oy - y0) * p;
            dibujar();
            if (p < 1) S.anim = requestAnimationFrame(paso);
        }
        S.anim = requestAnimationFrame(paso);
    }
    // Espacio de abajo que tapa el texto (público) o el panel de edición (administrador)
    function reservado() { return S.editando ? 250 : 140; }
    function centrarMesa(mr, mc) {
        var xa = mc * (MC + G), ya = mr * (MF + GF);
        var pts = [proj(xa, ya - 5), proj(xa + MC, ya - 5), proj(xa + MC, ya + MF), proj(xa, ya + MF)];
        var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        pts.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1] + DEPTH); });
        var libre = Math.max(180, S.h - reservado());
        var k = Math.min(S.w * 0.92 / (x1 - x0), libre * 0.92 / (y1 - y0));
        k = Math.max(S.minEscala, Math.min(MAX_ESCALA, k));
        animarA(k, S.w / 2 - (x0 + x1) / 2 * k, libre / 2 - (y0 + y1) / 2 * k);
    }

    // ── Gestos: arrastrar, pellizcar, rueda y toque ──
    function engancharGestos() {
        var ptrs = {}, drag = null, pinch = null;
        function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
        function dosPuntos() { var ids = Object.keys(ptrs); return [ptrs[ids[0]], ptrs[ids[1]]]; }

        cv.addEventListener('pointerdown', function (e) {
            try { cv.setPointerCapture(e.pointerId); } catch (x) {}
            cancelAnimationFrame(S.anim);
            ptrs[e.pointerId] = pos(e);
            var n = Object.keys(ptrs).length;
            if (n === 1) {
                drag = { x: ptrs[e.pointerId].x, y: ptrs[e.pointerId].y, ox: S.ox, oy: S.oy, movido: false };
            } else if (n === 2) {
                drag = null;
                var p = dosPuntos();
                var mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
                pinch = { dist: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1, escala: S.scale,
                          wx: (mx - S.ox) / S.scale, wy: (my - S.oy) / S.scale };
            }
        });
        cv.addEventListener('pointermove', function (e) {
            if (!ptrs[e.pointerId]) return;
            ptrs[e.pointerId] = pos(e);
            if (pinch && Object.keys(ptrs).length >= 2) {
                var p = dosPuntos();
                var mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
                var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1;
                S.scale = Math.max(S.minEscala, Math.min(MAX_ESCALA, pinch.escala * d / pinch.dist));
                S.ox = mx - pinch.wx * S.scale; S.oy = my - pinch.wy * S.scale;
                limitarVista();
                pedirDibujo();
            } else if (drag) {
                var q = ptrs[e.pointerId];
                var dx = q.x - drag.x, dy = q.y - drag.y;
                if (!drag.movido && Math.hypot(dx, dy) > 6) drag.movido = true;
                if (drag.movido) { S.ox = drag.ox + dx; S.oy = drag.oy + dy; limitarVista(); pedirDibujo(); }
            }
        });
        function soltar(e) {
            if (!ptrs[e.pointerId]) return;
            var eraToque = drag && !drag.movido && Object.keys(ptrs).length === 1 && e.type === 'pointerup';
            var punto = ptrs[e.pointerId];
            delete ptrs[e.pointerId];
            if (eraToque) seleccionarEn(punto.x, punto.y);
            if (Object.keys(ptrs).length < 2) pinch = null;
            drag = null;
        }
        cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
        cv.addEventListener('pointerup', soltar);
        cv.addEventListener('pointercancel', soltar);
        cv.addEventListener('wheel', function (e) {
            e.preventDefault();
            cancelAnimationFrame(S.anim);
            var p = pos(e);
            zoomEn(p.x, p.y, S.scale * Math.exp(-e.deltaY * 0.0015));
        }, { passive: false });
    }

    // ── Selección de mesa ──
    // Índice de mesa a partir de una posición continua. En columnas solo cuenta la mesa misma; en filas también
    // cuenta el hueco de arriba de cada mesa (donde se escribe su texto), así que tocar el texto elige esa mesa.
    function idxCol(f) {
        if (f < 0) return -1;
        var b = MC + G, bl = Math.floor(f / b), d = f - bl * b;
        return (d < MC && bl < MESAS_C) ? bl : -1;
    }
    function idxFila(f) {
        var f2 = f + GF;
        if (f2 < 0) return -1;
        var b = MF + GF, bl = Math.floor(f2 / b);
        return bl < MESAS_F ? bl : -1;
    }
    function mesaEn(sx, sy) {
        var wx = (sx - S.ox) / S.scale, wy = (sy - S.oy) / S.scale;
        var mc = idxCol(wx / TW), mr = idxFila(wy / TH);
        return (mc >= 0 && mr >= 0) ? { mr: mr, mc: mc } : null;
    }
    function seleccionarEn(sx, sy) {
        var m = mesaEn(sx, sy);
        if (!m) { if (S.sel) deseleccionar(); return; }
        seleccionarMesa(m.mr, m.mc);
    }
    function seleccionarMesa(mr, mc) {
        if (!(S.sel && S.sel.mr === mr && S.sel.mc === mc)) autoguardarSiHayCambios();
        S.sel = { mr: mr, mc: mc };
        actualizarPanel(true);
        centrarMesa(mr, mc);
        pedirDibujo();
    }
    function deseleccionar() {
        autoguardarSiHayCambios();
        S.sel = null;
        actualizarPanel(true);
        pedirDibujo();
    }

    // ── Panel: texto de la mesa (público) y edición (administrador) ──
    function textoSel() { return S.sel ? (S.textos[clave(S.sel.mr, S.sel.mc)] || '') : ''; }
    function actualizarPanel(cambioDeMesa) {
        var cap = $('mesasCaption'), panel = $('mesasPanelAdmin');
        if (!cap || !panel) return;
        var txt = textoSel();
        // Público: el texto completo de la mesa tocada
        cap.textContent = txt;
        cap.style.display = (!S.editando && S.sel && txt) ? 'block' : 'none';
        // Administrador: panel para escribir
        panel.classList.toggle('visible', S.editando);
        if (S.editando) {
            var ta = $('mesasTexto');
            $('mesasPanelTitulo').textContent = S.sel
                ? '📝 Mesa ' + numeroMesa(S.sel.mr, S.sel.mc) + ' (fila ' + (S.sel.mr + 1) + ', columna ' + (S.sel.mc + 1) + ' de mesas)'
                : 'Toca una mesa para escribir su texto';
            ta.disabled = !S.sel;
            $('mesasGuardar').disabled = !S.sel;
            $('mesasQuitar').disabled = !S.sel || !txt;
            if (cambioDeMesa || document.activeElement !== ta) ta.value = txt;
        }
    }
    function alternarEdicion(forzar) {
        var nuevo = (typeof forzar === 'boolean') ? forzar : !S.editando;
        if (nuevo && !esAdmin()) return;
        if (!nuevo) autoguardarSiHayCambios();
        S.editando = nuevo;
        var b = $('mesasEditar');
        b.classList.toggle('activo', nuevo);
        b.textContent = nuevo ? '✅ Listo' : '✏️ Editar';
        estado('');
        actualizarPanel(true);
        if (S.sel) centrarMesa(S.sel.mr, S.sel.mc);
        pedirDibujo();
    }
    function estado(txt, error) {
        var e = $('mesasEstado'); if (!e) return;
        e.textContent = txt || ''; e.className = 'mesas-estado' + (error ? ' error' : '');
    }
    function hayCambios() {
        if (!S.editando || !S.sel) return false;
        return $('mesasTexto').value.replace(/\r/g, '').trim().slice(0, MAX_TEXTO) !== textoSel();
    }
    function autoguardarSiHayCambios() {
        if (hayCambios()) enviar(S.sel.mr, S.sel.mc, $('mesasTexto').value, true);
    }

    // ── Guardar (solo administradores; el servidor lo vuelve a comprobar con el token) ──
    function enviar(mr, mc, texto, silencioso) {
        texto = String(texto || '').replace(/\r/g, '').trim().slice(0, MAX_TEXTO);
        // En cola: si se cambia de mesa mientras se guarda, no se pisan entre sí
        S.cola = S.cola.then(function () { return enviarYa(mr, mc, texto, silencioso); });
        return S.cola;
    }
    function enviarYa(mr, mc, texto, silencioso) {
        var user = (typeof auth !== 'undefined') ? auth.currentUser : null;
        if (!esAdmin() || !user) { estado('Solo los administradores pueden editar.', true); return Promise.resolve(false); }
        estado('Guardando…');
        return user.getIdToken(true).then(function (tok) {
            return fetch(endpoint(), {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ idToken: tok, accion: 'mesaTexto', mr: mr, mc: mc, texto: texto })
            });
        }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d.ok) throw new Error(d.error || 'Error del servidor');
            var k = clave(mr, mc);
            if (texto) S.textos[k] = texto; else delete S.textos[k];
            S.recientes[k] = { t: texto, ts: Date.now() };   // la hoja tarda unos minutos en reflejarlo por CSV
            guardarCache();
            estado('✅ Guardado.');
            if (!silencioso && typeof mostrarToast === 'function') mostrarToast('✅ Texto de la mesa guardado');
            actualizarPanel(false);
            pedirDibujo();
            return true;
        }).catch(function (e) {
            var m = String((e && e.message) || e);
            if (/Falta el nombre/i.test(m)) m = 'el Apps Script todavía no tiene la acción de mesas: pega el codigp.gs nuevo y publícalo otra vez.';
            estado('No se pudo guardar: ' + m, true);
            return false;
        });
    }

    // ── Leer los textos (público): pestaña «Mesas» de la hoja, como CSV ──
    function parseCSV(t) {
        var rows = [], row = [], cur = '', q = false, i, c;
        for (i = 0; i < t.length; i++) {
            c = t.charAt(i);
            if (q) {
                if (c === '"') { if (t.charAt(i + 1) === '"') { cur += '"'; i++; } else q = false; }
                else cur += c;
            } else if (c === '"') q = true;
            else if (c === ',') { row.push(cur); cur = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && t.charAt(i + 1) === '\n') i++;
                row.push(cur); cur = ''; rows.push(row); row = [];
            } else cur += c;
        }
        if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
        return rows;
    }
    function cargarTextos() {
        var id = window.SHEET_ID || SHEET_ID_RESPALDO;
        var url = 'https://docs.google.com/spreadsheets/d/' + id + '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(HOJA) + '&_=' + Date.now();
        return fetch(url).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.text();
        }).then(function (t) {
            var rows = parseCSV(t), h = -1, i;
            for (i = 0; i < Math.min(rows.length, 3); i++) {
                if (rows[i].map(norm).indexOf('fila de mesas') !== -1) { h = i; break; }
            }
            if (h < 0) return;   // la pestaña «Mesas» todavía no existe: no hay textos que mostrar
            var cab = rows[h].map(norm);
            var iF = cab.indexOf('fila de mesas'), iC = cab.indexOf('columna de mesas'), iD = cab.indexOf('descripcion');
            if (iC < 0 || iD < 0) return;
            var nuevo = {};
            for (i = h + 1; i < rows.length; i++) {
                var mr = parseInt(rows[i][iF], 10) - 1, mc = parseInt(rows[i][iC], 10) - 1;
                var txt = String(rows[i][iD] || '').replace(/\r/g, '').trim();
                if (mr >= 0 && mr < MESAS_F && mc >= 0 && mc < MESAS_C && txt) nuevo[clave(mr, mc)] = txt.slice(0, MAX_TEXTO);
            }
            // Lo que un administrador guardó hace pocos minutos manda sobre la lectura (el CSV puede ir atrasado)
            Object.keys(S.recientes).forEach(function (k) {
                var rc = S.recientes[k];
                if (Date.now() - rc.ts > 5 * 60 * 1000) { delete S.recientes[k]; return; }
                if (rc.t) nuevo[k] = rc.t; else delete nuevo[k];
            });
            S.textos = nuevo;
            guardarCache();
            if (!hayCambios()) actualizarPanel(true);
            pedirDibujo();
        }).catch(function (e) { console.warn('[mesas] no se pudieron leer los textos:', e); });
    }
    function cargarCache() {
        try {
            var o = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
            if (o && typeof o === 'object' && !Object.keys(S.textos).length) S.textos = o;
        } catch (e) { /* sin copia guardada */ }
    }
    function guardarCache() {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(S.textos)); } catch (e) { /* sin almacenamiento */ }
    }

    // ── Dibujo ──
    function pedirDibujo() {
        if (S.abierta && !S.raf) S.raf = requestAnimationFrame(dibujar);
    }
    function poli(ctx, pts, relleno) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = relleno; ctx.fill();
    }
    function dibujar() {
        S.raf = 0;
        if (!S.abierta || !cv) return;
        var ctx = cv.getContext('2d'), k = S.scale;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.setTransform(S.dpr * k, 0, 0, S.dpr * k, S.dpr * S.ox, S.dpr * S.oy);
        dibujarMesas(ctx, k);
        dibujarRejilla(ctx, k);
        dibujarTextos(ctx, k);
    }
    // Cada mesa chica es su propia tabla, con su marco, separada de las demás por un hueco oscuro
    function dibujarMesas(ctx, k) {
        for (var mr = 0; mr < MESAS_F; mr++) {
            for (var mc = 0; mc < MESAS_C; mc++) {
                var sel = !!(S.sel && S.sel.mr === mr && S.sel.mc === mc);
                var x0 = mc * (MC + G), x1 = x0 + MC, y0 = mr * (MF + GF), y1 = y0 + MF;
                var A = proj(x0, y0), B = proj(x1, y0), C = proj(x1, y1), D = proj(x0, y1);
                // sombra suave que cae hacia abajo, para que la mesa «se despegue» del fondo
                poli(ctx, [[D[0] - 6, D[1] + DEPTH * 0.4], [C[0] + 6, C[1] + DEPTH * 0.4], [C[0] + 14, C[1] + DEPTH + 14], [D[0] - 14, D[1] + DEPTH + 14]], 'rgba(0,0,0,0.38)');
                // frente de la mesa (el grosor): degradado de madera oscura
                var gr = ctx.createLinearGradient(0, D[1], 0, D[1] + DEPTH);
                gr.addColorStop(0, sel ? '#4a3322' : '#3a2819'); gr.addColorStop(1, '#0a0705');
                poli(ctx, [D, C, [C[0], C[1] + DEPTH], [D[0], D[1] + DEPTH]], gr);
                poli(ctx, [A, B, C, D], sel ? '#2a1d14' : '#1a130e');                              // cara superior
                ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(C[0], C[1]); ctx.lineTo(D[0], D[1]); ctx.closePath();
                ctx.strokeStyle = sel ? '#f5c46b' : 'rgba(245,196,107,0.65)';
                ctx.lineWidth = Math.max((sel ? 3.6 : 2.4) / k, sel ? 2.2 : 1.6); ctx.lineJoin = 'round'; ctx.stroke();   // marco
            }
        }
    }
    // Rejilla fina dentro de cada mesa (el marco ya lo dibuja dibujarMesas)
    function dibujarRejilla(ctx, k) {
        if (TW * k < 8) return;   // muy alejado: solo se ven los marcos
        ctx.beginPath();
        for (var mr = 0; mr < MESAS_F; mr++) {
            for (var mc = 0; mc < MESAS_C; mc++) {
                var x0 = mc * (MC + G), y0 = mr * (MF + GF), i, a, b;
                for (i = 1; i < MC; i++) { a = proj(x0 + i, y0); b = proj(x0 + i, y0 + MF); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
                for (i = 1; i < MF; i++) { a = proj(x0, y0 + i); b = proj(x0 + MC, y0 + i); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
            }
        }
        ctx.strokeStyle = 'rgba(255,240,220,0.09)'; ctx.lineWidth = 1 / k; ctx.stroke();
    }
    // Parte un texto en máximo "maxLineas" renglones que quepan en "ancho" (con la fuente ya puesta en ctx); agrega … si se corta
    function partirTexto(ctx, texto, ancho, maxLineas) {
        var palabras = String(texto).replace(/\s+/g, ' ').trim().split(' '), lineas = [], actual = '';
        for (var i = 0; i < palabras.length; i++) {
            var prueba = actual ? actual + ' ' + palabras[i] : palabras[i];
            if (ctx.measureText(prueba).width <= ancho || !actual) actual = prueba;
            else { lineas.push(actual); actual = palabras[i]; if (lineas.length === maxLineas) break; }
        }
        if (lineas.length < maxLineas && actual) lineas.push(actual);
        var cortado = lineas.join(' ').length < palabras.join(' ').length;
        var ult = lineas.length - 1;
        if (ult >= 0 && (cortado || ctx.measureText(lineas[ult]).width > ancho)) {
            var t = lineas[ult];
            while (t.length > 1 && ctx.measureText(t + '…').width > ancho) t = t.slice(0, -1);
            lineas[ult] = t.replace(/\s+$/, '') + '…';
        }
        return lineas;
    }
    // El texto de cada mesa se escribe «pintado en el piso», en el hueco de arriba, pegado a su mesa, dentro de un
    // recuadro dorado delgado que sale del borde de la mesa (comparte con ella el lado de abajo y el mismo ancho)
    function dibujarTextos(ctx, k) {
        if (TW * k < 5) return;   // muy alejado: sería ilegible
        var tam = 125, lh = 145, pad = 50;   // letra de 1.25 celdas de alto; renglón de 1.45; margen del recuadro (en 1/100 de celda)
        ctx.save();
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        for (var mr = 0; mr < MESAS_F; mr++) {
            for (var mc = 0; mc < MESAS_C; mc++) {
                var texto = S.textos[clave(mr, mc)], vacio = false;
                if (!texto) {
                    // Al editar, las mesas sin texto muestran una pista tenue
                    if (!(S.editando && TW * k >= 9)) continue;
                    texto = 'Mesa ' + numeroMesa(mr, mc) + ' · toca para escribir'; vacio = true;
                }
                var xa = mc * (MC + G), ya = mr * (MF + GF);
                var o = proj(xa, ya), alto;
                ctx.fillStyle = vacio ? 'rgba(255,243,220,0.35)' : '#fff3dc';
                ctx.save();
                ctx.transform(TW, 0, 0, TH, o[0], o[1]);   // el plano del piso: 1 unidad = 1 celda (la letra se acorta con la inclinación)
                ctx.scale(0.01, 0.01);                                       // ahora 1 unidad = 1/100 de celda
                ctx.font = '600 ' + tam + 'px "Playfair Display", Georgia, serif';
                var lineas = partirTexto(ctx, texto, MC * 100 - 60, 3);
                alto = lineas.length * lh + pad;                              // alto del recuadro, en 1/100 de celda
                lineas.forEach(function (ln, i) { ctx.fillText(ln, MC * 50, -alto / 2 - (lineas.length - 1) * lh / 2 + i * lh + tam * 0.35); });
                ctx.restore();
                // Recuadro: tres lados (izquierdo, de arriba y derecho); el cuarto es el borde de la mesa
                var h = alto / 100;
                var D = proj(xa, ya), A = proj(xa, ya - h), B = proj(xa + MC, ya - h), C = proj(xa + MC, ya);
                ctx.beginPath(); ctx.moveTo(D[0], D[1]); ctx.lineTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(C[0], C[1]);
                ctx.strokeStyle = vacio ? 'rgba(245,196,107,0.30)' : 'rgba(245,196,107,0.75)';
                ctx.lineWidth = Math.max(1.5 / k, 0.8); ctx.lineJoin = 'miter'; ctx.stroke();
            }
        }
        ctx.restore();
    }
})();
