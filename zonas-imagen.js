// ══════════════════════════════════════════════════════════════════════════════
// VELAS KUKÚMITA — Recuadros anclados sobre la imagen del producto
// Se carga DESPUÉS de app.js (usa auth, _esAdminUI, ADMIN_ENDPOINT, SHEET_ID, parsearCSV, mostrarToast,
// abrirModalProducto, abrirPantallaAdminProductos y window._mpCardActual; el evento «productoAgregado» lo lanza app.js). No hace falta tocar app.js: observa la galería del modal.
//
//   PÚBLICO: si la imagen de un producto tiene recuadros (trazo delgado, centro transparente), el cliente puede tocar uno
//   y se abre el submenú del producto anclado (por ejemplo, solo el borrego chico con su precio). Arriba a la izquierda
//   aparece «↩ Volver» para regresar al producto de donde venía.
//
//   ADMINISTRADORES (correos de ADMIN_EMAILS): junto al engranaje aparece el botón ▢. Al tocarlo se puede:
//     · dibujar un recuadro arrastrando sobre la imagen (o con «➕ Nuevo recuadro»),
//     · moverlo y cambiar su tamaño desde las esquinas,
//     · anclarle un producto con «🔗 Elegir producto», o crearlo ahí mismo con «✨ Crear producto nuevo» (abre el formulario
//       completo de «Agregar producto»; al guardarlo se ancla solo al recuadro y los recuadros siguen editables),
//     · «📸 Capturar y crear producto»: recorta exactamente lo que encierra el recuadro (a la resolución original de la imagen) y abre
//       «Agregar producto» con esa captura ya puesta como imagen del producto (útil cuando no tienes la foto del artículo),
//     · «⬇️ Descargar captura a mi PC»: guarda lo que encierra el recuadro como un archivo PNG en tu carpeta de descargas,
//     · borrarlo y guardar todo en la hoja (pestaña «ZonasImagen», la crea sola el Apps Script).
//   Los recuadros se guardan en porcentajes de la imagen, así que se ven igual en celular y en computadora.
//   El servidor vuelve a verificar el token y el correo (acción «zonasimagen»); aquí solo se evita mostrar las herramientas.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    var MAX_ZONAS = 12;     // por imagen
    var MIN = 6;            // tamaño mínimo de un recuadro (% de la imagen)

    var mapa = {};          // url de la imagen → [{ x, y, w, h, p }]  (x, y, w, h en % de la imagen; p = nombre del producto anclado)
    var edicion = null;     // estado mientras un administrador edita una imagen
    var pila = [];          // nombres de los productos de los que se vino al tocar un recuadro (para «Volver»)
    var btnZonas = null, btnVolver = null;
    var creando = null;     // { ed, z }: recuadro al que se le está creando un producto nuevo desde el formulario «Agregar producto»

    function el(tag, cls, texto) { var e = document.createElement(tag); if (cls) e.className = cls; if (texto !== undefined) e.textContent = texto; return e; }
    function boton(texto, cls) { var b = el('button', cls, texto); b.type = 'button'; return b; }
    function aviso(m) { if (typeof mostrarToast === 'function') mostrarToast(m); }
    function norm(t) { return String(t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' '); }
    function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
    function limitar(n, a, b) { return Math.max(a, Math.min(b, n)); }
    function redondear(n) { return Math.round(n * 100) / 100; }
    function esAdmin() {
        var u = (typeof auth !== 'undefined') ? auth.currentUser : null;
        return !!u && typeof _esAdminUI === 'function' && _esAdminUI(u);
    }
    function galeria() { return document.querySelector('#modalProducto .mp-galeria-superior'); }
    function nombreActual() { var c = window._mpCardActual; return c ? (c.getAttribute('data-nombre') || '').trim() : ''; }
    function todasLasCards() { return Array.prototype.slice.call(document.querySelectorAll('.card-dinamica')); }
    function cardPorNombre(nombre) {
        var b = norm(nombre), lista = todasLasCards();
        for (var i = 0; i < lista.length; i++) if (norm(lista[i].getAttribute('data-nombre')) === b) return lista[i];
        return null;
    }
    function colocar(c, z) { c.style.left = z.x + '%'; c.style.top = z.y + '%'; c.style.width = z.w + '%'; c.style.height = z.h + '%'; }

    function limpiarZonas(arr) {
        var salida = [];
        if (!Array.isArray(arr)) return salida;
        arr.forEach(function (z) {
            if (!z || salida.length >= MAX_ZONAS) return;
            var x = limitar(num(z.x, 0), 0, 100), y = limitar(num(z.y, 0), 0, 100);
            var w = limitar(num(z.w, 0), 0, 100 - x), h = limitar(num(z.h, 0), 0, 100 - y);
            var p = String(z.p || '').trim();
            if (w < 1 || h < 1 || !p) return;
            salida.push({ x: redondear(x), y: redondear(y), w: redondear(w), h: redondear(h), p: p });
        });
        return salida;
    }

    // ── Cargar los recuadros guardados (pestaña «ZonasImagen»; si no existe todavía, simplemente no hay ninguno) ──
    function cargar() {
        if (typeof SHEET_ID === 'undefined' || typeof parsearCSV !== 'function') return;
        var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:csv&sheet=' +
            encodeURIComponent('ZonasImagen') + '&_=' + Date.now();
        fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .then(function (txt) {
                var filas = parsearCSV(txt);
                // Si la pestaña no existe, Google devuelve otra hoja: se valida el encabezado para no confundirse
                if (!filas.length || (filas[0][0] || '').trim().toLowerCase() !== 'imagen' || (filas[0][1] || '').trim().toLowerCase() !== 'zonas') return;
                var nuevo = {};
                for (var i = 1; i < filas.length; i++) {
                    var u = (filas[i][0] || '').trim(), z = [];
                    try { z = limpiarZonas(JSON.parse(filas[i][1] || '[]')); } catch (e) { }
                    if (u && z.length) nuevo[u] = z;
                }
                mapa = nuevo;
                if (!edicion) montarCapas();
            })
            .catch(function (e) { console.warn('[Kukumita] No se pudieron cargar los recuadros de imagen:', e); });
    }

    // ── Capa que se ajusta exactamente a la imagen visible (la imagen usa object-fit: contain y puede tener bordes) ──
    function ajustar(capa, img) {
        var nw = img.naturalWidth, nh = img.naturalHeight, W = img.clientWidth, H = img.clientHeight;
        if (!nw || !nh || !W || !H) return;
        var s = Math.min(W / nw, H / nh), cw = nw * s, ch = nh * s;
        capa.style.left = (img.offsetLeft + (W - cw) / 2) + 'px';
        capa.style.top = (img.offsetTop + (H - ch) / 2) + 'px';
        capa.style.width = cw + 'px';
        capa.style.height = ch + 'px';
        capa.style.visibility = 'visible';
    }
    function vigilar(capa, img) {
        function f() { ajustar(capa, img); }
        if (!img.complete || !img.naturalWidth) img.addEventListener('load', f);
        if (window.ResizeObserver) new ResizeObserver(f).observe(img); else window.addEventListener('resize', f);
        f();
    }

    // ── Vista pública: recuadros tocables ──
    function cajaPublica(z) {
        var c = el('div', 'zi-caja');
        c.setAttribute('role', 'button'); c.tabIndex = 0;
        c.setAttribute('aria-label', 'Ver el precio de ' + z.p);
        colocar(c, z);
        c.appendChild(el('span', 'zi-precio', '$'));
        function abrir(e) { e.stopPropagation(); e.preventDefault(); abrirProducto(z.p); }
        c.addEventListener('click', abrir);
        c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') abrir(e); });
        return c;
    }

    function abrirProducto(nombre) {
        var card = cardPorNombre(nombre);
        if (!card || typeof abrirModalProducto !== 'function') { aviso('Ese producto no está disponible por ahora.'); return; }
        var origen = nombreActual();
        if (origen && norm(origen) !== norm(nombre)) pila.push(origen);
        setTimeout(function () { abrirModalProducto(card); }, 60);   // igual que los productos relacionados del modal
    }

    function montarCapas() {
        var track = document.getElementById('modalGaleriaTrack');
        if (!track) return;
        if (edicion) salirEdicion(true);   // la galería se volvió a dibujar (otro producto): se cancela la edición
        Array.prototype.forEach.call(track.querySelectorAll('.modal-galeria-slide'), function (slide) {
            var vieja = slide.querySelector('.zi-capa'); if (vieja) vieja.remove();
            var img = slide.querySelector('img'); if (!img) return;
            var zs = mapa[img.getAttribute('src')];
            if (!zs || !zs.length) return;
            var capa = el('div', 'zi-capa');
            zs.forEach(function (z) { capa.appendChild(cajaPublica(z)); });
            slide.appendChild(capa);
            vigilar(capa, img);
        });
        actualizarBotones();
    }

    // ── Botones sobre la imagen: ▢ (administradores) y ↩ Volver ──
    function crearBotones() {
        var g = galeria(); if (!g || btnZonas) return;
        btnZonas = boton('', 'mp-btn-config zi-btn-zonas');
        btnZonas.title = 'Recuadros sobre la imagen (anclar productos)';
        btnZonas.setAttribute('aria-label', 'Recuadros sobre la imagen');
        btnZonas.style.display = 'none';
        btnZonas.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2" fill="none" stroke="#fff" stroke-width="2.2" stroke-dasharray="3.5 2.5"/></svg>';
        btnZonas.addEventListener('click', function (e) { e.stopPropagation(); if (edicion) return; entrarEdicion(); });
        btnVolver = boton('', 'mp-btn-config zi-volver');
        btnVolver.style.display = 'none';
        btnVolver.addEventListener('click', function (e) {
            e.stopPropagation();
            var nombre = pila[pila.length - 1], card = nombre ? cardPorNombre(nombre) : null;
            if (!card) { pila = []; actualizarBotones(); return; }
            setTimeout(function () { abrirModalProducto(card); }, 60);
        });
        g.appendChild(btnZonas); g.appendChild(btnVolver);
    }
    function actualizarBotones() {
        crearBotones();
        if (!btnZonas) return;
        btnZonas.style.display = (esAdmin() && !edicion) ? 'flex' : 'none';
        // Si se volvió a un producto que ya estaba en la pila, se recorta hasta ahí
        var actual = norm(nombreActual());
        for (var i = pila.length - 1; i >= 0; i--) if (norm(pila[i]) === actual) { pila.length = i; break; }
        if (pila.length && !edicion) {
            btnVolver.textContent = '↩ ' + pila[pila.length - 1];
            btnVolver.title = 'Volver a ' + pila[pila.length - 1];
            btnVolver.style.display = 'flex';
        } else btnVolver.style.display = 'none';
    }

    // ══════════ Edición (solo administradores) ══════════
    function entrarEdicion() {
        if (!esAdmin()) { aviso('Tu sesión no está autorizada.'); return; }
        var g = galeria(), track = document.getElementById('modalGaleriaTrack');
        if (!g || !track) return;
        var slides = track.querySelectorAll('.modal-galeria-slide');
        var idx = Math.round(track.scrollLeft / (track.offsetWidth || 1));
        var slide = slides[idx] || slides[0], img = slide ? slide.querySelector('img') : null;
        if (!img || !img.naturalWidth) { aviso('Espera a que cargue la imagen e inténtalo de nuevo.'); return; }
        var src = img.getAttribute('src') || '';
        if (!/^https:\/\//i.test(src)) { aviso('Esta imagen no se puede usar para recuadros.'); return; }

        var vieja = slide.querySelector('.zi-capa'); if (vieja) vieja.remove();
        var capa = el('div', 'zi-capa zi-edit');
        slide.appendChild(capa); vigilar(capa, img);
        track.style.overflowX = 'hidden';   // mientras se edita, el dedo no desliza la galería
        g.classList.add('zi-editando');

        var ed = edicion = {
            src: src, track: track, galeria: g, capa: capa,
            zonas: JSON.parse(JSON.stringify(mapa[src] || [])), cajas: [], sel: -1, sucio: false, ocupado: false
        };
        crearBarra(ed);
        pintarEdicion();
        capa.addEventListener('pointerdown', function (e) { if (e.target === capa) dibujar(e); });
        actualizarBotones();
    }

    function salirEdicion(sinRedibujar) {
        var ed = edicion; if (!ed) return;
        edicion = null;
        if (creando && creando.ed === ed) creando = null;
        if (ed.capa) ed.capa.remove();
        if (ed.barra) ed.barra.remove();
        ed.track.style.overflowX = '';
        ed.galeria.classList.remove('zi-editando');
        if (!sinRedibujar) montarCapas();
    }

    function estado(txt, error) { if (!edicion) return; edicion.estado.textContent = txt || ''; edicion.estado.className = 'zi-estado' + (error ? ' error' : ''); }

    function crearBarra(ed) {
        var b = el('div', 'zi-barra'); b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Recuadros sobre la imagen');
        b.appendChild(el('div', 'zi-titulo', '▢ Recuadros sobre la imagen'));
        b.appendChild(el('div', 'zi-ayuda', 'Arrastra sobre la imagen para dibujar un recuadro. Toca uno para moverlo o cambiar su tamaño desde las esquinas.'));

        var fila = el('div', 'zi-fila');
        ed.bNuevo = boton('➕ Nuevo recuadro', 'zi-b');
        ed.bBorrar = boton('🗑️ Borrar', 'zi-b zi-b-peligro');
        fila.appendChild(ed.bNuevo); fila.appendChild(ed.bBorrar);
        b.appendChild(fila);

        ed.selTxt = el('div', 'zi-sel');
        ed.bElegir = boton('🔗 Elegir producto', 'zi-b zi-b-ok');
        ed.bCapturar = boton('📸 Capturar y crear producto', 'zi-b zi-b-captura');
        ed.bDescargar = boton('⬇️ Descargar captura a mi PC', 'zi-b zi-b-captura');
        b.appendChild(ed.selTxt); b.appendChild(ed.bElegir); b.appendChild(ed.bCapturar); b.appendChild(ed.bDescargar);

        ed.picker = el('div', 'zi-picker'); ed.picker.hidden = true;
        ed.buscar = document.createElement('input');
        ed.buscar.type = 'search'; ed.buscar.className = 'zi-buscar'; ed.buscar.placeholder = 'Buscar producto por nombre…';
        ed.lista = el('div', 'zi-lista');
        ed.bCrear = boton('✨ Crear producto nuevo', 'zi-b zi-b-crear');
        ed.picker.appendChild(ed.bCrear); ed.picker.appendChild(ed.buscar); ed.picker.appendChild(ed.lista);
        b.appendChild(ed.picker);

        ed.estado = el('div', 'zi-estado');
        b.appendChild(ed.estado);

        var fin = el('div', 'zi-fila');
        ed.bGuardar = boton('💾 Guardar', 'zi-b zi-b-principal');
        ed.bCancelar = boton('Cancelar', 'zi-b');
        fin.appendChild(ed.bGuardar); fin.appendChild(ed.bCancelar);
        b.appendChild(fin);

        ed.barra = b;
        document.body.appendChild(b);

        ed.bNuevo.addEventListener('click', function () {
            if (ed.zonas.length >= MAX_ZONAS) { estado('Máximo ' + MAX_ZONAS + ' recuadros por imagen.', true); return; }
            estado('');
            ed.zonas.push({ x: 30, y: 30, w: 40, h: 40, p: '' }); ed.sucio = true;
            pintarEdicion(); seleccionar(ed.zonas.length - 1); abrirPicker();
        });
        ed.bBorrar.addEventListener('click', function () {
            if (ed.sel < 0) return;
            ed.zonas.splice(ed.sel, 1); ed.sucio = true; ed.sel = -1; estado('');
            pintarEdicion();
        });
        ed.bElegir.addEventListener('click', function () { if (ed.picker.hidden) abrirPicker(); else ed.picker.hidden = true; });
        ed.buscar.addEventListener('input', function () { pintarLista(ed.buscar.value); });
        ed.bCrear.addEventListener('click', function () { crearProductoNuevo(ed); });
        ed.bCapturar.addEventListener('click', function () { capturarYCrear(ed); });
        ed.bDescargar.addEventListener('click', function () { descargarCaptura(ed); });
        ed.bCancelar.addEventListener('click', function () {
            if (ed.ocupado) return;
            if (ed.sucio && !window.confirm('¿Salir sin guardar los cambios de los recuadros?')) return;
            salirEdicion();
        });
        ed.bGuardar.addEventListener('click', function () { guardar(ed); });
    }

    function pintarEdicion() {
        var ed = edicion; if (!ed) return;
        ed.capa.innerHTML = ''; ed.cajas = [];
        ed.zonas.forEach(function (z, i) {
            var c = cajaEdicion(z, i);
            ed.capa.appendChild(c); ed.cajas.push(c);
        });
        if (ed.sel >= ed.zonas.length) ed.sel = -1;
        seleccionar(ed.sel);
    }

    function seleccionar(i) {
        var ed = edicion; if (!ed) return;
        ed.sel = i;
        ed.cajas.forEach(function (c, k) { c.classList.toggle('sel', k === i); });
        var z = ed.zonas[i];
        ed.bBorrar.disabled = !z;
        ed.bNuevo.disabled = ed.zonas.length >= MAX_ZONAS;
        ed.selTxt.hidden = !z; ed.bElegir.hidden = !z; ed.bCapturar.hidden = !z; ed.bDescargar.hidden = !z;
        if (z) ed.selTxt.textContent = 'Recuadro ' + (i + 1) + ': ' + (z.p ? '🔗 ' + z.p : 'sin producto anclado');
        else ed.picker.hidden = true;
    }

    function cajaEdicion(z, i) {
        var c = el('div', 'zi-caja zi-ed'); colocar(c, z);
        c.appendChild(el('span', 'zi-num', String(i + 1)));
        ['nw', 'ne', 'sw', 'se'].forEach(function (m) {
            var a = el('span', 'zi-asa zi-asa-' + m);
            a.addEventListener('pointerdown', function (e) { arrastrar(e, z, c, m); });
            c.appendChild(a);
        });
        c.addEventListener('pointerdown', function (e) {
            if (e.target !== c) return;
            seleccionar(edicion.zonas.indexOf(z));
            arrastrar(e, z, c, 'mover');
        });
        return c;
    }

    // Mover (modo 'mover') o cambiar el tamaño desde una esquina (modo 'nw' | 'ne' | 'sw' | 'se')
    function arrastrar(e, z, c, modo) {
        var ed = edicion; if (!ed) return;
        e.preventDefault(); e.stopPropagation();
        if (modo !== 'mover') seleccionar(ed.zonas.indexOf(z));
        var r = ed.capa.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var objetivo = e.currentTarget, sx = e.clientX, sy = e.clientY, o = { x: z.x, y: z.y, w: z.w, h: z.h };
        try { objetivo.setPointerCapture(e.pointerId); } catch (err) { }
        function mover(ev) {
            var dx = (ev.clientX - sx) / r.width * 100, dy = (ev.clientY - sy) / r.height * 100;
            var x = o.x, y = o.y, w = o.w, h = o.h;
            if (modo === 'mover') { x = limitar(o.x + dx, 0, 100 - o.w); y = limitar(o.y + dy, 0, 100 - o.h); }
            else {
                if (modo.indexOf('w') > -1) { x = limitar(o.x + dx, 0, o.x + o.w - MIN); w = o.x + o.w - x; }
                if (modo.indexOf('e') > -1) { w = limitar(o.w + dx, MIN, 100 - o.x); }
                if (modo.indexOf('n') > -1) { y = limitar(o.y + dy, 0, o.y + o.h - MIN); h = o.y + o.h - y; }
                if (modo.indexOf('s') > -1) { h = limitar(o.h + dy, MIN, 100 - o.y); }
            }
            z.x = x; z.y = y; z.w = w; z.h = h; colocar(c, z); ed.sucio = true;
        }
        function fin() {
            objetivo.removeEventListener('pointermove', mover);
            objetivo.removeEventListener('pointerup', fin);
            objetivo.removeEventListener('pointercancel', fin);
            z.x = redondear(z.x); z.y = redondear(z.y); z.w = redondear(z.w); z.h = redondear(z.h);
        }
        objetivo.addEventListener('pointermove', mover);
        objetivo.addEventListener('pointerup', fin);
        objetivo.addEventListener('pointercancel', fin);
    }

    // Dibujar un recuadro nuevo arrastrando sobre una zona vacía de la imagen
    function dibujar(e) {
        var ed = edicion; if (!ed) return;
        e.preventDefault();
        seleccionar(-1);
        if (ed.zonas.length >= MAX_ZONAS) { estado('Máximo ' + MAX_ZONAS + ' recuadros por imagen.', true); return; }
        var capa = ed.capa, r = capa.getBoundingClientRect();
        if (!r.width || !r.height) return;
        estado('');
        var x0 = limitar((e.clientX - r.left) / r.width * 100, 0, 100), y0 = limitar((e.clientY - r.top) / r.height * 100, 0, 100);
        var z = { x: x0, y: y0, w: 0, h: 0, p: '' };
        ed.zonas.push(z); pintarEdicion();
        var c = ed.cajas[ed.cajas.length - 1];
        try { capa.setPointerCapture(e.pointerId); } catch (err) { }
        function mover(ev) {
            var x1 = limitar((ev.clientX - r.left) / r.width * 100, 0, 100), y1 = limitar((ev.clientY - r.top) / r.height * 100, 0, 100);
            z.x = Math.min(x0, x1); z.y = Math.min(y0, y1); z.w = Math.abs(x1 - x0); z.h = Math.abs(y1 - y0); colocar(c, z);
        }
        function fin() {
            capa.removeEventListener('pointermove', mover);
            capa.removeEventListener('pointerup', fin);
            capa.removeEventListener('pointercancel', fin);
            if (!edicion) return;
            if (z.w < MIN || z.h < MIN) {   // fue solo un toque: no se crea nada
                ed.zonas.splice(ed.zonas.indexOf(z), 1); pintarEdicion(); seleccionar(-1); return;
            }
            z.x = redondear(z.x); z.y = redondear(z.y); z.w = redondear(z.w); z.h = redondear(z.h);
            ed.sucio = true; seleccionar(ed.zonas.indexOf(z)); abrirPicker();
        }
        capa.addEventListener('pointermove', mover);
        capa.addEventListener('pointerup', fin);
        capa.addEventListener('pointercancel', fin);
    }

    // ── Elegir el producto que se ancla al recuadro seleccionado ──
    function abrirPicker() {
        var ed = edicion; if (!ed || ed.sel < 0) return;
        ed.picker.hidden = false; ed.buscar.value = '';
        pintarLista('');
    }
    function pintarLista(q) {
        var ed = edicion; if (!ed) return;
        var lista = ed.lista; lista.innerHTML = '';
        var b = norm(q), propio = norm(nombreActual()), total = 0, mostrados = 0;
        todasLasCards().forEach(function (card) {
            var nom = (card.getAttribute('data-nombre') || '').trim();
            if (!nom || norm(nom) === propio) return;               // un producto no se ancla a sí mismo
            if (b && norm(nom).indexOf(b) === -1) return;
            total++;
            if (mostrados >= 40) return;
            mostrados++;
            var item = boton('', 'zi-item');
            var im = card.querySelector('.img-contenedor-dinamico img'), src = im ? im.getAttribute('src') : '';
            if (src) { var t = document.createElement('img'); t.src = src; t.alt = ''; t.loading = 'lazy'; item.appendChild(t); }
            var txt = el('span', 'zi-item-txt');
            txt.appendChild(el('span', 'zi-item-nom', nom));
            var modo = card.getAttribute('data-modo-precio'), pr = card.getAttribute('data-precio') || '';
            var precio = modo === 'sinprecio' ? 'Sin precio' : (pr ? (modo === 'revisar' ? 'Desde $' : '$') + pr + ' MXN' : '');
            if (precio) txt.appendChild(el('small', '', precio));
            item.appendChild(txt);
            item.addEventListener('click', function () {
                var z = ed.zonas[ed.sel]; if (!z) return;
                z.p = nom; ed.sucio = true; ed.picker.hidden = true; estado('');
                seleccionar(ed.sel);
            });
            lista.appendChild(item);
        });
        if (!total) lista.appendChild(el('div', 'zi-mas', 'No se encontró ningún producto con ese nombre.'));
        else if (total > mostrados) lista.appendChild(el('div', 'zi-mas', '…y ' + (total - mostrados) + ' más. Escribe para filtrar.'));
    }

    // ── Crear un producto nuevo desde el recuadro (formulario completo de «Agregar producto») ──
    function crearProductoNuevo(ed, archivo) {
        var z = ed.zonas[ed.sel];
        if (!z || edicion !== ed) return;
        if (typeof abrirPantallaAdminProductos !== 'function') { estado('No se pudo abrir «Agregar producto».', true); return; }
        creando = { ed: ed, z: z };
        document.body.classList.add('zi-creando');     // sube el formulario por encima del submenú del producto
        ed.picker.hidden = true;
        ed.barra.style.display = 'none';
        abrirPantallaAdminProductos();
        var pant = document.getElementById('pantallaAdminProductos');
        if (!pant || !pant.classList.contains('activo')) { terminarCreacion(); return; }   // no se abrió (sesión sin permiso, etc.)
        // Si viene de una captura, se coloca como imagen del producto (mismo camino que «Elegir de la galería»)
        if (archivo && typeof procesarImagenProducto === 'function') procesarImagenProducto({ target: { files: [archivo], value: '' } });
    }

    // ── Capturar lo que encierra el recuadro y crear un producto con esa captura ──
    // Se recorta de la imagen original (no de la pantalla), así que sale nítida aunque el recuadro se vea chico.
    function cargarImagenCors(src) {
        return fetch(src, { mode: 'cors', cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
            .then(function (blob) {
                return new Promise(function (ok, fallo) {
                    var url = URL.createObjectURL(blob), im = new Image();
                    im.onload = function () { URL.revokeObjectURL(url); ok(im); };
                    im.onerror = function () { URL.revokeObjectURL(url); fallo(new Error('imagen')); };
                    im.src = url;
                });
            })
            .catch(function () {   // plan B: cargarla con permiso CORS (con parámetro para no reutilizar una copia en caché sin CORS)
                return new Promise(function (ok, fallo) {
                    var im = new Image(); im.crossOrigin = 'anonymous';
                    im.onload = function () { ok(im); };
                    im.onerror = function () { fallo(new Error('No se pudo leer la imagen para recortarla.')); };
                    im.src = src + (src.indexOf('?') > -1 ? '&' : '?') + '_cap=' + Date.now();
                });
            });
    }
    // Recorta la zona de la imagen original y devuelve un Blob (formato: 'png' para guardar en la PC, 'web' = WebP/JPEG para el producto)
    function recortarZona(ed, z, formato) {
        return cargarImagenCors(ed.src).then(function (im) {
            var nw = im.naturalWidth, nh = im.naturalHeight;
            var sx = Math.round(nw * z.x / 100), sy = Math.round(nh * z.y / 100);
            var sw = Math.max(1, Math.min(nw - sx, Math.round(nw * z.w / 100)));
            var sh = Math.max(1, Math.min(nh - sy, Math.round(nh * z.h / 100)));
            var cv = document.createElement('canvas'); cv.width = sw; cv.height = sh;
            cv.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
            return new Promise(function (ok, fallo) {
                function fin(b) { b ? ok(b) : fallo(new Error('No se pudo generar la captura.')); }
                try {
                    if (formato === 'png') { cv.toBlob(fin, 'image/png'); return; }
                    cv.toBlob(function (b) { if (b && b.type === 'image/webp') ok(b); else cv.toBlob(fin, 'image/jpeg', 0.95); }, 'image/webp', 0.95);
                } catch (e) { fallo(new Error('El navegador no permitió recortar esta imagen.')); }   // canvas «manchado» (sin CORS)
            });
        });
    }
    function conOcupado(ed, boton, textoEnCurso, tarea) {
        var z = ed.zonas[ed.sel];
        if (!z || edicion !== ed || ed.ocupado) return;
        var original = boton.textContent;
        ed.ocupado = true; ed.bCapturar.disabled = true; ed.bDescargar.disabled = true; boton.textContent = textoEnCurso; estado('');
        function listo() { ed.ocupado = false; ed.bCapturar.disabled = false; ed.bDescargar.disabled = false; boton.textContent = original; }
        tarea(z).then(function () { listo(); }).catch(function (err) {
            listo(); estado('❌ ' + (err && err.message ? err.message : 'No se pudo capturar el recuadro'), true);
        });
    }
    function capturarYCrear(ed) {
        if (typeof procesarImagenProducto !== 'function') { estado('No se pudo abrir «Agregar producto».', true); return; }
        conOcupado(ed, ed.bCapturar, '⏳ Capturando…', function (z) {
            return recortarZona(ed, z, 'web').then(function (blob) {
                if (edicion !== ed) return;
                var ext = blob.type === 'image/webp' ? '.webp' : '.jpg';
                crearProductoNuevo(ed, new File([blob], 'captura-recuadro-' + (ed.sel + 1) + ext, { type: blob.type }));
            });
        });
    }
    // Descarga la captura (PNG, sin pérdida) a la carpeta de descargas de la PC
    function descargarCaptura(ed) {
        conOcupado(ed, ed.bDescargar, '⏳ Preparando…', function (z) {
            var base = (nombreActual() || 'producto').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 50) || 'producto';
            var archivo = base + ' - recuadro ' + (ed.sel + 1) + '.png';
            return recortarZona(ed, z, 'png').then(function (blob) {
                var url = URL.createObjectURL(blob), a = document.createElement('a');
                a.href = url; a.download = archivo; a.style.display = 'none';
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
                aviso('✅ Captura descargada: ' + archivo);
            });
        });
    }
    function terminarCreacion() {
        var c = creando; creando = null;
        document.body.classList.remove('zi-creando');
        if (c && c.ed === edicion) {
            c.ed.barra.style.display = '';
            var i = c.ed.zonas.indexOf(c.z);
            if (i > -1) seleccionar(i);
        }
        var m = document.getElementById('modalProducto');   // el submenú del producto sigue abierto debajo
        if (m && m.classList.contains('abierto') && typeof _modalActivo !== 'undefined') _modalActivo = 'producto';
    }
    // Al guardar el producto nuevo, se ancla al recuadro y se vuelve a los recuadros (sin perder lo dibujado)
    document.addEventListener('productoAgregado', function (e) {
        var c = creando, nombre = e && e.detail ? String(e.detail.nombre || '').trim() : '';
        if (!c || !nombre) return;
        var i = (c.ed === edicion) ? c.ed.zonas.indexOf(c.z) : -1;
        if (i > -1) { c.z.p = nombre; c.ed.sucio = true; }
        if (typeof cerrarPantallaAdminProductos === 'function') cerrarPantallaAdminProductos();
        if (i > -1) aviso('✅ Producto creado y anclado al recuadro ' + (i + 1) + '. Pulsa «Guardar» para conservar los recuadros.');
    });
    var pantAdmin = document.getElementById('pantallaAdminProductos');
    if (pantAdmin) new MutationObserver(function () { if (!pantAdmin.classList.contains('activo')) terminarCreacion(); })
        .observe(pantAdmin, { attributes: true, attributeFilter: ['class'] });

    // ── Guardar en la hoja (Apps Script, acción «zonasimagen») ──
    async function guardar(ed) {
        if (ed.ocupado || edicion !== ed) return;
        for (var i = 0; i < ed.zonas.length; i++) {
            if (!ed.zonas[i].p) { seleccionar(i); estado('El recuadro ' + (i + 1) + ' no tiene producto anclado.', true); return; }
        }
        if (!ed.zonas.length && !mapa[ed.src]) { salirEdicion(); return; }
        ed.ocupado = true; ed.bGuardar.disabled = true; ed.bCancelar.disabled = true;
        estado('Guardando en la hoja…');
        try {
            var user = (typeof auth !== 'undefined') ? auth.currentUser : null;
            if (!user || !_esAdminUI(user)) throw new Error('Tu sesión no está autorizada.');
            var idToken = await user.getIdToken(true);
            var resp = await fetch(ADMIN_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // evita el preflight CORS que Apps Script no responde
                body: JSON.stringify({
                    accion: 'zonasimagen', op: 'guardar', idToken: idToken, imagen: ed.src,
                    zonas: ed.zonas.map(function (z) { return { x: redondear(z.x), y: redondear(z.y), w: redondear(z.w), h: redondear(z.h), p: z.p }; })
                })
            });
            var data = await resp.json();
            if (!data.ok) throw new Error(data.error || 'Error del servidor');
            var zs = limpiarZonas(data.zonas);
            if (zs.length) mapa[ed.src] = zs; else delete mapa[ed.src];
            ed.ocupado = false;
            if (edicion === ed) salirEdicion();
            aviso(zs.length ? '✅ Recuadros guardados' : '✅ Recuadros quitados de esta imagen');
        } catch (err) {
            ed.ocupado = false;
            if (edicion === ed) { ed.bGuardar.disabled = false; ed.bCancelar.disabled = false; estado('❌ ' + (err && err.message ? err.message : 'No se pudo guardar'), true); }
        }
    }

    // ── Arranque ──
    var track = document.getElementById('modalGaleriaTrack');
    if (track) new MutationObserver(function () { montarCapas(); }).observe(track, { childList: true });
    document.addEventListener('modalProductoCerrado', function () { pila = []; salirEdicion(true); actualizarBotones(); });
    crearBotones();
    cargar();
})();
