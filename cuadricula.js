// ══════════════════════════════════════════════════════════════════════════════
// VELAS KUKÚMITA — Cuadrícula de productos (solo administradores, solo computadora)
// Se carga DESPUÉS de portada.js (usa: _esAdminUI, auth, ADMIN_ENDPOINT, listaProductos, mostrarToast,
// cargarDesdeGoogleSheets y window._portadaUtil).
//
// QUÉ HACE
//   · Botón «🧱 Cuadrícula de productos» dentro del ⚙️: abre una pantalla con TODOS los productos de la hoja, del primero
//     al último, en una sola página y en 10 columnas (solo si la pantalla mide 1024 px o más).
//   · Se arrastra un producto y se suelta sobre la posición donde debe quedar; los demás se recorren. Se puede repetir
//     las veces que se quiera, deshacer, o descartar todo. Nada se escribe en la hoja hasta presionar
//     «Guardar y mover productos» (acción «reordenar» del Apps Script, que vuelve a verificar el token de Firebase).
//   · Separación de zonas: una línea marca dónde empieza cada página del sitio (cada 30 productos = 3 filas de 10) y un
//     filtro por evento/celebración, etiqueta, más vendidos u ofertas resalta (o muestra solo) esa zona.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    var POR_PAGINA = 30;          // debe coincidir con la paginación del sitio (app.js)
    var ANCHO_MIN_PC = 1024;

    var overlay = null, grid = null, cuerpo = null, selFiltro = null, chkSolo = null;
    var txtEstado = null, btnGuardar = null, btnDeshacer = null, btnDescartar = null, txtMsg = null;
    var items = [], porId = {}, original = [], orden = [], historial = [];
    var filtro = '', soloFiltro = false, guardando = false, arrastrando = null, recienId = null;

    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
    function esAdmin() {
        var u = (typeof auth !== 'undefined') ? auth.currentUser : null;
        return (typeof _esAdminUI === 'function') && _esAdminUI(u);
    }
    function esPC() { return window.matchMedia && window.matchMedia('(min-width:' + ANCHO_MIN_PC + 'px)').matches; }
    function U() { return window._portadaUtil || { normSlug: function (s) { return String(s || '').toLowerCase(); }, claveSlug: function (s) { return String(s || '').toLowerCase(); }, nombreFiltro: function (f) { return f; } }; }
    function toast(m) { if (typeof mostrarToast === 'function') mostrarToast(m); else console.log(m); }

    // ── Datos: los productos de la hoja en su orden actual (id = fila de la hoja − 1) ──
    function cargarItems() {
        var u = U();
        var L = (typeof listaProductos !== 'undefined' && listaProductos) ? listaProductos.slice() : [];
        L.sort(function (a, b) { return a.id - b.id; });
        items = L.map(function (p) {
            return {
                id: p.id,
                fila: p.id + 1,
                nombre: String(p.nombre || ''),
                img: p.imagen || '',
                eventos: String(p.eventos || '').split('|').map(u.claveSlug).filter(function (e) { return e && e !== 'sin-evento' && e !== 'sin'; }),
                tipos: (p.tipos || []).map(u.normSlug).filter(function (t) { return t && t !== 'sin-etiqueta'; }),
                oferta: !!p.oferta,
                mas: !!p.masVendido,
                precio: p.precioNormal || 0,
                mayoreo: p.precioBazar || 0,
                precioOferta: p.precioOferta || 0
            };
        });
        porId = {}; items.forEach(function (it) { porId[it.id] = it; });
        original = items.map(function (it) { return it.id; });
        orden = items.slice();
        historial = [];
        filtro = ''; soloFiltro = false; recienId = null;
    }

    function coincide(it, f) {
        if (!f) return true;
        var p = f.split(':'), tipo = p[0], v = p.slice(1).join(':');
        if (tipo === 'evento') return it.eventos.indexOf(v) !== -1;
        if (tipo === 'tipo') return it.tipos.indexOf(v) !== -1;
        if (tipo === 'especial') return v === 'masvendido' ? it.mas : v === 'oferta' ? it.oferta : false;
        return false;
    }

    function llenarFiltro() {
        var u = U(), ev = {}, ti = {}, nMas = 0, nOf = 0;
        items.forEach(function (it) {
            it.eventos.forEach(function (e) { ev[e] = (ev[e] || 0) + 1; });
            it.tipos.forEach(function (t) { ti[t] = (ti[t] || 0) + 1; });
            if (it.mas) nMas++; if (it.oferta) nOf++;
        });
        selFiltro.innerHTML = '';
        function op(parent, valor, texto) { var o = document.createElement('option'); o.value = valor; o.textContent = texto; parent.appendChild(o); }
        op(selFiltro, '', 'Todos los productos (' + items.length + ')');
        var g1 = document.createElement('optgroup'); g1.label = 'Eventos / celebraciones';
        Object.keys(ev).sort().forEach(function (k) { op(g1, 'evento:' + k, u.nombreFiltro('evento:' + k) + ' (' + ev[k] + ')'); });
        if (g1.children.length) selFiltro.appendChild(g1);
        var g2 = document.createElement('optgroup'); g2.label = 'Etiquetas';
        Object.keys(ti).sort().forEach(function (k) { op(g2, 'tipo:' + k, u.nombreFiltro('tipo:' + k) + ' (' + ti[k] + ')'); });
        if (g2.children.length) selFiltro.appendChild(g2);
        var g3 = document.createElement('optgroup'); g3.label = 'Especiales';
        op(g3, 'especial:masvendido', 'Más vendidos (' + nMas + ')'); op(g3, 'especial:oferta', 'En oferta (' + nOf + ')');
        selFiltro.appendChild(g3);
        selFiltro.value = '';
    }

    // ── Pintar la cuadrícula ──
    function cambios() { var n = 0; for (var i = 0; i < orden.length; i++) if (original[i] !== orden[i].id) n++; return n; }

    function pintar() {
        var posOriginal = {}; original.forEach(function (id, i) { posOriginal[id] = i; });
        var frag = document.createDocumentFragment(), solo = !!(soloFiltro && filtro), hayFiltro = !!filtro, coinciden = 0;
        orden.forEach(function (it, i) {
            var ok = coincide(it, filtro);
            if (ok && hayFiltro) coinciden++;
            if (solo && !ok) return;
            if (!solo && i % POR_PAGINA === 0) {
                var pag = Math.floor(i / POR_PAGINA) + 2;   // la página 1 del sitio es la portada
                frag.appendChild(el('div', 'cg-pagina', 'Página ' + pag + ' del sitio · posiciones ' + (i + 1) + ' a ' + Math.min(i + POR_PAGINA, orden.length)));
            }
            var c = el('div', 'cg-celda');
            c.setAttribute('draggable', 'true');
            c.setAttribute('data-i', String(i));
            c.title = it.nombre;
            if (posOriginal[it.id] !== i) c.classList.add('cg-cambio');
            if (hayFiltro) c.classList.add(ok ? 'cg-resalta' : 'cg-tenue');
            if (it.id === recienId) c.classList.add('cg-recien');
            var foto = el('div', 'cg-foto');
            if (it.img) { var im = document.createElement('img'); im.src = it.img; im.alt = ''; im.loading = 'lazy'; im.draggable = false; foto.appendChild(im); }
            var envoltura = el('div', 'cg-fotowrap');
            envoltura.appendChild(foto);
            var bLapiz = el('button', 'cg-lapiz', '✏️'); bLapiz.type = 'button'; bLapiz.draggable = false;
            bLapiz.title = 'Editar imagen, nombre y precios'; bLapiz.setAttribute('aria-label', 'Editar ' + it.nombre);
            var bBorrar = el('button', 'cg-borrar', '🗑️'); bBorrar.type = 'button'; bBorrar.draggable = false;
            bBorrar.title = 'Eliminar este producto'; bBorrar.setAttribute('aria-label', 'Eliminar ' + it.nombre);
            envoltura.appendChild(bLapiz); envoltura.appendChild(bBorrar);
            c.appendChild(envoltura);
            c.appendChild(el('span', 'cg-pos', String(i + 1)));
            if (posOriginal[it.id] !== i) c.appendChild(el('span', 'cg-antes', 'antes ' + (posOriginal[it.id] + 1)));
            c.appendChild(el('div', 'cg-nombre', it.nombre));
            frag.appendChild(c);
        });
        grid.innerHTML = '';
        grid.appendChild(frag);
        if (hayFiltro && !coinciden) grid.appendChild(el('div', 'cg-vacio', 'Ningún producto tiene ese filtro.'));
        estado();
    }

    function estado() {
        var n = cambios();
        txtEstado.textContent = orden.length + ' productos · ' + (n ? n + (n === 1 ? ' cambio sin guardar' : ' cambios sin guardar') : 'sin cambios');
        btnGuardar.disabled = guardando || n === 0;
        btnDescartar.disabled = guardando || n === 0;
        btnDeshacer.disabled = guardando || !historial.length;
    }
    function mensaje(t, error) { txtMsg.textContent = t || ''; txtMsg.style.color = error ? '#c0392b' : '#6b5a4e'; }

    // ── Mover ──
    function mover(desde, hasta) {
        if (desde === hasta || desde < 0 || hasta < 0 || desde >= orden.length || hasta >= orden.length) return;
        historial.push(orden.slice()); if (historial.length > 200) historial.shift();
        var it = orden.splice(desde, 1)[0];
        orden.splice(hasta, 0, it);        // el producto queda exactamente en la posición donde se soltó
        recienId = it.id;
        mensaje('');
        pintar();
    }
    function deshacer() { if (!historial.length || guardando) return; orden = historial.pop(); recienId = null; mensaje(''); pintar(); }
    function descartar() {
        if (guardando || !cambios()) return;
        if (!window.confirm('¿Descartar todos los cambios de posición que no has guardado?')) return;
        orden = original.map(function (id) { return porId[id]; }); historial = []; recienId = null; mensaje(''); pintar();
    }

    // ── Guardar en la hoja ──
    function guardar() {
        if (guardando) return;
        var n = cambios();
        if (!n) return;
        var user = (typeof auth !== 'undefined') ? auth.currentUser : null;
        if (!esAdmin() || !user) { mensaje('Tu sesión no está autorizada.', true); return; }
        if (!window.confirm('Se van a reacomodar ' + n + ' productos en la hoja de Google Sheets.\n\nTambién cambiará el orden para todos los visitantes del sitio. ¿Guardar y mover los productos?')) return;
        guardando = true; estado(); mensaje('Guardando… no cierres esta pantalla.');
        user.getIdToken(true).then(function (tok) {
            return fetch(ADMIN_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    idToken: tok, accion: 'reordenar',
                    orden: orden.map(function (it) { return it.fila; }),      // fila actual de cada producto, en el orden nuevo
                    nombres: orden.map(function (it) { return it.nombre; })   // para que el servidor detecte si la hoja cambió
                })
            });
        }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d.ok) throw new Error(d.error || 'Error del servidor');
            toast('✅ Productos reacomodados');
            guardando = false;
            cerrar(true);
            if (typeof cargarDesdeGoogleSheets === 'function') cargarDesdeGoogleSheets();   // recarga el catálogo con el nuevo orden
        }).catch(function (e) {
            var m = String((e && e.message) || e);
            if (/Falta el nombre|Precio inv/i.test(m)) m = 'el Apps Script todavía no tiene la acción de reordenar: pega el codigo.gs nuevo y publícalo otra vez.';
            guardando = false; estado();
            mensaje('No se pudo guardar: ' + m, true);
        });
    }

    // ── Arrastrar y soltar ──
    function celdaDe(e) { return e.target && e.target.closest ? e.target.closest('.cg-celda') : null; }
    function limpiarDestino() { var d = grid.querySelector('.cg-destino'); if (d) d.classList.remove('cg-destino'); }
    function engancharArrastre() {
        grid.addEventListener('dragstart', function (e) {
            var c = celdaDe(e); if (!c || guardando) { e.preventDefault(); return; }
            arrastrando = Number(c.getAttribute('data-i'));
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', String(arrastrando)); } catch (x) { /* nada */ }
            setTimeout(function () { c.classList.add('cg-arrastrando'); }, 0);
        });
        cuerpo.addEventListener('dragover', function (e) {
            if (arrastrando == null) return;
            e.preventDefault(); e.dataTransfer.dropEffect = 'move';
            var c = celdaDe(e);
            if (c && !c.classList.contains('cg-destino')) { limpiarDestino(); c.classList.add('cg-destino'); }
            // desplazamiento automático al acercarse al borde superior / inferior
            var r = cuerpo.getBoundingClientRect();
            if (e.clientY < r.top + 80) cuerpo.scrollTop -= 22; else if (e.clientY > r.bottom - 80) cuerpo.scrollTop += 22;
        });
        cuerpo.addEventListener('drop', function (e) {
            if (arrastrando == null) return;
            e.preventDefault();
            var c = celdaDe(e), desde = arrastrando;
            arrastrando = null;
            if (c) mover(desde, Number(c.getAttribute('data-i'))); else pintar();
        });
        grid.addEventListener('dragend', function () { arrastrando = null; limpiarDestino(); var a = grid.querySelector('.cg-arrastrando'); if (a) a.classList.remove('cg-arrastrando'); });
    }

    // ── Editar (lápiz) y eliminar (papelera) un producto ──
    // Las dos acciones se aplican al instante en la hoja (no esperan a «Guardar y mover productos»), así que se
    // bloquean mientras haya cambios de posición sin guardar: la fila de cada producto cambiaría al guardarlos.
    var modal = null, modalBusy = false;

    function cerrarModal() { if (modal && !modalBusy) { modal.remove(); modal = null; } }
    function abrirModal(titulo) {
        cerrarModal();
        modal = el('div', 'cg-modal-fondo');
        var caja = el('div', 'cg-modal'); caja.setAttribute('role', 'dialog'); caja.setAttribute('aria-modal', 'true');
        caja.appendChild(el('h4', 'cg-modal-titulo', titulo));
        modal.appendChild(caja);
        overlay.appendChild(modal);
        return caja;
    }
    function campo(caja, etiqueta, tipo, valor, extra) {
        var l = el('label', 'cg-campo'); l.appendChild(el('span', '', etiqueta));
        var i = document.createElement('input'); i.type = tipo; i.value = valor == null ? '' : valor;
        if (extra) Object.keys(extra).forEach(function (k) { i.setAttribute(k, extra[k]); });
        l.appendChild(i); caja.appendChild(l); return i;
    }
    function pedirToken() {
        var user = (typeof auth !== 'undefined') ? auth.currentUser : null;
        if (!esAdmin() || !user) return Promise.reject(new Error('Tu sesión no está autorizada.'));
        return user.getIdToken(true);
    }
    function enviar(cuerpo) {
        return pedirToken().then(function (tok) {
            cuerpo.idToken = tok;
            return fetch(ADMIN_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo) });
        }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d.ok) throw new Error(d.error || 'Error del servidor');
            return d;
        });
    }
    function traducirError(e) {
        var m = String((e && e.message) || e);
        // Si el Apps Script aún no tiene el código nuevo, cae en la rama de "agregar producto" y responde esto:
        if (/Falta el imagen|Falta la imagen|Falta el nombre|Precio inv/i.test(m)) m = 'el Apps Script todavía no tiene las acciones nuevas: pega el codigo.gs nuevo y publícalo otra vez.';
        return m;
    }
    // Resumen de lo que pasó con las imágenes en ImgBB (enlaces de borrado de un clic cuando existen)
    function avisoImgbb(d, alCerrar) {
        var n = (d.imgbbBorrar || []).length, sin = d.imgbbSinEnlace || 0;
        if (!n && !sin) { alCerrar(); return; }
        var caja = abrirModal('Imágenes en ImgBB');
        if (n) {
            caja.appendChild(el('p', 'cg-modal-txt', 'Para borrarlas también de tu galería de ImgBB abre cada enlace y confirma ahí el borrado:'));
            d.imgbbBorrar.forEach(function (u, i) {
                var a = el('a', 'cg-enlace', 'Borrar imagen ' + (i + 1) + ' en ImgBB ↗'); a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
                caja.appendChild(a);
            });
        }
        if (sin) caja.appendChild(el('p', 'cg-modal-txt', (sin === 1 ? 'Una imagen' : sin + ' imágenes') + ' se subió antes de que el sistema guardara enlaces de borrado, así que ' + 'tendrás que quitar' + (sin === 1 ? 'la' : 'las') + ' a mano desde tu cuenta de ImgBB.'));
        var f = el('div', 'cg-modal-fila'); var ok = el('button', 'cg-btn principal', 'Listo'); ok.type = 'button';
        ok.addEventListener('click', function () { cerrarModal(); alCerrar(); });
        f.appendChild(ok); caja.appendChild(f);
    }

    function abrirEditar(it) {
        var caja = abrirModal('✏️ Editar producto');
        var iNombre = campo(caja, 'Nombre', 'text', it.nombre, { maxlength: '200' });
        var iPrecio = campo(caja, 'Precio', 'number', it.precio || '', { min: '0', step: 'any', inputmode: 'decimal' });
        var iMay = campo(caja, 'Precio de mayoreo (opcional)', 'number', it.mayoreo || '', { min: '0', step: 'any', inputmode: 'decimal' });
        var iOf = campo(caja, 'Precio de oferta (opcional, menor al precio)', 'number', it.precioOferta || '', { min: '0', step: 'any', inputmode: 'decimal' });

        var bloqueImg = el('div', 'cg-campo'); bloqueImg.appendChild(el('span', '', 'Imagen principal (elige un archivo para reemplazarla)'));
        var vista = document.createElement('img'); vista.className = 'cg-vista'; vista.alt = ''; if (it.img) vista.src = it.img;
        bloqueImg.appendChild(vista);
        var iFile = document.createElement('input'); iFile.type = 'file'; iFile.accept = 'image/*'; bloqueImg.appendChild(iFile);
        caja.appendChild(bloqueImg);

        var msg = el('div', 'cg-modal-msg'); caja.appendChild(msg);
        var fila = el('div', 'cg-modal-fila');
        var bCancel = el('button', 'cg-btn', 'Cancelar'); bCancel.type = 'button';
        var bGuardar = el('button', 'cg-btn principal', '💾 Guardar'); bGuardar.type = 'button';
        fila.appendChild(bCancel); fila.appendChild(bGuardar); caja.appendChild(fila);

        var nueva = null;   // { base64, nombre, dataUrl }
        iFile.addEventListener('change', function () {
            nueva = null; msg.textContent = ''; msg.style.color = '';
            var f = iFile.files && iFile.files[0]; if (!f) return;
            if (typeof _convertirArchivoImagenProducto !== 'function') { msg.textContent = 'No se pudo preparar la imagen (falta app.js).'; msg.style.color = '#c0392b'; return; }
            msg.textContent = 'Preparando imagen…';
            _convertirArchivoImagenProducto(f).then(function (r) { nueva = r; vista.src = r.dataUrl; msg.textContent = ''; })
                .catch(function (e) { msg.textContent = String(e); msg.style.color = '#c0392b'; iFile.value = ''; });
        });
        bCancel.addEventListener('click', cerrarModal);
        bGuardar.addEventListener('click', function () {
            if (modalBusy) return;
            var nombre = iNombre.value.trim(), precio = iPrecio.value.trim(), may = iMay.value.trim(), of = iOf.value.trim();
            function err(t) { msg.textContent = t; msg.style.color = '#c0392b'; }
            if (!nombre) return err('Escribe el nombre del producto.');
            if (precio === '' || isNaN(Number(precio)) || Number(precio) < 0) return err('Escribe un precio válido.');
            if (may !== '' && (isNaN(Number(may)) || Number(may) < 0)) return err('El precio de mayoreo no es válido.');
            if (of !== '' && (isNaN(Number(of)) || Number(of) < 0)) return err('El precio de oferta no es válido.');
            if (of !== '' && Number(of) >= Number(precio)) return err('El precio de oferta debe ser menor al precio original.');
            modalBusy = true; bGuardar.disabled = true; bCancel.disabled = true;
            msg.style.color = ''; msg.textContent = nueva ? 'Subiendo imagen y guardando…' : 'Guardando…';
            var cuerpo = { accion: 'editarrapido', filaEditar: it.fila, nombreActual: it.nombre, nombre: nombre, precio: precio, precioMayoreo: may, precioOferta: of };
            if (nueva) { cuerpo.imagenNueva = nueva.base64; cuerpo.imagenNombre = nueva.nombre; }
            enviar(cuerpo).then(function (d) {
                modalBusy = false;
                it.nombre = nombre; it.precio = Number(precio); it.mayoreo = may === '' ? 0 : Number(may); it.precioOferta = of === '' ? 0 : Number(of);
                if (d.imagen) it.img = d.imagen;
                cerrarModal(); pintar(); toast('✅ Producto actualizado');
                if (typeof cargarDesdeGoogleSheets === 'function') setTimeout(cargarDesdeGoogleSheets, 1200);
                avisoImgbb(d, function () { });
            }).catch(function (e) {
                modalBusy = false; bGuardar.disabled = false; bCancel.disabled = false;
                err('No se pudo guardar: ' + traducirError(e));
            });
        });
        iNombre.focus();
    }

    function eliminar(it) {
        if (!window.confirm('¿Eliminar «' + it.nombre + '» de la hoja de Google Sheets?\n\nEsta acción no se puede deshacer y el producto desaparecerá del sitio para todos.')) return;
        guardando = true; estado(); mensaje('Eliminando «' + it.nombre + '»… no cierres esta pantalla.');
        enviar({ accion: 'eliminar', filaEditar: it.fila, nombreActual: it.nombre }).then(function (d) {
            guardando = false; mensaje('');
            toast('🗑️ Producto eliminado');
            // Las filas de abajo subieron una posición: se cierra la cuadrícula y se recarga el catálogo desde la hoja.
            var despues = function () {
                cerrar(true);
                if (typeof cargarDesdeGoogleSheets === 'function') setTimeout(cargarDesdeGoogleSheets, 1200);
            };
            avisoImgbb(d, despues);
        }).catch(function (e) {
            guardando = false; estado();
            mensaje('No se pudo eliminar: ' + traducirError(e), true);
        });
    }

    function clicBotonProducto(e) {
        var b = e.target && e.target.closest ? e.target.closest('.cg-lapiz, .cg-borrar') : null;
        if (!b || guardando) return;
        e.preventDefault(); e.stopPropagation();
        var c = b.closest('.cg-celda'); if (!c) return;
        var it = orden[Number(c.getAttribute('data-i'))]; if (!it) return;
        if (cambios()) { mensaje('Primero guarda o descarta los cambios de posición; luego podrás editar o eliminar productos.', true); return; }
        if (b.classList.contains('cg-lapiz')) abrirEditar(it); else eliminar(it);
    }

    // ── Construir la pantalla ──
    function construir() {
        if (overlay) return;
        overlay = el('div', ''); overlay.id = 'pantallaCuadricula';
        overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Cuadrícula de productos');

        var cab = el('div', 'cg-cab');
        cab.appendChild(el('h3', 'cg-titulo', '🧱 Cuadrícula de productos'));
        var zona = el('div', 'cg-zona');
        zona.appendChild(el('label', '', 'Zona:'));
        selFiltro = document.createElement('select'); selFiltro.className = 'cg-sel'; selFiltro.setAttribute('aria-label', 'Filtrar por evento, etiqueta o especial');
        zona.appendChild(selFiltro);
        var lblSolo = el('label', 'cg-chk'); chkSolo = document.createElement('input'); chkSolo.type = 'checkbox';
        lblSolo.appendChild(chkSolo); lblSolo.appendChild(document.createTextNode(' Mostrar solo esa zona'));
        zona.appendChild(lblSolo);
        cab.appendChild(zona);
        txtEstado = el('div', 'cg-estado');
        cab.appendChild(txtEstado);
        var acc = el('div', 'cg-acc');
        btnDeshacer = el('button', 'cg-btn', '↩ Deshacer'); btnDeshacer.type = 'button';
        btnDescartar = el('button', 'cg-btn', 'Descartar cambios'); btnDescartar.type = 'button';
        btnGuardar = el('button', 'cg-btn principal', 'Guardar y mover productos'); btnGuardar.type = 'button';
        var btnCerrar = el('button', 'cg-btn', '✕ Cerrar'); btnCerrar.type = 'button';
        [btnDeshacer, btnDescartar, btnGuardar, btnCerrar].forEach(function (b) { acc.appendChild(b); });
        cab.appendChild(acc);
        overlay.appendChild(cab);

        var barra = el('div', 'cg-ayuda');
        barra.appendChild(el('span', '', 'Arrastra un producto y suéltalo sobre la posición donde quieres que quede; los demás se recorren. No se guarda nada en la hoja hasta presionar «Guardar y mover productos».'));
        txtMsg = el('span', 'cg-msg'); barra.appendChild(txtMsg);
        overlay.appendChild(barra);

        cuerpo = el('div', 'cg-cuerpo');
        grid = el('div', 'cg-grid');
        cuerpo.appendChild(grid);
        overlay.appendChild(cuerpo);
        document.body.appendChild(overlay);

        selFiltro.addEventListener('change', function () { filtro = selFiltro.value; pintar(); });
        chkSolo.addEventListener('change', function () { soloFiltro = chkSolo.checked; pintar(); });
        btnDeshacer.addEventListener('click', deshacer);
        btnDescartar.addEventListener('click', descartar);
        btnGuardar.addEventListener('click', guardar);
        btnCerrar.addEventListener('click', function () { cerrar(false); });
        engancharArrastre();
        grid.addEventListener('click', clicBotonProducto);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('abierta')) { if (modal) cerrarModal(); else cerrar(false); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && overlay.classList.contains('abierta')) { e.preventDefault(); deshacer(); }
        });
    }

    function abrir() {
        if (!esAdmin()) return;
        if (!esPC()) { toast('La cuadrícula de productos solo está disponible en computadora.'); return; }
        if (typeof listaProductos === 'undefined' || !listaProductos || !listaProductos.length) { toast('Aún no se han cargado los productos.'); return; }
        construir();
        cargarItems();
        llenarFiltro();
        chkSolo.checked = false;
        mensaje('');
        var cfg = document.getElementById('cfgPortadaCancelar'); if (cfg) cfg.click();   // cierra el panel ⚙️
        overlay.classList.add('abierta');
        document.body.style.overflow = 'hidden';
        cuerpo.scrollTop = 0;
        pintar();
    }
    function cerrar(forzar) {
        if (!overlay || !overlay.classList.contains('abierta')) return;
        if (guardando) return;
        if (!forzar && cambios() && !window.confirm('Tienes cambios de posición sin guardar. ¿Salir y perderlos?')) return;
        overlay.classList.remove('abierta');
        document.body.style.overflow = '';
        grid.innerHTML = '';
    }

    // El botón vive dentro del panel ⚙️ (portada.js lo dibuja)
    document.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('#btnAbrirCuadricula')) abrir();
    });
})();
