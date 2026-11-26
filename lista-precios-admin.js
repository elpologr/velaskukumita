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
    function abrir(k, itemEditar) {
        kActual = (k === 'edit') ? 'edit' : 'add';
        construir();
        if (itemEditar && itemEditar.nuevo && !itemEditar.creado) mostrarNuevo(itemEditar); else mostrarMenu();
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
        b2.addEventListener('click', function () { mostrarNuevo(); });   // sin pasar el evento del clic como si fuera un producto a editar
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
    // Los nombres pueden repetirse: un producto «ya está en la lista» solo si es el mismo (mismo nombre Y misma imagen).
    function yaEnLista(p) {
        var n = String(p.nombre).trim().toLowerCase(), im = String(p.img || '').trim();
        return _lpForm[kActual].some(function (it) { return it.existente && String(it.nombre).trim().toLowerCase() === n && String(it.img || '').trim() === im; });
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
                var marca = el('span', 'slp-item-marca', yaEnLista(p) ? '✓' : '＋');
                b.appendChild(foto); b.appendChild(txt); b.appendChild(marca);
                b.addEventListener('click', function () {
                    if (yaEnLista(p)) { aviso('«' + p.nombre + '» ya está en la lista'); return; }
                    if (_lpForm[kActual].length >= 40) { aviso('Máximo 40 productos en la lista'); return; }
                    _lpForm[kActual].push({ nombre: p.nombre, precio: p.modoRevisar ? '' : String(p.precio || ''), img: p.img, existente: true });
                    if (typeof _lpRender === 'function') _lpRender(kActual);
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
    function mostrarNuevo(editItem) {   // editItem: producto nuevo que ya estaba en la lista y se vuelve a editar
        if (!editItem || !editItem.nuevo || editItem.creado) editItem = null;
        ponerVista('nuevo', editItem ? '✏️ Editar producto de la lista' : '🆕 Producto nuevo');
        var imgData = null;
        var enfX = 50, enfY = 0;   // zona de la imagen que se verá en el catálogo (igual que en «Agregar producto»)

        // Imagen
        var zonaImg = el('div', 'slp-campo');
        zonaImg.appendChild(el('label', 'panel-nombre-label', 'Imagen del producto'));
        var previa = el('div', 'slp-previa', '🖼️');
        var iTexto = entrada('text', 'Opcional, ej. ¡Nuevo!, Edición limitada', { maxLength: 60 });
        // Igual que en «Agregar producto»: arranca con «¡  !» y el cursor entre los dos espacios; si se deja así cuenta como «sin texto»
        var plantilla = (typeof _TEXTO_IMG_PLANTILLA === 'string') ? _TEXTO_IMG_PLANTILLA : '\u00A1  !';
        iTexto.value = plantilla;
        function alCentro() { if (iTexto.value === plantilla) { try { iTexto.setSelectionRange(2, 2); } catch (e) { } } }
        iTexto.addEventListener('focus', function () { setTimeout(alCentro, 0); });
        iTexto.addEventListener('click', alCentro);
        function textoActual() { return (typeof _normalizarTextoImagen === 'function') ? _normalizarTextoImagen(iTexto.value) : iTexto.value.trim(); }
        // Miniatura con la imagen COMPLETA y un cuadro 1:1 que se arrastra para elegir lo que se ve en las tarjetas del catálogo
        // (mismo funcionamiento que la miniatura de «Agregar producto»). La imagen que se sube va completa: el cuadro solo guarda un punto de enfoque.
        var caja = el('div', 'miniatura-principal slp-mini'); caja.style.display = 'none'; caja.style.width = 'min(100%, 220px)';
        var imgM = document.createElement('img'); imgM.alt = ''; imgM.draggable = false;
        var cuadro = el('div', 'recorte-cuadro');
        var tPrev = el('div', 'recorte-texto-preview');
        cuadro.appendChild(tPrev); caja.appendChild(imgM); caja.appendChild(cuadro);
        var hintMini = el('span', 'miniatura-principal-hint', 'Arrastra el cuadro para elegir lo que se ve en el catálogo'); hintMini.hidden = true;
        function posicionar() {
            if (!imgData) return;
            var lado = caja.clientWidth || 0;
            if (!lado) return;
            cuadro.style.height = lado + 'px';
            var maxTop = Math.max(0, caja.clientHeight - lado);
            cuadro.style.top = ((enfY / 100) * maxTop) + 'px';
            var t = textoActual();
            tPrev.textContent = t;
            tPrev.style.display = t ? 'block' : 'none';
            if (t && typeof _ajustarTextoUnaLinea === 'function') {
                var esc = (typeof _TEXTO_IMG_ESCALA === 'number') ? _TEXTO_IMG_ESCALA : 0.07;
                tPrev.style.fontSize = (lado * esc) + 'px';
                _ajustarTextoUnaLinea(tPrev, lado * esc, lado * esc * 0.75);
            }
        }
        imgM.onload = posicionar;
        var arrastrando = false;
        function moverA(clientY) {
            var rect = caja.getBoundingClientRect(), lado = caja.clientWidth || 92;
            var maxTop = Math.max(0, rect.height - lado);
            var top = Math.max(0, Math.min(maxTop, (clientY - rect.top) - lado / 2));
            enfY = maxTop > 0 ? Math.round((top / maxTop) * 100) : 0;
            cuadro.style.top = top + 'px';
        }
        caja.addEventListener('pointerdown', function (e) {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            arrastrando = true; try { caja.setPointerCapture(e.pointerId); } catch (x) { }
            moverA(e.clientY); e.preventDefault();
        });
        caja.addEventListener('pointermove', function (e) { if (arrastrando) { moverA(e.clientY); e.preventDefault(); } });
        function soltar() { arrastrando = false; }
        caja.addEventListener('pointerup', soltar); caja.addEventListener('pointercancel', soltar);
        function pintarPrevia() {
            if (!imgData) { previa.style.display = ''; caja.style.display = 'none'; hintMini.hidden = true; bRecorte.hidden = true; return; }
            previa.style.display = 'none'; caja.style.display = ''; hintMini.hidden = false; bRecorte.hidden = false;
            if (imgM.getAttribute('src') !== imgData.dataUrl) imgM.src = imgData.dataUrl;
            posicionar();
        }
        var inGal = document.createElement('input'); inGal.type = 'file'; inGal.accept = 'image/*'; inGal.style.display = 'none';
        var inCam = document.createElement('input'); inCam.type = 'file'; inCam.accept = 'image/*'; inCam.setAttribute('capture', 'environment'); inCam.style.display = 'none';
        var fila = el('div', 'slp-fila-btns');
        var bG = el('button', 'btn-nueva-etiqueta', '🖼️ Elegir de la galería'); bG.type = 'button'; bG.addEventListener('click', function () { inGal.click(); });
        var bC = el('button', 'btn-nueva-etiqueta', '📷 Tomar foto'); bC.type = 'button'; bC.addEventListener('click', function () { inCam.click(); });
        fila.appendChild(bG); fila.appendChild(bC);
        var bRecorte = el('button', 'btn-nueva-etiqueta', '✂️ Elegir qué se ve en el catálogo'); bRecorte.type = 'button'; bRecorte.hidden = true;
        bRecorte.addEventListener('click', function () {
            if (!imgData || typeof abrirModalRecorteImagen !== 'function') return;
            var ov = document.getElementById('overlayRecorteImagen');
            if (ov) ov.style.zIndex = '21500';   // por encima de este submenú
            abrirModalRecorteImagen(imgData.dataUrl, enfX, enfY, function (x, y) { enfX = x; enfY = y; pintarPrevia(); }, true, textoActual());
        });
        iTexto.addEventListener('input', pintarPrevia);
        var estadoImg = el('div', 'slp-estado');
        function procesarArchivo(f) {
            if (!f) return;
            estadoImg.textContent = 'Convirtiendo imagen…'; estadoImg.className = 'slp-estado';
            _convertirArchivoImagenProducto(f).then(function (r) {
                imgData = r; enfX = 50; enfY = 0; imgM.removeAttribute('src'); pintarPrevia();
                estadoImg.textContent = '';
            }).catch(function (err) { estadoImg.textContent = String(err); estadoImg.className = 'slp-estado error'; });
        }
        function alElegir(ev) { var f = ev.target.files && ev.target.files[0]; ev.target.value = ''; procesarArchivo(f); }
        inGal.addEventListener('change', alElegir); inCam.addEventListener('change', alElegir);
        zonaImg.appendChild(previa); zonaImg.appendChild(caja); zonaImg.appendChild(hintMini); zonaImg.appendChild(fila); zonaImg.appendChild(bRecorte); zonaImg.appendChild(estadoImg); zonaImg.appendChild(inGal); zonaImg.appendChild(inCam);

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
        // «Sin precio»: el producto se crea ya y el precio se pone en otra ocasión
        var lblSP = el('label', 'lp-chk-sinprecio'); var chkSP = document.createElement('input'); chkSP.type = 'checkbox';
        lblSP.appendChild(chkSP); lblSP.appendChild(el('span', '', 'Sin precio (lo pondré en otra ocasión)'));
        chkSP.addEventListener('change', function () { iPrecio.disabled = chkSP.checked; iMayoreo.disabled = chkSP.checked; if (chkSP.checked) { iPrecio.value = ''; iMayoreo.value = ''; } });
        var filaMedidas = el('div', 'fila-campos-dobles'); filaMedidas.appendChild(campo('Alto', iAlto)); filaMedidas.appendChild(campo('Ancho', iAncho));

        var selP = kActual === 'edit' ? '.chk-etiqueta-principal-producto-edit' : '.chk-etiqueta-principal-producto';
        var selE = kActual === 'edit' ? '.chk-evento-producto-edit' : '.chk-evento-producto';
        var gP = grupoChecks('Etiqueta principal (elige una o varias)', checksDe(selP), 'principal');
        var gE = grupoChecks('Etiqueta de evento (opcional)', checksDe(selE), 'evento');

        // Etiquetas como dos botones desplegables (igual que en «Agregar producto»): al abrir uno se pliega el otro
        function botonAcordeon(texto, cls) {
            var b = el('button', 'acordeon-btn ' + cls); b.type = 'button'; b.setAttribute('aria-expanded', 'false');
            var c = el('span', 'ac-cuenta'); c.hidden = true;
            var f = el('span', 'ac-flecha', '▾'); f.setAttribute('aria-hidden', 'true');
            b.appendChild(el('span', 'ac-texto', texto)); b.appendChild(c); b.appendChild(f);
            return b;
        }
        var bAcP = botonAcordeon('🏷️ Etiqueta principal', 'ac-principal'), bAcE = botonAcordeon('🎉 Etiqueta de evento', 'ac-evento');
        var filaAc = el('div', 'acordeon-etiquetas'); filaAc.appendChild(bAcP); filaAc.appendChild(bAcE);
        [gP, gE].forEach(function (g) { if (g.firstChild && g.firstChild.tagName === 'LABEL') g.removeChild(g.firstChild); g.classList.add('acordeon-panel'); });
        var abiertoAc = null;
        function mostrarAc(cual) {
            abiertoAc = cual;
            gP.hidden = cual !== 'p'; gE.hidden = cual !== 'e';
            bAcP.setAttribute('aria-expanded', cual === 'p' ? 'true' : 'false');
            bAcE.setAttribute('aria-expanded', cual === 'e' ? 'true' : 'false');
        }
        function cuentaAc(b, n) { var c = b.querySelector('.ac-cuenta'); c.textContent = String(n); c.hidden = !n; }
        function contarAc() { cuentaAc(bAcP, gP.querySelectorAll('input:checked').length); cuentaAc(bAcE, gE.querySelectorAll('input:checked').length); }
        bAcP.addEventListener('click', function () { mostrarAc(abiertoAc === 'p' ? null : 'p'); });
        bAcE.addEventListener('click', function () { mostrarAc(abiertoAc === 'e' ? null : 'e'); });
        gP.addEventListener('change', contarAc); gE.addEventListener('change', contarAc);
        mostrarAc(null); contarAc();

        // Al volver a editar un producto de la lista, se cargan sus datos
        if (editItem) {
            var n0 = editItem.nuevo || {};
            imgData = editItem.imgData || null;
            var pe = String(n0.enfoque || '').split(',');
            if (!isNaN(parseFloat(pe[0])) && !isNaN(parseFloat(pe[1]))) { enfX = parseFloat(pe[0]); enfY = parseFloat(pe[1]); }
            iNombre.value = editItem.nombre || '';
            iPrecio.value = String(editItem.precio === undefined ? '' : editItem.precio);
            iMayoreo.value = n0.mayoreo || ''; iDesc.value = n0.descripcion || '';
            iAlto.value = n0.alto || ''; iAncho.value = n0.ancho || ''; iStock.value = n0.existencia || '';
            iTexto.value = n0.textoImagen || plantilla;
            if (editItem.sinPrecio) { chkSP.checked = true; iPrecio.value = ''; iMayoreo.value = ''; iPrecio.disabled = true; iMayoreo.disabled = true; }
            function marcar(g, lista) {
                var v = String(lista || '').split('|').filter(Boolean);
                Array.prototype.forEach.call(g.querySelectorAll('input[type="checkbox"]'), function (c) { c.checked = v.indexOf(c.value) !== -1; });
            }
            marcar(gP, n0.etiquetaPrincipal); marcar(gE, n0.etiquetaEvento); contarAc();
        }
        var estado = el('div', 'slp-estado');
        var agregar = el('button', 'slp-btn-listo slp-btn-agregar', editItem ? '💾 Guardar cambios' : '➕ Agregar a la lista'); agregar.type = 'button';
        agregar.addEventListener('click', function () {
            var nombre = iNombre.value.replace(/[\r\n\t]+/g, ' ').trim();
            var sinPrecio = chkSP.checked;
            var precio = sinPrecio ? '' : iPrecio.value.trim(), mayoreo = sinPrecio ? '' : iMayoreo.value.trim(), stock = iStock.value.trim();
            function error(m) { estado.textContent = m; estado.className = 'slp-estado error'; }
            if (!imgData) return error('Agrega la imagen del producto.');
            if (!nombre) return error('Escribe el nombre del producto.');
            if (!sinPrecio && (precio === '' || isNaN(Number(precio)) || Number(precio) < 0)) return error('Escribe un precio válido o marca «Sin precio».');
            if (mayoreo !== '' && (isNaN(Number(mayoreo)) || Number(mayoreo) < 0)) return error('El precio de mayoreo debe ser un número válido.');
            if (stock !== '' && (isNaN(Number(stock)) || Number(stock) < 0)) return error('La existencia debe ser un número.');
            if (!editItem && _lpForm[kActual].length >= 40) return error('Máximo 40 productos en la lista.');
            var principales = Array.prototype.map.call(gP.querySelectorAll('input:checked'), function (c) { return c.value; }).join('|');
            var eventos = Array.prototype.map.call(gE.querySelectorAll('input:checked'), function (c) { return c.value; }).join('|');
            var datosNuevo = { textoImagen: textoActual().substring(0, 60), enfoque: enfX + ',' + enfY, precio: precio, mayoreo: mayoreo, descripcion: iDesc.value.trim(), alto: iAlto.value.trim(), ancho: iAncho.value.trim(),
                         existencia: stock, etiquetaPrincipal: principales, etiquetaEvento: eventos };
            if (editItem) {
                editItem.nombre = nombre; editItem.precio = precio; editItem.sinPrecio = sinPrecio; editItem.imgData = imgData; editItem.nuevo = datosNuevo;
                aviso('✅ Cambios guardados en «' + nombre + '»');
                cerrar();   // vuelve a la lista del formulario ya actualizada
                return;
            }
            _lpForm[kActual].push({ nombre: nombre, precio: precio, sinPrecio: sinPrecio, img: '', imgData: imgData, creado: false, nuevo: datosNuevo });
            if (typeof _lpRender === 'function') _lpRender(kActual);   // la lista del formulario se actualiza al instante
            aviso('✅ «' + nombre + '» se creará como producto nuevo al guardar');
            mostrarMenu();
        });

        cuerpo.appendChild(zonaImg);
        cuerpo.appendChild(campo('Nombre del producto', iNombre));
        cuerpo.appendChild(campo('Texto sobre la imagen (opcional)', iTexto));
        cuerpo.appendChild(filaPrecios);
        cuerpo.appendChild(lblSP);
        var campoDesc = campo('Descripción', iDesc);
        cuerpo.appendChild(campoDesc);
        if (typeof window.montarDescripcionesFijas === 'function') window.montarDescripcionesFijas(iDesc);   // botones de descripciones fijas (marcan también la etiqueta del mismo nombre)
        cuerpo.appendChild(filaMedidas);
        cuerpo.appendChild(campo('Existencia (piezas)', iStock));
        cuerpo.appendChild(filaAc); cuerpo.appendChild(gP); cuerpo.appendChild(gE);
        cuerpo.appendChild(el('p', 'slp-info', 'El producto se crea en el catálogo al presionar «Guardar» en el producto principal. Los demás datos (oferta, video, etc.) se pueden completar después con ⚙️ Editar.'));
        cuerpo.appendChild(estado); cuerpo.appendChild(agregar);
        if (editItem) { pintarPrevia(); setTimeout(pintarPrevia, 0); }   // ya con medidas: coloca el cuadro y el texto de la imagen
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
