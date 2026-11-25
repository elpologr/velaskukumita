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
    var PERSP = 0.3;             // perspectiva: cuánto se encoge el borde del fondo respecto al de enfrente (0 = plano; 0.3 = 30% más angosto; 0.45 = muy marcado)
    var CAIDA = 1500;            // qué tanto «se cierran» hacia el centro los cantos verticales del grosor (más alto = menos efecto)
    var MAX_ESCALA = 4;
    var MAX_TEXTO = 500;         // máximo de letras por mesa (el servidor lo vuelve a limitar)
    var CACHE_KEY = 'velas_mesas_textos_v1';
    var HOJA = 'Mesas';
    var SHEET_ID_RESPALDO = '1jin2wMYingvbPD2csGxIbm5AhulfRvCRvIzAKJTUNMw';
    var ENDPOINT_RESPALDO = 'https://script.google.com/macros/s/AKfycbyDp6hVMXjv8pNpbpmadzilQN-pOC2jitBiV1bn6meNdDteKEw-814ZvicOPYmxdTcH/exec';
    var AC = NC + (MESAS_C - 1) * G, AF = NF + (MESAS_F - 1) * GF;   // medidas totales con huecos
    var CX = AC * TW / 2;                                // eje central (vista de frente: el punto de fuga está en el centro)
    var ZMAX = AF * TH;                                  // profundidad total del piso
    var Q = (1 / (1 - PERSP) - 1) / ZMAX;                // fuerza de la perspectiva

    var S = {
        textos: {}, recientes: {}, sel: null, editando: false, cola: Promise.resolve(),
        scale: 0.05, ox: 0, oy: 0, w: 0, h: 0, dpr: 1, minEscala: 0.03, fitEscala: 0.05,
        raf: 0, anim: 0, abierta: false, ajustada: false
    };
    var root = null, cv = null;

    function $(id) { return document.getElementById(id); }
    // Perspectiva de frente con cámara inclinada: las filas siguen horizontales y las columnas verticales se van
    // cerrando hacia el fondo (la fila 0 está lejos, la última está más cerca de la cámara).
    function profundo(r) { return (AF - r) * TH; }                    // distancia al borde de enfrente
    function esc(r) { return 1 / (1 + Q * profundo(r)); }             // escala en esa fila (1 = enfrente, menor = lejos)
    function proj(c, r) {
        var Z = profundo(r), s = 1 / (1 + Q * Z);
        return [CX + (c * TW - CX) * s, ZMAX - Z * s];
    }
    // Inversa de proj: de un punto del plano proyectado (wx, wy) a [columna, fila] continuas (o null si pasa del horizonte)
    function invProj(wx, wy) {
        var Zs = ZMAX - wy, d = 1 - Q * Zs;
        if (d <= 0.001) return null;
        var Z = Zs / d, s = 1 / (1 + Q * Z);
        return [(CX + (wx - CX) / s) / TW, AF - Z / TH];
    }
    // Baja un punto del tablero «t» hacia abajo; el canto se inclina hacia el centro, así se asoma el lateral de las mesas de los lados
    function baja(P, t) { var f = 1 - t / CAIDA; return [CX + (P[0] - CX) * f, P[1] + t]; }
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
        catRender();
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
                '<button class="mesas-cat-btn" type="button" id="mesasCatBtn" aria-label="Abrir catálogo">📋 Catálogo</button>' +
                '<aside class="mesas-cat" id="mesasCat" aria-label="Catálogo">' +
                    '<div class="mesas-cat-head">' +
                        '<button type="button" class="mesas-cat-atras" id="mesasCatAtras" aria-label="Volver a las colecciones">‹</button>' +
                        '<div class="mesas-cat-titulo" id="mesasCatTitulo">Catálogo</div>' +
                        '<button type="button" class="mesas-cat-cerrar" id="mesasCatCerrar" aria-label="Cerrar catálogo">✕</button>' +
                    '</div>' +
                    '<div class="mesas-cat-admin" id="mesasCatAdmin">' +
                        '<button type="button" id="mesasCatAgregar">＋ Agregar producto</button>' +
                        '<span>Las colecciones salen de las etiquetas de cada producto. Toca ✏️ para cambiarlas.</span>' +
                    '</div>' +
                    '<div class="mesas-cat-cuerpo" id="mesasCatCuerpo"></div>' +
                '</aside>' +
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
        catEnganchar();
    }

    // ── Abrir / cerrar ──
    function abrirMesas() {
        construir();
        cargarCache();
        root.classList.add('abierta');
        document.body.style.overflow = 'hidden';
        document.body.classList.add('mesas-abierta');   // sube los paneles de edición por encima de las mesas (ver mesas.css)
        S.abierta = true;
        actualizarAdmin();
        catRender();
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
        document.body.classList.remove('mesas-abierta');
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
        var yArriba = proj(0, -(M + GF / 2))[1], yAbajo = proj(0, AF + M)[1] + DEPTH + 30;
        var k = Math.min(S.w * 0.94 / bw, S.h * 0.94 / (yAbajo - yArriba));
        S.fitEscala = k; S.minEscala = k * 0.7;
        S.scale = k;
        S.ox = S.w / 2 - (AC * TW / 2) * k;   // centra el conjunto de mesas
        S.oy = S.h / 2 - (yArriba + yAbajo) / 2 * k;
    }
    function limitarVista() {
        // Evita irse al vacío: el centro de la pantalla se queda dentro de la mesa
        var xmin = -TW, xmax = AC * TW + TW, ymin = proj(0, -(GF / 2 + 1))[1], ymax = proj(0, AF)[1] + DEPTH + TH;
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
        var f = invProj(wx, wy); if (!f) return null;
        var mc = idxCol(f[0]), mr = idxFila(f[1]);
        return (mc >= 0 && mr >= 0) ? { mr: mr, mc: mc } : null;
    }
    function seleccionarEn(sx, sy) {
        var m = mesaEn(sx, sy);
        if (!m) { if (S.sel) deseleccionar(); return; }
        if (!S.editando) {   // si la pieza ya se ve lo bastante grande, se abre el producto; si no, primero se acerca la mesa
            var pz = piezaEn(sx, sy, m.mr, m.mc);
            if (pz && pz.w * S.scale >= 48) { catAbrirProducto(pz.p); return; }
        }
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
            PZ.textos = null;   // el nombre de la mesa cambió: se vuelven a repartir los productos
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

    // ── Barra lateral de catálogo (estilo catálogo de WhatsApp) ──
    // Las colecciones NO se guardan aparte: salen de las etiquetas que ya tiene cada producto en la hoja
    // (EtiquetaEvento → Religioso, Día de Muertos, Navidad…; EtiquetaPrincipal → Centro de Mesa, Decoraciones…).
    // Para meter o sacar un producto de una colección, el administrador cambia sus etiquetas (botón ✏️ de cada fila).
    var CAT_VISTA_PREVIA = 3;                       // cuántos productos se ven de primeras en cada colección
    var CAT_EXCLUIR_TIPOS = ['etiqueta', 'etiquetas'];   // igual que en «Mostrar Todo» del sitio: las etiquetas no entran
    var CAT = { abierta: false, vista: null };      // vista: null = lista de colecciones; o la clave de una colección ('todos' = Todos los artículos)

    function h(tag, cls, txt) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (txt != null) e.textContent = txt;
        return e;
    }
    function catProductos() {
        var lista = (typeof listaProductos !== 'undefined' && listaProductos) ? listaProductos : [];
        return lista.filter(function (p) {
            return !(p.tipos || []).some(function (t) { return CAT_EXCLUIR_TIPOS.indexOf(String(t).trim().toLowerCase()) !== -1; });
        });
    }
    function catBonito(v) { v = String(v).replace(/-/g, ' ').trim(); return v.charAt(0).toUpperCase() + v.slice(1); }
    // Nombre con emoji tal como aparece en el panel de agregar producto; si no existe ahí, se arma a partir de la etiqueta
    function catNombre(tipo, valor) {
        var chks = document.querySelectorAll(tipo === 'e' ? '.chk-evento-producto' : '.chk-etiqueta-principal-producto');
        for (var i = 0; i < chks.length; i++) {
            if (String(chks[i].value).trim().toLowerCase() === valor) {
                var sp = chks[i].parentNode && chks[i].parentNode.querySelector('span');
                if (sp && sp.textContent.trim()) return sp.textContent.trim();
            }
        }
        return catBonito(valor);
    }
    function catColecciones(prods) {
        var mapa = {}, orden = [];
        function meter(clave, tipo, valor, p) {
            if (!mapa[clave]) { mapa[clave] = { clave: clave, tipo: tipo, valor: valor, items: [] }; orden.push(clave); }
            mapa[clave].items.push(p);
        }
        prods.forEach(function (p) {
            (p.eventos || '').split('|').forEach(function (e) { e = e.trim().toLowerCase(); if (e) meter('e:' + e, 'e', e, p); });
            (p.tipos || []).forEach(function (t) { t = String(t).trim().toLowerCase(); if (t) meter('t:' + t, 't', t, p); });
        });
        var cols = orden.map(function (k) { var c = mapa[k]; c.nombre = catNombre(c.tipo, c.valor); return c; });
        cols.sort(function (a, b) { return b.items.length - a.items.length; });   // las colecciones con más productos primero
        return cols;
    }
    function catTarjeta(p) { return document.querySelector('#gridProductos [data-num=\"' + p.id + '\"]'); }
    function catAbrirProducto(p) {
        var card = catTarjeta(p);
        if (card) card.click();   // reutiliza el mismo modal de producto del catálogo (se abre por encima de las mesas)
        else if (typeof mostrarToast === 'function') mostrarToast('No se encontró el producto');
    }
    function catEditarProducto(p) {
        var card = catTarjeta(p);
        if (card && typeof abrirEdicionProducto === 'function') abrirEdicionProducto(card);
    }
    function catPrecio(p) {
        var normal = parseFloat(p.precioNormal) || 0, oferta = parseFloat(p.precioOferta) || 0;
        var caja = h('div', 'mesas-cat-precio');
        if (p.oferta && oferta > 0) {
            caja.appendChild(h('span', '', '$' + Math.round(oferta)));
            if (normal > 0) caja.appendChild(h('s', '', '$' + Math.round(normal)));
        } else if (normal > 0) {
            caja.textContent = '$' + Math.round(normal);
        }
        return caja;
    }
    function catFila(p, admin) {
        var fila = h('div', 'mesas-cat-item');
        fila.setAttribute('role', 'button'); fila.tabIndex = 0;
        var im = document.createElement('img');
        im.loading = 'lazy'; im.alt = p.nombre || ''; im.src = p.imagen || '';
        im.onerror = function () { this.style.visibility = 'hidden'; };
        var info = h('div', 'mesas-cat-info');
        info.appendChild(h('div', 'mesas-cat-nombre', p.nombre));
        info.appendChild(catPrecio(p));
        fila.appendChild(im); fila.appendChild(info);
        if (admin) {
            var ed = h('button', 'mesas-cat-editar', '✏️');
            ed.type = 'button'; ed.setAttribute('aria-label', 'Editar producto');
            ed.addEventListener('click', function (e) { e.stopPropagation(); catEditarProducto(p); });
            fila.appendChild(ed);
        }
        fila.addEventListener('click', function () { catAbrirProducto(p); });
        fila.addEventListener('keydown', function (e) { if (e.key === 'Enter') catAbrirProducto(p); });
        return fila;
    }
    function catSeccion(titulo, items, admin, verTodo) {
        var sec = h('section', 'mesas-cat-seccion');
        var cab = h('div', 'mesas-cat-seccion-cab');
        cab.appendChild(h('h4', '', titulo));
        if (verTodo) {
            var b = h('button', 'mesas-cat-mostrar', 'Mostrar todo');
            b.type = 'button';
            b.addEventListener('click', verTodo);
            cab.appendChild(b);
        }
        sec.appendChild(cab);
        items.forEach(function (p) { sec.appendChild(catFila(p, admin)); });
        return sec;
    }
    function catIrA(vista) {
        CAT.vista = vista;
        catRender();
        var c = $('mesasCatCuerpo'); if (c) c.scrollTop = 0;
    }
    function catRender() {
        var cont = $('mesasCatCuerpo'); if (!cont) return;
        var admin = esAdmin(), prods = catProductos();
        var zAdmin = $('mesasCatAdmin'); if (zAdmin) zAdmin.style.display = admin ? 'flex' : 'none';
        cont.innerHTML = '';
        if (!prods.length) {
            $('mesasCatTitulo').textContent = 'Catálogo';
            $('mesasCatAtras').style.display = 'none';
            cont.appendChild(h('div', 'mesas-cat-vacio', 'Cargando catálogo…'));
            return;
        }
        var cols = catColecciones(prods), actual = null;
        if (CAT.vista && CAT.vista !== 'todos') {
            cols.forEach(function (c) { if (c.clave === CAT.vista) actual = c; });
            if (!actual) CAT.vista = null;   // esa colección ya no existe (por ejemplo, se cambiaron las etiquetas)
        }
        $('mesasCatAtras').style.display = CAT.vista ? 'block' : 'none';
        if (CAT.vista === 'todos') {
            $('mesasCatTitulo').textContent = 'Todos los artículos';
            cont.appendChild(catSeccion('Todos los artículos', prods, admin, null));
        } else if (actual) {
            $('mesasCatTitulo').textContent = actual.nombre;
            cont.appendChild(catSeccion(actual.nombre, actual.items, admin, null));
        } else {
            $('mesasCatTitulo').textContent = 'Catálogo';
            cols.forEach(function (c) {
                var mas = c.items.length > CAT_VISTA_PREVIA ? function () { catIrA(c.clave); } : null;
                cont.appendChild(catSeccion(c.nombre, c.items.slice(0, CAT_VISTA_PREVIA), admin, mas));
            });
            cont.appendChild(catSeccion('Todos los artículos', prods, admin, null));   // esta sí muestra todo
        }
    }
    function catAlternar(forzar) {
        CAT.abierta = (typeof forzar === 'boolean') ? forzar : !CAT.abierta;
        $('mesasCat').classList.toggle('abierta', CAT.abierta);
        $('mesasCatBtn').style.display = CAT.abierta ? 'none' : 'block';
        if (CAT.abierta) catRender();
    }
    function catEnganchar() {
        $('mesasCatBtn').addEventListener('click', function () { catAlternar(true); });
        $('mesasCatCerrar').addEventListener('click', function () { catAlternar(false); });
        $('mesasCatAtras').addEventListener('click', function () { catIrA(null); });
        $('mesasCatAgregar').addEventListener('click', function () {
            if (typeof abrirPantallaAdminProductos === 'function') abrirPantallaAdminProductos();
        });
        document.addEventListener('catalogoCargado', function () { catRender(); pedirDibujo(); });   // cuando la hoja termina de cargar o se recarga
    }

    // ── Productos sobre las mesas ──
    // Cada mesa se vincula con sus productos por el NOMBRE que tiene (el texto de la mesa):
    //   · «$50 Pesos» (empieza con un precio) → todos los productos cuyo precio es exactamente $50
    //   · «Más Vendido»                      → los productos marcados como más vendidos
    //   · «Centros de Mesa»                  → los productos con la etiqueta principal Centro de Mesa
    // Si una mesa 39 o 40 todavía no tiene texto, se asumen Centros de Mesa y Más Vendido respectivamente.
    // Como se calcula con la lista de productos, un producto nuevo (o con otro precio) cambia de mesa solo.
    var PZ = { textos: null, lista: null, mapa: {} };
    var PZ_DISPOSICIONES = [[5, 3], [6, 4], [8, 5]];   // [columnas, filas] de piezas por mesa, según cuántos productos haya (máx. 40)
    var PZ_ANCHO = 0.8;                                 // ancho de cada pieza respecto a su espacio (1 = ocupa todo)
    var PZ_IMG = {};

    function reglaMesa(mr, mc) {
        var crudo = String(S.textos[clave(mr, mc)] || '').trim(), t = norm(crudo), n = numeroMesa(mr, mc);
        var m = /^\$\s*(\d+(?:\.\d+)?)/.exec(crudo) || /^(\d+(?:\.\d+)?)\s*pesos/i.exec(crudo);
        if (m) return { tipo: 'precio', valor: parseFloat(m[1]) };
        if (/vendido/.test(t)) return { tipo: 'vendido' };
        if (/centros? de mesa/.test(t)) return { tipo: 'centros' };
        if (!t && n === 39) return { tipo: 'centros' };
        if (!t && n === 40) return { tipo: 'vendido' };
        return null;
    }
    function pzEsCentros(p) { return (p.tipos || []).some(function (t) { return /centros?[ -]de[ -]mesa/.test(norm(t)); }); }
    function pzEsVendido(p) { return !!p.masVendido || (p.tipos || []).some(function (t) { return /vendido/.test(norm(t)); }); }
    function pzIndexar() {
        var lista = (typeof listaProductos !== 'undefined') ? listaProductos : null;
        if (PZ.textos === S.textos && PZ.lista === lista) return;   // nada cambió desde la última vez
        PZ.textos = S.textos; PZ.lista = lista; PZ.mapa = {};
        var prods = catProductos();
        for (var mr = 0; mr < MESAS_F; mr++) {
            for (var mc = 0; mc < MESAS_C; mc++) {
                var r = reglaMesa(mr, mc); if (!r) continue;
                var arr = prods.filter(function (p) {
                    if (r.tipo === 'precio') return Math.abs((parseFloat(p.precioNormal) || 0) - r.valor) < 0.001;
                    return r.tipo === 'vendido' ? pzEsVendido(p) : pzEsCentros(p);
                });
                if (arr.length) PZ.mapa[clave(mr, mc)] = arr;
            }
        }
    }
    // Posición de cada pieza sobre la mesa (en coordenadas de la vista): x = centro, y = donde se apoya, w = ancho (y alto)
    function piezasMesa(mr, mc) {
        pzIndexar();
        var lst = PZ.mapa[clave(mr, mc)]; if (!lst) return [];
        var n = lst.length, L = PZ_DISPOSICIONES[PZ_DISPOSICIONES.length - 1], i;
        for (i = 0; i < PZ_DISPOSICIONES.length; i++) { if (PZ_DISPOSICIONES[i][0] * PZ_DISPOSICIONES[i][1] >= n) { L = PZ_DISPOSICIONES[i]; break; } }
        var cols = L[0], filas = L[1], cap = cols * filas, extra = n > cap ? n - cap + 1 : 0;
        var mostrar = extra ? cap - 1 : n, out = [];
        var x0 = mc * (MC + G), y0 = mr * (MF + GF);
        for (i = 0; i < (extra ? cap : n); i++) {
            var cx = x0 + (i % cols + 0.5) * (MC / cols), fy = y0 + (Math.floor(i / cols) + 1) * (MF / filas) - 0.3;
            var P = proj(cx, fy);
            out.push({ p: i < mostrar ? lst[i] : null, mas: i < mostrar ? 0 : extra, x: P[0], y: P[1], w: PZ_ANCHO * (MC / cols) * TW * esc(fy) });
        }
        return out;
    }
    function piezaEn(sx, sy, mr, mc) {
        var wx = (sx - S.ox) / S.scale, wy = (sy - S.oy) / S.scale, lst = piezasMesa(mr, mc);
        for (var i = lst.length - 1; i >= 0; i--) {   // de adelante hacia atrás
            var it = lst[i];
            if (it.p && Math.abs(wx - it.x) <= it.w / 2 && wy <= it.y && wy >= it.y - it.w) return it;
        }
        return null;
    }
    function imagenPieza(url) {
        if (!url) return null;
        var e = PZ_IMG[url];
        if (!e) {
            e = PZ_IMG[url] = { img: new Image(), ok: false };
            e.img.onload = function () { e.ok = true; pedirDibujo(); };
            e.img.src = url;   // solo se pide cuando la pieza se ve lo bastante grande en pantalla
        }
        return e.ok ? e.img : null;
    }
    function dibujarPiezas(ctx, k) {
        if (TW * k < 4) return;   // muy alejado: solo se ven las mesas
        var vx0 = -S.ox / k, vx1 = (S.w - S.ox) / k, vy0 = -S.oy / k, vy1 = (S.h - S.oy) / k;
        for (var mr = 0; mr < MESAS_F; mr++) {
            for (var mc = 0; mc < MESAS_C; mc++) {
                var x0 = mc * (MC + G), y0 = mr * (MF + GF);
                var A = proj(x0, y0), B = proj(x0 + MC, y0), D = proj(x0, y0 + MF), C = proj(x0 + MC, y0 + MF);
                if (Math.max(B[0], C[0]) < vx0 - 200 || Math.min(A[0], D[0]) > vx1 + 200 || D[1] + 80 < vy0 || A[1] - 200 > vy1) continue;   // fuera de pantalla
                piezasMesa(mr, mc).forEach(function (it) {
                    var w = it.w, sw = w * k, bx = it.x - w / 2, by = it.y - w;
                    ctx.fillStyle = 'rgba(0,0,0,0.35)';
                    ctx.beginPath(); ctx.ellipse(it.x, it.y, w * 0.46, w * 0.08, 0, 0, 2 * Math.PI); ctx.fill();   // sombra en la mesa
                    if (!it.p) {   // cuando hay más productos de los que caben: ficha «+N»
                        ctx.fillStyle = '#3a2819'; ctx.fillRect(bx, by, w, w);
                        ctx.fillStyle = '#f5c46b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.font = '700 ' + (w * 0.36) + 'px "Segoe UI", system-ui, sans-serif';
                        ctx.fillText('+' + it.mas, it.x, by + w / 2);
                    } else {
                        var img = sw >= 22 ? imagenPieza(it.p.imagen) : null;
                        if (img && img.naturalWidth) {
                            var lado = Math.min(img.naturalWidth, img.naturalHeight);
                            ctx.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, bx, by, w, w);
                        } else { ctx.fillStyle = '#3a2819'; ctx.fillRect(bx, by, w, w); }
                        var precio = (it.p.oferta && parseFloat(it.p.precioOferta) > 0) ? it.p.precioOferta : it.p.precioNormal;
                        if (sw >= 60 && parseFloat(precio) > 0) {   // etiqueta con el precio, solo cuando ya se lee
                            ctx.fillStyle = 'rgba(14,9,6,0.78)'; ctx.fillRect(bx, it.y - w * 0.2, w, w * 0.2);
                            ctx.fillStyle = '#fff3dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                            ctx.font = '700 ' + (w * 0.13) + 'px "Segoe UI", system-ui, sans-serif';
                            ctx.fillText('$' + Math.round(parseFloat(precio)), it.x, it.y - w * 0.1);
                        }
                    }
                    ctx.strokeStyle = 'rgba(245,196,107,0.85)'; ctx.lineWidth = Math.max(1.5 / k, 1); ctx.lineJoin = 'miter';
                    ctx.strokeRect(bx, by, w, w);
                });
            }
        }
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
        dibujarPiezas(ctx, k);
        dibujarTextos(ctx, k);
    }
    // Cada mesa chica es su propia tabla, con su marco, separada de las demás por un hueco oscuro
    function dibujarMesas(ctx, k) {
        for (var mr = 0; mr < MESAS_F; mr++) {
            for (var mc = 0; mc < MESAS_C; mc++) {
                var sel = !!(S.sel && S.sel.mr === mr && S.sel.mc === mc);
                var x0 = mc * (MC + G), x1 = x0 + MC, y0 = mr * (MF + GF), y1 = y0 + MF;
                var A = proj(x0, y0), B = proj(x1, y0), C = proj(x1, y1), D = proj(x0, y1);
                var tF = DEPTH * esc(y1), tA = DEPTH * esc(y0);   // el grosor también se acorta con la distancia
                // sombra suave que cae hacia abajo, para que la mesa «se despegue» del fondo
                poli(ctx, [[D[0] - 6, D[1] + tF * 0.4], [C[0] + 6, C[1] + tF * 0.4], [C[0] + 14, C[1] + tF + 14], [D[0] - 14, D[1] + tF + 14]], 'rgba(0,0,0,0.38)');
                // lateral que se asoma (la cara hacia el centro de la pantalla no se ve; se ve la de afuera)
                var BD = baja(D, tF), BC = baja(C, tF), BA = baja(A, tA), BB = baja(B, tA);
                if (CX > (A[0] + B[0] + C[0] + D[0]) / 4) poli(ctx, [B, C, BC, BB], sel ? '#33241a' : '#241a12');   // mesa a la izquierda del centro: se asoma su lado derecho; a la derecha: el izquierdo
                else poli(ctx, [A, D, BD, BA], sel ? '#33241a' : '#241a12');
                // frente de la mesa (el grosor): degradado de madera oscura
                var gr = ctx.createLinearGradient(0, D[1], 0, D[1] + tF);
                gr.addColorStop(0, sel ? '#4a3322' : '#3a2819'); gr.addColorStop(1, '#0a0705');
                poli(ctx, [D, C, BC, BD], gr);
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
                var alto;
                ctx.fillStyle = vacio ? 'rgba(255,243,220,0.35)' : '#fff3dc';
                ctx.font = '600 ' + tam + 'px "Playfair Display", Georgia, serif';
                var lineas = partirTexto(ctx, texto, MC * 100 - 60, 3);
                alto = lineas.length * lh + pad;                              // alto del recuadro, en 1/100 de celda
                // El plano del piso en el centro del recuadro: 1 unidad = 1 celda (ancho y alto se acortan con la inclinación y la distancia)
                var rc = ya - alto / 200, sc = esc(rc), o = proj(xa + MC / 2, rc);
                ctx.save();
                ctx.transform(TW * sc, 0, 0, TH * sc * sc, o[0], o[1]);
                ctx.scale(0.01, 0.01);                                       // ahora 1 unidad = 1/100 de celda
                lineas.forEach(function (ln, i) { ctx.fillText(ln, 0, -(lineas.length - 1) * lh / 2 + i * lh + tam * 0.35); });
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
