// ══════════════════════════════════════════════════════════════════════════════
// VELAS KUKÚMITA — Submenú «Agregar producto a la lista de precios» (solo administradores)
// Se carga DESPUÉS de app.js (usa _lpForm, _lpRender, _convertirArchivoImagenProducto y mostrarToast).
//
//   Desde «Revisar precios» (formularios Agregar / Editar), el botón «➕ Agregar producto a la lista» abre este submenú,
//   con dos caminos:
//     📚 Producto que ya existe → se busca en el catálogo; trae su nombre, precio e imagen.
//     🆕 Producto nuevo         → se piden imagen, nombre, precio y demás datos; el producto se CREA en el catálogo
//                                 cuando se guarda el producto principal (así no quedan productos huérfanos si se cancela).
//   Cada artículo de la lista lleva su propia imagen, que se ve en el submenú «Revisar precios» del catálogo.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    var kActual = 'add';
    var overlay = null, cuerpo = null, titulo = null, btnAtras = null;
    var vistaActual = 'menu';

    function el(tag, cls, texto) { var e = document.createElement(tag); if (cls) e.className = cls; if (texto !== undefined) e.textContent = texto; return e; }
    function aviso(m) { if (typeof mostrarToast === 'function') mostrarToast(m); }

    // ── Estructura del submenú (se crea una sola vez) ──
    function construir() {
        if (overlay) return;
        overlay = el('div', 'slp-overlay'); overlay.id = 'submenuListaPrecios';
        overlay.addEventListener('click', function (e) { if (e.target === overlay) cerrar(); });
        var caja = el('div', 'slp-caja');
        var head = el('div', 'slp-head');
        btnAtras = el('button', 'slp-atras', '‹'); btnAtras.type = 'button'; btnAtras.setAttribute('aria-label', 'Volver');
        btnAtras.addEventListener('click', function () { mostrarMenu(); });
        titulo = el('h3', 'slp-titulo', 'Agregar a la lista');
        var x = el('button', 'slp-cerrar', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar');
        x.addEventListener('click', cerrar);
        head.appendChild(btnAtras); head.appendChild(titulo); head.appendChild(x);
        cuerpo = el('div', 'slp-cuerpo');
        caja.appendChild(head); caja.appendChild(cuerpo);
        overlay.appendChild(caja);
        document.body.appendChild(overlay);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('abierto')) cerrar(); });
    }
    function abrir(k) {
        kActual = (k === 'edit') ? 'edit' : 'add';
        construir();
        mostrarMenu();
        overlay.classList.add('abierto');
    }
    function cerrar() {
        if (!overlay) return;
        overlay.classList.remove('abierto');
        cuerpo.innerHTML = '';
        if (typeof _lpRender === 'function') _lpRender(kActual);
    }
    function ponerVista(nombre, tit) {
        vistaActual = nombre;
        titulo.textContent = tit;
        btnAtras.style.visibility = nombre === 'menu' ? 'hidden' : 'visible';
        cuerpo.innerHTML = '';
        cuerpo.scrollTop = 0;
    }

    // ── Vista 1: elegir el camino ──
    function mostrarMenu() {
        ponerVista('menu', 'Agregar a la lista');
        var info = el('p', 'slp-info', 'Cada producto de la lista lleva su propia imagen y su precio. ¿De dónde viene?');
        var b1 = el('button', 'slp-opcion'); b1.type = 'button';
        b1.innerHTML = '<span class="slp-op-icono">📚</span><span><strong>Un producto que ya existe</strong><small>Lo eliges del catálogo; se copian su nombre, imagen y precio.</small></span>';
        b1.addEventListener('click', mostrarExistentes);
        var b2 = el('button', 'slp-opcion'); b2.type = 'button';
        b2.innerHTML = '<span class="slp-op-icono">🆕</span><span><strong>Un producto nuevo</strong><small>Se crea también como producto del catálogo; te pido sus datos.</small></span>';
        b2.addEventListener('click', mostrarNuevo);
        var n = (typeof _lpForm !== 'undefined' && _lpForm[kActual]) ? _lpForm[kActual].length : 0;
        var listo = el('button', 'slp-btn-listo', n ? ('✔ Listo (' + n + ' en la lista)') : 'Cerrar'); listo.type = 'button';
        listo.addEventListener('click', cerrar);
        cuerpo.appendChild(info); cuerpo.appendChild(b1); cuerpo.appendChild(b2); cuerpo.appendChild(listo);
    }

    // ── Vista 2: productos que ya existen ──
    function productosCatalogo() {
        var filaEditando = (kActual === 'edit' && typeof _editFilaActual !== 'undefined') ? String(_editFilaActual) : null;
        var salida = [];
        document.querySelectorAll('.card-dinamica').forEach(function (card) {
            var nombre = (card.getAttribute('data-nombre') || '').trim();
            if (!nombre) return;
            if (filaEditando && card.getAttribute('data-sheet-row') === filaEditando) return;   // el producto que se está editando no puede estar en su propia lista
            var imgs = []; try { imgs = JSON.parse(card.getAttribute('data-imagenes') || '[]'); } catch (e) {}
            var img = (imgs[0] || '').trim();
            if (img && !/^https:\/\//i.test(img)) img = '';
            salida.push({ nombre: nombre, precio: card.getAttribute('data-precio') || '', img: img, modoRevisar: card.getAttribute('data-modo-precio') === 'revisar' });
        });
        return salida;
    }
    function yaEnLista(nombre) {
        return _lpForm[kActual].some(function (it) { return String(it.nombre).trim().toLowerCase() === nombre.trim().toLowerCase(); });
    }
    function mostrarExistentes() {
        ponerVista('existentes', '📚 Producto que ya existe');
        var buscar = el('input', 'panel-nombre-input slp-buscar'); buscar.type = 'search'; buscar.placeholder = 'Buscar producto por nombre…';
        var lista = el('div', 'slp-lista-exist');
        var todos = productosCatalogo();
        function pintar() {
            var q = buscar.value.trim().toLowerCase();
            lista.innerHTML = '';
            var coinc = todos.filter(function (p) { return !q || p.nombre.toLowerCase().indexOf(q) !== -1; });
            if (!coinc.length) { lista.appendChild(el('div', 'slp-vacio', todos.length ? 'No hay productos con ese nombre.' : 'El catálogo todavía no cargó o está vacío.')); return; }
            coinc.slice(0, 60).forEach(function (p) {
                var b = el('button', 'slp-item-exist'); b.type = 'button';
                var foto = el('span', 'slp-item-foto');
                if (p.img) { var im = document.createElement('img'); im.src = p.img; im.alt = ''; im.loading = 'lazy'; foto.appendChild(im); } else { foto.textContent = '🖼️'; }
                var txt = el('span', 'slp-item-txt');
                txt.appendChild(el('strong', '', p.nombre));
                txt.appendChild(el('small', '', p.modoRevisar ? 'Tiene lista de precios propia' : (p.precio ? '$' + p.precio + ' MXN' : 'Sin precio')));
                var marca = el('span', 'slp-item-marca', yaEnLista(p.nombre) ? '✓' : '＋');
                b.appendChild(foto); b.appendChild(txt); b.appendChild(marca);
                b.addEventListener('click', function () {
                    if (yaEnLista(p.nombre)) { aviso('«' + p.nombre + '» ya está en la lista'); return; }
                    if (_lpForm[kActual].length >= 40) { aviso('Máximo 40 productos en la lista'); return; }
                    _lpForm[kActual].push({ nombre: p.nombre, precio: p.modoRevisar ? '' : String(p.precio || ''), img: p.img, existente: true });
                    marca.textContent = '✓';
                    aviso('✅ «' + p.nombre + '» añadido. Revisa su precio en la lista.');
                });
                lista.appendChild(b);
            });
            if (coinc.length > 60) lista.appendChild(el('div', 'slp-vacio', 'Hay más resultados: escribe en el buscador para acotar.'));
        }
        buscar.addEventListener('input', pintar);
        var listo = el('button', 'slp-btn-listo', '✔ Listo'); listo.type = 'button'; listo.addEventListener('click', cerrar);
        cuerpo.appendChild(buscar); cuerpo.appendChild(lista); cuerpo.appendChild(listo);
        pintar();
    }

    // ── Vista 3: producto nuevo ──
    function checksDe(selector) {
        return Array.prototype.map.call(document.querySelectorAll(selector), function (c) {
            var sp = c.parentNode && c.parentNode.querySelector('span');
            return { valor: c.value, texto: sp ? sp.textContent : c.value };
        });
    }
    function campo(etiqueta, input) {
        var w = el('div', 'slp-campo'); w.appendChild(el('label', 'panel-nombre-label', etiqueta)); w.appendChild(input); return w;
    }
    function entrada(tipo, ph, extra) {
        var i = el('input', 'panel-nombre-input'); i.type = tipo; i.placeholder = ph || '';
        if (tipo === 'number') { i.min = '0'; i.step = 'any'; i.setAttribute('inputmode', 'decimal'); }
        if (extra) Object.keys(extra).forEach(function (k) { i[k] = extra[k]; });
        return i;
    }
    function grupoChecks(titulo, opciones, nombreGrupo) {
        var caja = el('div', 'slp-campo');
        caja.appendChild(el('label', 'panel-nombre-label', titulo));
        var grid = el('div', 'grid-checks-evento');
        opciones.forEach(function (o) {
            var l = el('label', 'check-evento-producto');
            var c = document.createElement('input'); c.type = 'checkbox'; c.value = o.valor; c.setAttribute('data-grupo', nombreGrupo);
            l.appendChild(c); l.appendChild(el('span', '', o.texto)); grid.appendChild(l);
        });
        caja.appendChild(grid);
        return caja;
    }
    function mostrarNuevo() {
        ponerVista('nuevo', '🆕 Producto nuevo');
        var imgData = null;

        // Imagen
        var zonaImg = el('div', 'slp-campo');
        zonaImg.appendChild(el('label', 'panel-nombre-label', 'Imagen del producto'));
        var previa = el('div', 'slp-previa', '🖼️');
        var inGal = document.createElement('input'); inGal.type = 'file'; inGal.accept = 'image/*'; inGal.style.display = 'none';
        var inCam = document.createElement('input'); inCam.type = 'file'; inCam.accept = 'image/*'; inCam.setAttribute('capture', 'environment'); inCam.style.display = 'none';
        var fila = el('div', 'slp-fila-btns');
        var bG = el('button', 'btn-nueva-etiqueta', '🖼️ Elegir de la galería'); bG.type = 'button'; bG.addEventListener('click', function () { inGal.click(); });
        var bC = el('button', 'btn-nueva-etiqueta', '📷 Tomar foto'); bC.type = 'button'; bC.addEventListener('click', function () { inCam.click(); });
        fila.appendChild(bG); fila.appendChild(bC);
        var estadoImg = el('div', 'slp-estado');
        function procesarArchivo(f) {
            if (!f) return;
            estadoImg.textContent = 'Convirtiendo imagen…'; estadoImg.className = 'slp-estado';
            _convertirArchivoImagenProducto(f).then(function (r) {
                imgData = r; previa.innerHTML = ''; var im = document.createElement('img'); im.src = r.dataUrl; im.alt = ''; previa.appendChild(im);
                estadoImg.textContent = '';
            }).catch(function (err) { estadoImg.textContent = String(err); estadoImg.className = 'slp-estado error'; });
        }
        function alElegir(ev) { var f = ev.target.files && ev.target.files[0]; ev.target.value = ''; procesarArchivo(f); }
        inGal.addEventListener('change', alElegir); inCam.addEventListener('change', alElegir);
        zonaImg.appendChild(previa); zonaImg.appendChild(fila); zonaImg.appendChild(estadoImg); zonaImg.appendChild(inGal); zonaImg.appendChild(inCam);

        // Arrastrar y soltar una imagen desde la carpeta de la computadora (los botones de siempre siguen igual)
        var hint = el('div', 'zona-soltar-hint', '⬇️ …o arrastra aquí tu imagen desde tus archivos');
        zonaImg.insertBefore(hint, estadoImg);
        zonaImg.classList.add('zona-soltar');
        function traeArchivos(e) {
            var t = e.dataTransfer && e.dataTransfer.types;
            if (!t) return false;
            for (var i = 0; i < t.length; i++) if (t[i] === 'Files') return true;
            return false;
        }
        var prof = 0;
        function quitarMarca() { prof = 0; zonaImg.classList.remove('arrastrando-archivos'); }
        zonaImg.addEventListener('dragenter', function (e) { if (!traeArchivos(e)) return; e.preventDefault(); prof++; zonaImg.classList.add('arrastrando-archivos'); });
        zonaImg.addEventListener('dragover', function (e) { if (!traeArchivos(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
        zonaImg.addEventListener('dragleave', function (e) { if (!traeArchivos(e)) return; prof = Math.max(0, prof - 1); if (!prof) quitarMarca(); });
        zonaImg.addEventListener('drop', function (e) {
            if (!traeArchivos(e)) return;
            e.preventDefault(); e.stopPropagation(); quitarMarca();
            var todos = Array.prototype.slice.call(e.dataTransfer.files || []);
            var imgs = todos.filter(function (f) { return /^image\//.test(f.type); });
            if (!imgs.length) { estadoImg.textContent = 'Solo se pueden soltar imágenes (JPG, PNG, WebP…).'; estadoImg.className = 'slp-estado error'; return; }
            if (imgs.length > 1) aviso('Cada producto nuevo lleva una sola imagen: se usó la primera.');
            procesarArchivo(imgs[0]);
        });

        var iNombre = entrada('text', 'Ej. Gato chico', { maxLength: 120 });
        var iPrecio = entrada('number', 'Ej. 150');
        var iMayoreo = entrada('number', 'Opcional');
        var iDesc = el('textarea', 'panel-nombre-input'); iDesc.rows = 3; iDesc.maxLength = 500; iDesc.placeholder = 'Opcional, describe el producto';
        var iAlto = entrada('text', 'Opcional, ej. 15 cm');
        var iAncho = entrada('text', 'Opcional, ej. 8 cm');
        var iStock = entrada('number', 'Opcional');
        var filaPrecios = el('div', 'fila-campos-dobles'); filaPrecios.appendChild(campo('Precio', iPrecio)); filaPrecios.appendChild(campo('Precio de mayoreo', iMayoreo));
        var filaMedidas = el('div', 'fila-campos-dobles'); filaMedidas.appendChild(campo('Alto', iAlto)); filaMedidas.appendChild(campo('Ancho', iAncho));

        var selP = kActual === 'edit' ? '.chk-etiqueta-principal-producto-edit' : '.chk-etiqueta-principal-producto';
        var selE = kActual === 'edit' ? '.chk-evento-producto-edit' : '.chk-evento-producto';
        var gP = grupoChecks('Etiqueta principal (elige una o varias)', checksDe(selP), 'principal');
        var gE = grupoChecks('Etiqueta de evento (opcional)', checksDe(selE), 'evento');

        var estado = el('div', 'slp-estado');
        var agregar = el('button', 'slp-btn-listo slp-btn-agregar', '➕ Agregar a la lista'); agregar.type = 'button';
        agregar.addEventListener('click', function () {
            var nombre = iNombre.value.replace(/[\r\n\t]+/g, ' ').trim();
            var precio = iPrecio.value.trim(), mayoreo = iMayoreo.value.trim(), stock = iStock.value.trim();
            function error(m) { estado.textContent = m; estado.className = 'slp-estado error'; }
            if (!imgData) return error('Agrega la imagen del producto.');
            if (!nombre) return error('Escribe el nombre del producto.');
            if (precio === '' || isNaN(Number(precio)) || Number(precio) < 0) return error('Escribe un precio válido.');
            if (mayoreo !== '' && (isNaN(Number(mayoreo)) || Number(mayoreo) < 0)) return error('El precio de mayoreo debe ser un número válido.');
            if (stock !== '' && (isNaN(Number(stock)) || Number(stock) < 0)) return error('La existencia debe ser un número.');
            if (yaEnLista(nombre)) return error('Ya hay un producto con ese nombre en la lista.');
            if (_lpForm[kActual].length >= 40) return error('Máximo 40 productos en la lista.');
            var principales = Array.prototype.map.call(gP.querySelectorAll('input:checked'), function (c) { return c.value; }).join('|');
            var eventos = Array.prototype.map.call(gE.querySelectorAll('input:checked'), function (c) { return c.value; }).join('|');
            _lpForm[kActual].push({
                nombre: nombre, precio: precio, img: '', imgData: imgData, creado: false,
                nuevo: { precio: precio, mayoreo: mayoreo, descripcion: iDesc.value.trim(), alto: iAlto.value.trim(), ancho: iAncho.value.trim(),
                         existencia: stock, etiquetaPrincipal: principales, etiquetaEvento: eventos }
            });
            aviso('✅ «' + nombre + '» se creará como producto nuevo al guardar');
            mostrarMenu();
        });

        cuerpo.appendChild(zonaImg);
        cuerpo.appendChild(campo('Nombre del producto', iNombre));
        cuerpo.appendChild(filaPrecios);
        cuerpo.appendChild(campo('Descripción', iDesc));
        cuerpo.appendChild(filaMedidas);
        cuerpo.appendChild(campo('Existencia (piezas)', iStock));
        cuerpo.appendChild(gP); cuerpo.appendChild(gE);
        cuerpo.appendChild(el('p', 'slp-info', 'El producto se crea en el catálogo al presionar «Guardar» en el producto principal. Los demás datos (oferta, video, etc.) se pueden completar después con ⚙️ Editar.'));
        cuerpo.appendChild(estado); cuerpo.appendChild(agregar);
    }

    window.abrirSubmenuListaPrecios = abrir;

    // ── Ver en grande la imagen de un artículo (submenú público «Revisar precios») ──
    window.abrirVisorImagenLista = function (src, nombre) {
        var v = el('div', 'slp-visor');
        var im = document.createElement('img'); im.src = src; im.alt = nombre || '';
        var cap = el('div', 'slp-visor-cap', nombre || '');
        v.appendChild(im); v.appendChild(cap);
        v.addEventListener('click', function () { v.remove(); });
        document.body.appendChild(v);
    };
})();
