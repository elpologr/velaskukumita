// ============================================================
// YESOS KUKÚMITA — app.js
// JavaScript extraído y organizado desde index.html.
// Incluye:
//   - cargarCatalogo()  : fetch dinámico desde Google Sheets CSV
//   - Drawer lateral
//   - Modales (Producto, QR, Bazar, Uber, Tienda)
//   - Sistema de Favoritos y Carrito
//   - Filtros de productos
//   - Paginación
//   - Compartir (WhatsApp, Facebook, Instagram)
//   - Modo Oscuro, Píldoras, Carruseles, etc.
// ============================================================

// ── Helper: ejecuta fn cuando el DOM esté listo (funciona aunque DOMContentLoaded ya disparó) ──
function _ready(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
    } else {
        fn();
    }
}

// ── DATOS DE VIDEOS POR RED SOCIAL ──
// Reemplaza los IDs de YouTube/URLs con los tuyos reales
var _videosRedes = {
    youtube: [
        // Formato: { tipo: 'youtube', id: 'VIDEO_ID', titulo: 'Título' }
        { tipo: 'youtube', id: 'dQw4w9WgXcQ', titulo: 'Video de YouTube 1' },
        { tipo: 'youtube', id: 'dQw4w9WgXcQ', titulo: 'Video de YouTube 2' },
        { tipo: 'youtube', id: 'dQw4w9WgXcQ', titulo: 'Video de YouTube 3' },
        { tipo: 'youtube', id: 'dQw4w9WgXcQ', titulo: 'Video de YouTube 4' },
        { tipo: 'youtube', id: 'dQw4w9WgXcQ', titulo: 'Video de YouTube 5' },
        { tipo: 'youtube', id: 'dQw4w9WgXcQ', titulo: 'Video de YouTube 6' }
    ],
    facebook: [
        // Formato: { tipo: 'facebook', url: 'URL_DEL_VIDEO', titulo: 'Título' }
        // Para videos de Facebook usa la URL completa del video público
        // Ejemplo: { tipo: 'facebook', url: 'https://www.facebook.com/velaskukumita/videos/123456789', titulo: 'Video FB 1' }
    ],
    instagram: [
        // Formato: { tipo: 'instagram', url: 'URL_DEL_REEL', titulo: 'Título' }
        // Ejemplo: { tipo: 'instagram', url: 'https://www.instagram.com/p/CODIGO/', titulo: 'Reel 1' }
    ],
    tiktok: [
        // Formato: { tipo: 'tiktok', url: 'URL_DEL_VIDEO', titulo: 'Título' }
        // Ejemplo: { tipo: 'tiktok', url: 'https://www.tiktok.com/@velaskukumita/video/123456', titulo: 'TikTok 1' }
    ]
};

var _redActiva = null;

function filtrarVideosRed(red) {
    // Si ya está activa la misma red, colapsar
    if (_redActiva === red) {
        _redActiva = null;
        document.getElementById('panelVideosRedes').style.display = 'none';
        _resetBotonesRed();
        detenerTodosLosVideos();
        return;
    }
    _redActiva = red;
    detenerTodosLosVideos();
    _resetBotonesRed();

    // Marcar botón activo con borde más fuerte
    var ids = { youtube:'btnRedYT', facebook:'btnRedFB', instagram:'btnRedIG', tiktok:'btnRedTT' };
    var btn = document.getElementById(ids[red]);
    if (btn) btn.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.18)';

    var videos = (_videosRedes[red] || []).slice(0, 6);
    var grid = document.getElementById('gridVideosRedes');
    grid.innerHTML = '';

    if (videos.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:28px; color:#aaa; font-size:0.9rem;">Próximamente agregaremos videos de esta red social. 🎬</div>';
    } else {
        videos.forEach(function(v, i) {
            var celda = document.createElement('div');
            celda.style.cssText = 'border-radius:10px; overflow:hidden; background:#111; position:relative; aspect-ratio:16/9;';

            if (v.tipo === 'youtube') {
                // Thumbnail clicable → carga iframe solo al hacer clic
                celda.innerHTML =
                    '<div class="video-thumb-wrap" data-videoidx="' + i + '" style="width:100%;height:100%;cursor:pointer;position:relative;" onclick="cargarVideoInline(this,' + JSON.stringify(v).replace(/"/g,'&quot;') + ')">' +
                    '<img src="https://img.youtube.com/vi/' + v.id + '/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy">' +
                    '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.28);">' +
                    '<div style="width:52px;height:52px;background:rgba(255,0,0,0.88);border-radius:50%;display:flex;align-items:center;justify-content:center;">' +
                    '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div></div>' +
                    (v.titulo ? '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));color:white;font-size:0.7rem;padding:14px 8px 6px;font-weight:600;">' + v.titulo + '</div>' : '') +
                    '</div>';
            } else {
                // Facebook / Instagram / TikTok — placeholder con botón abrir en nueva pestaña
                celda.style.cssText += 'display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1a1a2e;';
                var iconos = { facebook:'🎬', instagram:'🎞️', tiktok:'🎵' };
                celda.innerHTML =
                    '<div style="font-size:2rem;margin-bottom:8px;">' + (iconos[v.tipo]||'▶️') + '</div>' +
                    '<div style="color:#ccc;font-size:0.75rem;text-align:center;padding:0 8px;margin-bottom:10px;">' + (v.titulo || 'Ver video') + '</div>' +
                    '<a href="' + v.url + '" target="_blank" style="background:rgba(255,255,255,0.15);color:white;border:1.5px solid rgba(255,255,255,0.3);border-radius:20px;padding:7px 16px;font-size:0.78rem;font-weight:700;text-decoration:none;font-family:inherit;">Ver video ↗</a>';
            }
            grid.appendChild(celda);
        });
    }

    document.getElementById('panelVideosRedes').style.display = 'block';
}

function cargarVideoInline(wrap, v) {
    // Detener todos los otros iframes activos
    detenerTodosLosVideos();
    var iframe = document.createElement('iframe');
    iframe.src = 'https://www.youtube.com/embed/' + v.id + '?autoplay=1&rel=0';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.allowFullscreen = true;
    iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;';
    iframe.setAttribute('allowfullscreen','');
    wrap.parentElement.innerHTML = '';
    wrap.parentElement.appendChild(iframe);
}

function detenerTodosLosVideos() {
    document.querySelectorAll('#gridVideosRedes iframe').forEach(function(f) {
        var src = f.src;
        f.src = '';
        f.src = src.replace('?autoplay=1', '?autoplay=0').replace('&autoplay=1','');
    });
    // Reemplazar iframes activos con el thumbnail otra vez si el panel está visible
    var grid = document.getElementById('gridVideosRedes');
    if (grid && _redActiva) {
        var videos = (_videosRedes[_redActiva] || []).slice(0, 6);
        var iframes = grid.querySelectorAll('iframe');
        iframes.forEach(function(f) {
            var celda = f.parentElement;
            var idx = Array.from(grid.children).indexOf(celda);
            if (idx >= 0 && videos[idx] && videos[idx].tipo === 'youtube') {
                var v = videos[idx];
                celda.innerHTML =
                    '<div class="video-thumb-wrap" style="width:100%;height:100%;cursor:pointer;position:relative;" onclick="cargarVideoInline(this,' + JSON.stringify(v).replace(/"/g,'&quot;') + ')">' +
                    '<img src="https://img.youtube.com/vi/' + v.id + '/hqdefault.jpg" style="width:100%;height:100%;object-fit:cover;display:block;">' +
                    '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.28);">' +
                    '<div style="width:52px;height:52px;background:rgba(255,0,0,0.88);border-radius:50%;display:flex;align-items:center;justify-content:center;">' +
                    '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg></div></div>' +
                    (v.titulo ? '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));color:white;font-size:0.7rem;padding:14px 8px 6px;font-weight:600;">' + v.titulo + '</div>' : '') +
                    '</div>';
            }
        });
    }
}

function _resetBotonesRed() {
    ['btnRedYT','btnRedFB','btnRedIG','btnRedTT'].forEach(function(id){
        var b = document.getElementById(id);
        if (b) b.style.boxShadow = 'none';
    });
}



// ══════════════════════════════════════════════════════════════════════════════
// CATÁLOGO DESDE GOOGLE SHEETS
// ──────────────────────────────────────────────────────────────────────────────
// Los productos se cargan automáticamente desde tu hoja de cálculo pública.
// Para editar productos: abre el link de Google Sheets y modifica las filas.
//
// 🔧 CONFIGURACIÓN — cambia solo esta línea si mueves la hoja:
var SHEET_ID = '1GoIVWBIyl9s0wYo2qyv0GQwco_xBl3sajDwF0qcnf5o';

// 🔧 URL del Cloudflare Worker para compartir en redes sociales (Facebook, etc.)
// Cuando instales el worker, reemplaza esta URL con la que te asigne Cloudflare.
// Ejemplo: 'https://kukumita-og.TU-USUARIO.workers.dev'
// Mientras no lo tengas configurado, deja el valor vacío ('') y funcionará
// como antes (sin imagen en Facebook).
var OG_WORKER_URL = 'https://cool-river-013e.dulceprincesa086.workers.dev';
// ──────────────────────────────────────────────────────────────────────────────
// COLUMNAS ESPERADAS EN LA HOJA (fila 1 = encabezados, datos desde fila 2):
//   A(0):  Nombre
//   B(1):  precio
//   C(2):  precio mayoreo
//   D(3):  Descripcion
//   E(4):  video youtube
//   F(5):  Imagen
//   G(6):  EtiquetaPrincipal
//   H(7):  SubEtiqueta
//   I(8):  EtiquetaEvento
//   J(9):  en oferta          (escribe "si" para activar)
//   K(10): mas vendido        (escribe "si" para activar)
//   L(11): Alto
//   M(12): Ancho
//   N(13): SubImagen          (URLs separadas por coma)
//   O(14): youtube img/vid
//   P(15): existencia         (número de piezas en stock)
// ══════════════════════════════════════════════════════════════════════════════

var listaProductos = [];

// ── Parser de CSV que maneja campos entre comillas con comas internas ──
function parsearCSV(texto) {
    var lineas = [];
    var filaActual = [];
    var campoActual = '';
    var dentroDeComillas = false;

    for (var i = 0; i < texto.length; i++) {
        var c = texto[i];
        if (c === '"') {
            if (dentroDeComillas && texto[i + 1] === '"') {
                campoActual += '"';
                i++;
            } else {
                dentroDeComillas = !dentroDeComillas;
            }
        } else if (c === ',' && !dentroDeComillas) {
            filaActual.push(campoActual.trim());
            campoActual = '';
        } else if ((c === '\n' || c === '\r') && !dentroDeComillas) {
            if (c === '\r' && texto[i + 1] === '\n') i++;
            filaActual.push(campoActual.trim());
            if (filaActual.some(function(f) { return f !== ''; })) {
                lineas.push(filaActual);
            }
            filaActual = [];
            campoActual = '';
        } else {
            campoActual += c;
        }
    }
    // Última celda
    filaActual.push(campoActual.trim());
    if (filaActual.some(function(f) { return f !== ''; })) lineas.push(filaActual);
    return lineas;
}

// ── Convierte filas CSV en objetos de producto ──
function csvAProductos(filas) {
    if (filas.length < 2) return [];
    // Omitir la fila de encabezados (fila 0)
    var productos = [];
    for (var i = 1; i < filas.length; i++) {
        var f = filas[i];
        var get = function(idx) { return (f[idx] || '').trim(); };

        // Saltar filas sin nombre
        if (!get(0)) continue;

        // Nuevo orden de columnas (Google Sheets):
        // A=0  nombre
        // B=1  precio
        // C=2  precioMayoreo (antes precioBazar)
        // D=3  descripcion
        // E=4  video youtube
        // F=5  Imagen (URL principal + extras separadas por coma)
        // G=6  EtiquetaPrincipal
        // H=7  SubEtiqueta
        // I=8  EtiquetaEvento
        // J=9  en oferta  (si / vacío)
        // K=10 mas vendido (si / vacío)
        // L=11 Alto
        // M=12 Ancho
        // N=13 SubImagen (URLs o nombres separados por coma)
        // O=14 youtube img/vid
        // P=15 existencia (número de piezas en stock)

        // Video principal (E=4)
        var videoPrincipal = get(4).replace(/^"+|"+$/g, '').trim();

        // Imágenes: columna F=5
        var _rawImg = get(5).replace(/^"+|"+$/g, '').trim();
        var imagenesExtra = _rawImg
            ? _rawImg.split(',').map(function(s) { return s.trim().replace(/^"+|"+$/g, ''); }).filter(Boolean)
            : [];

        // EtiquetaPrincipal G=6
        var _rawTipos = get(6).replace(/^"+|"+$/g, '').trim();
        var tiposArray = _rawTipos
            ? _rawTipos.split(/[|,]/).map(function(s) { return s.trim().replace(/^"+|"+$/g, '').toLowerCase(); }).filter(Boolean)
            : ['arreglo'];
        var tipoPrincipal = tiposArray[0] || 'arreglo';

        // Oferta y Más Vendido (J=9, K=10)
        var enOferta   = get(9).toLowerCase()  === 'si' ? 1 : 0;
        var masVendido = get(10).toLowerCase() === 'si' ? 1 : 0;

        // Existencia (P=15)
        var existencia = parseInt(get(15).replace(/[^0-9]/g, '')) || 0;

        // YouTube img/vid (O=14)
        function parsearRed(idx) {
            var raw = get(idx).replace(/^"+|"+$/g, '').trim();
            return raw ? raw.split(',').map(function(s){ return s.trim().replace(/^"+|"+$/g, ''); }).filter(Boolean) : [];
        }
        var redYoutube = parsearRed(14);

        productos.push({
            id:           i,
            nombre:       get(0),
            precioNormal: parseFloat(get(1).replace(/[^0-9.]/g, '')) || 0,
            precioBazar:  parseFloat(get(2).replace(/[^0-9.]/g, '')) || 0,
            descripcion:  get(3),
            video:        videoPrincipal,
            imagen:       imagenesExtra[0] || '',
            imagenes:     imagenesExtra,
            forma:        '',
            tipo:         tipoPrincipal,
            tipos:        tiposArray,
            subtags:      get(7) ? get(7).split(',').map(function(s){ return s.trim(); }).filter(Boolean).join('|') : '',
            eventos:      get(8)
                            ? get(8).split(',').map(function(s){ return s.trim().toLowerCase(); }).filter(Boolean).join(' ')
                            : '',
            etiquetas:    tiposArray,
            aditivos:     [],
            oferta:       enOferta,
            masVendido:   masVendido,
            alto:         get(11),
            ancho:        get(12),
            existencia:   existencia,
            redYoutube:   redYoutube,
            redFacebook:  [],
            redInstagram: [],
            redTiktok:    [],
            subImagenes:  (function() {
                // Columna N (índice 13): SubImagen — valores separados por coma
                var rawSub = (f[13] || '').trim().replace(/^"+|"+$/g, '').trim();
                return rawSub
                    ? rawSub.split(',').map(function(s){ return s.trim().replace(/^"+|"+$/g, ''); }).filter(Boolean)
                    : [];
            })()
        });
    }
    return productos;
}

// ── Mostrar estado de carga en el grid ──
function mostrarEstadoCarga(mensaje, esError) {
    var grid = document.getElementById('gridProductos');
    if (!grid) return;
    grid.innerHTML =
        '<div style="grid-column:1/-1; text-align:center; padding:60px 20px; color:' +
        (esError ? '#c0392b' : '#8c7565') + ';">' +
        '<div style="font-size:2rem; margin-bottom:12px;">' + (esError ? '⚠️' : '⏳') + '</div>' +
        '<p style="font-size:1rem; font-weight:600;">' + mensaje + '</p>' +
        (esError ? '<p style="font-size:0.85rem; color:#999; margin-top:8px;">Revisa que la hoja esté publicada como CSV en Google Sheets.</p>' : '') +
        '</div>';
}

// ══════════════════════════════════════════════════════════════════════════════
// renderizarCatalogoCompleto()
// Lee listaProductos y genera dinámicamente cada tarjeta .card-dinamica
// ══════════════════════════════════════════════════════════════════════════════
function renderizarCatalogoCompleto() {
    var grid = document.getElementById('gridProductos');
    if (!grid) { console.warn('renderizarCatalogoCompleto: #gridProductos no encontrado'); return; }
    grid.innerHTML = '';

    listaProductos.forEach(function(p) {
        var card = document.createElement('div');
        card.className = 'card-dinamica';

        // ── Data-attributes necesarios para filtros y modal ──
        card.setAttribute('data-num',             String(p.id));
        card.setAttribute('data-idx',             String(p.id));
        card.setAttribute('data-sheet-row',       String(p.id + 1));
        card.setAttribute('data-forma',           p.forma || '');
        card.setAttribute('data-evento',          p.eventos || '');
        card.setAttribute('data-precio',          String(parseInt(p.precioNormal, 10) || 0));
        card.setAttribute('data-precio-bazar',    String(parseInt(p.precioBazar,  10) || ''));
        card.setAttribute('data-tipo',            p.tipo  || 'arreglo');
        card.setAttribute('data-tipos',           (p.tipos || [p.tipo || 'arreglo']).join('|'));
        card.setAttribute('data-subtags',         p.subtags || '');
        card.setAttribute('data-nombre',          p.nombre);
        card.setAttribute('data-imagenes',        JSON.stringify(p.imagenes || []));
        card.setAttribute('data-descripcion',     p.descripcion || '');
        card.setAttribute('data-alto',             p.alto || '');
        card.setAttribute('data-ancho',            p.ancho || '');
        card.setAttribute('data-video',           p.video || '');
        card.setAttribute('data-oferta',          String(p.oferta || 0));
        card.setAttribute('data-oferta-desc',     p.ofertaDesc || '');
        card.setAttribute('data-oferta-duracion', p.ofertaDuracion || '');
        card.setAttribute('data-mas-vendido',     String(p.masVendido || 0));
        card.setAttribute('data-mas-vendido-imagenes', JSON.stringify(p.masVendidoImagenes || []));
        card.setAttribute('data-sub-imagenes', JSON.stringify(p.subImagenes || []));
        card.setAttribute('data-existencia',   String(p.existencia || 0));
        card.setAttribute('data-red-youtube',     JSON.stringify(p.redYoutube   || []));
        card.setAttribute('data-red-facebook',    JSON.stringify(p.redFacebook  || []));
        card.setAttribute('data-red-instagram',   JSON.stringify(p.redInstagram || []));
        card.setAttribute('data-red-tiktok',      JSON.stringify(p.redTiktok    || []));
        card.style.cursor = 'pointer';

        // ── Imagen principal ──
        var imgContenedor = document.createElement('div');
        imgContenedor.className = 'img-contenedor-dinamico';
        var img = document.createElement('img');
        img.src = p.imagen;
        img.alt = p.nombre;
        img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
        img.onerror = function() {
            if (typeof mostrarPlaceholder === 'function') mostrarPlaceholder(this);
        };
        imgContenedor.appendChild(img);
        card.appendChild(imgContenedor);

        // ── Botón favorito (corazón) ──
        var btnLike = document.createElement('button');
        btnLike.className = 'btn-like';
        btnLike.setAttribute('aria-label', 'Me gusta ' + p.nombre);
        btnLike.innerHTML = '🤍';
        btnLike.addEventListener('click', function(e) {
            e.stopPropagation();
            var idx = parseInt(card.getAttribute('data-idx'));
            if (!isNaN(idx)) toggleLike(idx, btnLike);
        });
        imgContenedor.appendChild(btnLike);

        // ── Botón carrito rápido ──
        var btnCartCard = document.createElement('button');
        btnCartCard.className = 'btn-carrito-card';
        btnCartCard.setAttribute('aria-label', 'Agregar al carrito ' + p.nombre);
        btnCartCard.innerHTML = '🛒';
        btnCartCard.addEventListener('click', function(e) {
            e.stopPropagation();
            if (typeof abrirModalCantidad === 'function') abrirModalCantidad(card);
        });
        imgContenedor.appendChild(btnCartCard);

        // ── Título ──
        var infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'margin-top:10px; flex-grow:1;';
        var h3 = document.createElement('h3');
        h3.style.cssText = 'font-size:18px; margin:5px 0;';
        h3.textContent = p.nombre;
        infoDiv.appendChild(h3);
        card.appendChild(infoDiv);

        // ── Aditivos ──
        if (p.aditivos && p.aditivos.length > 0) {
            var aditivosWrap = document.createElement('div');
            aditivosWrap.style.cssText = 'font-size:11px; border-top:1px solid #eee; padding-top:6px;';
            var aditivosFlex = document.createElement('div');
            aditivosFlex.style.cssText = 'display:flex; gap:5px; margin-top:3px; justify-content:center;';

            p.aditivos.forEach(function(ad) {
                var rec = document.createElement('div');
                rec.className = 'recuadro-item';
                rec.title = ad.titulo;
                rec.style.cssText = 'width:32px; height:32px; border:1px solid #ccc; border-radius:4px; overflow:hidden;';
                if (ad.link) {
                    rec.style.cursor = 'pointer';
                    rec.addEventListener('click', function(e) {
                        e.stopPropagation();
                        window.location.href = ad.link;
                    });
                }
                var adImg = document.createElement('img');
                adImg.src = ad.imagen;
                adImg.style.cssText = 'width:100%; height:100%; object-fit:cover;';
                rec.appendChild(adImg);
                aditivosFlex.appendChild(rec);
            });

            aditivosWrap.appendChild(aditivosFlex);
            card.appendChild(aditivosWrap);
        }

        // ── Precios ──
        var preciosBloque = document.createElement('div');
        preciosBloque.className = 'card-precios-bloque';

        var precioNormalDiv = document.createElement('div');
        precioNormalDiv.className = 'card-precio-normal';
        precioNormalDiv.innerHTML =
            '<span class="card-precio-etiqueta">Precio</span>' +
            '<span class="card-precio-valor">$' + (p.precioNormal || '') + ' MXN</span>';
        preciosBloque.appendChild(precioNormalDiv);

        if (p.precioBazar) {
            var precioBazarDiv = document.createElement('div');
            precioBazarDiv.className = 'card-precio-mayoreo-bloque visible';
            precioBazarDiv.innerHTML =
                '<span class="card-precio-mayoreo-etiqueta">Precio Mayoreo</span>' +
                '<span class="card-precio-mayoreo-badge">$' + p.precioBazar + ' MXN</span>';
            preciosBloque.appendChild(precioBazarDiv);
        }
        card.appendChild(preciosBloque);

        // ── Abrir modal al hacer clic en la card ──
        card.addEventListener('click', function(e) {
            if (e.target.closest('.btn-like')) return;
            if (e.target.closest('.btn-carrito-card')) return;
            if (typeof abrirModalProducto === 'function') {
                abrirModalProducto(card);
            }
        });

        grid.appendChild(card);
    });
    // Sincronizar corazones con favoritos guardados
    if (typeof syncBotonesLike === 'function') syncBotonesLike();
}

// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// OPEN GRAPH DINÁMICO — actualiza meta tags según el producto en la URL
// ══════════════════════════════════════════════════════════════════════════════

function _actualizarMetaOG(titulo, descripcion, imagen, url) {
    function setMeta(id, valor) {
        var el = document.getElementById(id);
        if (el && valor) el.setAttribute('content', valor);
    }
    var urlFinal = url || window.location.href;
    setMeta('og-url',         urlFinal);
    setMeta('og-title',       titulo + ' — Yesos Fer Kukúmita');
    setMeta('og-description', descripcion || 'Descubre este producto en Yesos Fer Kukúmita.');
    setMeta('og-image',       imagen);
    setMeta('tw-title',       titulo + ' — Yesos Fer Kukúmita');
    setMeta('tw-description', descripcion || 'Descubre este producto en Yesos Fer Kukúmita.');
    setMeta('tw-image',       imagen);
    // Actualizar también el <title> de la página
    document.title = titulo + ' — Yesos Fer Kukúmita';
}

function _abrirProductoDesdeURL() {
    var params = new URLSearchParams(window.location.search);
    var nombreParam = params.get('producto');
    if (!nombreParam) return;

    var nombreBuscado = decodeURIComponent(nombreParam).trim().toLowerCase();

    // Buscar la card que coincida con el nombre
    var cardEncontrada = null;
    document.querySelectorAll('.card-dinamica').forEach(function(card) {
        var nombreCard = (card.getAttribute('data-nombre') || '').trim().toLowerCase();
        if (nombreCard === nombreBuscado) cardEncontrada = card;
    });

    if (!cardEncontrada) return;

    // Actualizar meta OG con los datos del producto
    var nombre    = cardEncontrada.getAttribute('data-nombre') || '';
    var desc      = cardEncontrada.getAttribute('data-descripcion') || '';
    var imagenes  = [];
    try { imagenes = JSON.parse(cardEncontrada.getAttribute('data-imagenes') || '[]'); } catch(e) {}
    var imagen    = imagenes[0] || '';
    var urlProd   = window.location.href.split('?')[0] + '?producto=' + encodeURIComponent(nombre);

    _actualizarMetaOG(nombre, desc, imagen, urlProd);

    // Abrir el modal del producto con un pequeño retraso para que la UI esté lista
    setTimeout(function() {
        if (typeof abrirModalProducto === 'function') abrirModalProducto(cardEncontrada);
    }, 300);
}

// Restaurar meta OG genéricos al cerrar el modal
(function() {
    var _tituloOriginal    = document.title;
    var _ogTitleOriginal   = 'Yesos Fer Kukúmita — Arreglos y Productos Artesanales';
    var _ogDescOriginal    = 'Descubre nuestros hermosos arreglos y productos artesanales de Yesos Fer Kukúmita.';

    document.addEventListener('modalProductoCerrado', function() {
        document.title = _tituloOriginal;
        function setMeta(id, val) { var el=document.getElementById(id); if(el) el.setAttribute('content',val); }
        setMeta('og-title',       _ogTitleOriginal);
        setMeta('og-description', _ogDescOriginal);
        setMeta('og-image',       '');
        setMeta('tw-title',       _ogTitleOriginal);
        setMeta('tw-description', _ogDescOriginal);
        setMeta('tw-image',       '');
    });
})();

// CARGA DESDE GOOGLE SHEETS (CSV público)
// ══════════════════════════════════════════════════════════════════════════════
function cargarDesdeGoogleSheets() {
    var csvUrl = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:csv';

    mostrarEstadoCarga('Cargando catálogo desde Google Sheets…', false);

    fetch(csvUrl)
        .then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.text();
        })
        .then(function(texto) {
            var filas = parsearCSV(texto);

            // ── DIAGNÓSTICO: imprime las primeras 3 filas del CSV en consola ──
            console.group('[Kukumita] RAW CSV — primeras 3 filas');
            for (var _di = 0; _di < Math.min(3, filas.length); _di++) {
                console.log('Fila ' + _di + ' (' + filas[_di].length + ' columnas):');
                filas[_di].forEach(function(val, idx) {
                    if (val) console.log('  [' + idx + '] = ' + val.substring(0, 80));
                });
            }
            console.groupEnd();

            var productos = csvAProductos(filas);

            if (productos.length === 0) {
                mostrarEstadoCarga('La hoja está vacía o no tiene el formato correcto.', true);
                return;
            }

            listaProductos = productos;
            renderizarCatalogoCompleto();

            // Re-ejecutar los scripts que procesan las cards (subtags, aditivos, miniaturas, etc.)
            if (typeof syncBotonesLike === 'function') syncBotonesLike();

            // Disparar evento para que otros sistemas (paginación, filtros) se enteren
            document.dispatchEvent(new CustomEvent('catalogoCargado'));

            // Refrescar carruseles de ofertas/más vendidos con las nuevas cards
            if (typeof window.refrescarCarruseles === 'function') {
                setTimeout(function() { window.refrescarCarruseles(); }, 50);
            }

            // ── Leer ?producto= de la URL y abrir ese modal automáticamente ──
            _abrirProductoDesdeURL();

            // Log de diagnostico: precios y tipos de cada producto (visible en DevTools > Consola)
            console.group('[Kukumita] Catalogo cargado — ' + listaProductos.length + ' productos');
            listaProductos.forEach(function(p) {
                console.log(
                    p.nombre +
                    ' | precio=$' + p.precioNormal +
                    ' | imagen=' + (p.imagen ? p.imagen.substring(0,40)+'…' : 'SIN IMAGEN') +
                    ' | oferta=' + p.oferta +
                    ' | masVendido=' + p.masVendido +
                    ' | tipos=[' + (p.tipos || [p.tipo]).join('|') + ']'
                );
            });
            console.groupEnd();
        })
        .catch(function(err) {
            console.error('Error cargando Google Sheets:', err);
            mostrarEstadoCarga(
                'No se pudo cargar el catálogo. ¿La hoja está publicada como CSV?',
                true
            );
        });
}

// Iniciar carga al cargar la página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cargarDesdeGoogleSheets);
} else {
    cargarDesdeGoogleSheets();
}



// ===== PAGINACIÓN DE 30 PRODUCTOS POR PÁGINA =====
(function() {
    const POR_PAGINA = 30;
    let paginaActual = 1;
    let tarjetasVisibles = [];

    function obtenerTarjetasVisibles() {
        return Array.from(document.querySelectorAll('#gridProductos .card-dinamica'))
            .filter(function(c) {
                return !c.classList.contains('oculto') &&
                       !c.classList.contains('oculto-forma-carrusel');
            });
    }

    function calcularTotalPaginas() {
        return Math.ceil(tarjetasVisibles.length / POR_PAGINA);
    }

    function mostrarPagina(num) {
        paginaActual = num;
        // Guardar página en el hash de la URL para que persista al recargar
        var nuevoHash = (window.location.hash || '').replace(/#?pagina=\d+/, '').replace(/^#?&/, '').replace(/^#/, '') || '';
        var hashFinal = (nuevoHash ? nuevoHash + '&' : '') + 'pagina=' + num;
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '#' + hashFinal);
        }
        var inicio = (num - 1) * POR_PAGINA;
        var fin = inicio + POR_PAGINA;
        // Quita paginacion-oculto a todas
        document.querySelectorAll('#gridProductos .card-dinamica').forEach(function(c) {
            c.classList.remove('paginacion-oculto');
        });
        // Oculta las que no están en la página actual (sólo de las visibles)
        tarjetasVisibles.forEach(function(card, i) {
            if (i < inicio || i >= fin) {
                card.classList.add('paginacion-oculto');
            }
        });
        renderControles();
        if (_scrollAlCambiarPagina) {
            var grid = document.getElementById('gridProductos');
            if (grid) {
                grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    var _scrollAlCambiarPagina = false;

    function renderControles() {
        const total = calcularTotalPaginas();
        const mostradas = tarjetasVisibles.slice((paginaActual-1)*POR_PAGINA, paginaActual*POR_PAGINA).length;
        const hayTarjetas = document.querySelectorAll('#gridProductos .card-dinamica').length > 0;
        const infoTexto = tarjetasVisibles.length > 0
            ? "Mostrando " + ((paginaActual-1)*POR_PAGINA+1) + "\u2013" + ((paginaActual-1)*POR_PAGINA+mostradas) + " de " + tarjetasVisibles.length + " productos"
            : (hayTarjetas ? 'Sin resultados para ese filtro' : '');

        ['pagInfoArriba', 'pagInfoAbajo'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.textContent = infoTexto;
        });

        ['pagControlesArriba', 'pagControlesAbajo'].forEach(function(id) {
            var cont = document.getElementById(id);
            if (!cont) return;
            cont.innerHTML = '';
            if (total <= 1) {
                // Limpiar el hash de página para que no quede sucio al quitar filtros
                if (window.history && window.history.replaceState) {
                    var hashLimpio = (window.location.hash || '').replace(/#?pagina=\d+/, '').replace(/^#?&/, '').replace(/^#/, '');
                    window.history.replaceState(null, '', hashLimpio ? '#' + hashLimpio : window.location.pathname);
                }
                return;
            }

            var btnPrev = document.createElement('button');
            btnPrev.className = 'btn-pag';
            btnPrev.textContent = '\u2190 Anterior';
            btnPrev.disabled = paginaActual === 1;
            btnPrev.onclick = function() { _scrollAlCambiarPagina = true; mostrarPagina(paginaActual - 1); _scrollAlCambiarPagina = false; };
            cont.appendChild(btnPrev);

            for (var i = 1; i <= total; i++) {
                (function(pg) {
                    var btn = document.createElement('button');
                    btn.className = 'btn-pag' + (pg === paginaActual ? ' activo' : '');
                    btn.textContent = pg;
                    btn.onclick = function() { _scrollAlCambiarPagina = true; mostrarPagina(pg); _scrollAlCambiarPagina = false; };
                    cont.appendChild(btn);
                })(i);
            }

            var btnNext = document.createElement('button');
            btnNext.className = 'btn-pag';
            btnNext.textContent = 'Siguiente \u2192';
            btnNext.disabled = paginaActual === total;
            btnNext.onclick = function() { _scrollAlCambiarPagina = true; mostrarPagina(paginaActual + 1); _scrollAlCambiarPagina = false; };
            cont.appendChild(btnNext);
        });
    }

    var _primeraVez = true;

    function actualizarPaginacion() {
        tarjetasVisibles = obtenerTarjetasVisibles();
        var paginaInicial = 1;
        // Solo restaurar la página guardada en el hash durante la carga inicial,
        // no al cambiar filtros (para evitar mostrar páginas desincronizadas).
        if (_primeraVez) {
            var hash = window.location.hash || '';
            var match = hash.match(/pagina=(\d+)/);
            var paginaGuardada = match ? parseInt(match[1]) : 1;
            var totalPags = Math.ceil(tarjetasVisibles.length / POR_PAGINA);
            paginaInicial = (paginaGuardada > 1 && paginaGuardada <= totalPags) ? paginaGuardada : 1;
            _primeraVez = false;
        }
        mostrarPagina(paginaInicial);
    }

    // Escuchar el evento de catálogo cargado (Google Sheets) en lugar de usar un timeout fijo
    document.addEventListener('catalogoCargado', function() {
        // Detectar el modo activo antes de que el catálogo cargara
        var btnActivo = document.querySelector('.btn-modo-velas.activo');
        var mapaIDs = {
            'btnModoTodosProductos':  'mostrar_todo',
            'btnModoArreglos':        'arreglos',
            'btnModoPaquetes':        'paquetes',
            'btnModoEtiquetas':       'etiquetas'
        };
        var modoActual = btnActivo ? (mapaIDs[btnActivo.id] || 'mostrar_todo') : 'mostrar_todo';

        if (typeof window.cambiarModoVelas === 'function') {
            // Pasar por mostrar_todo para que la paginacion cuente todas las cards...
            window.cambiarModoVelas('mostrar_todo');
            // ...luego restaurar el modo activo de inmediato para mantener el layout correcto.
            window.cambiarModoVelas(modoActual);
        } else {
            actualizarPaginacion();
        }
    });

    // También respaldo con _ready por si el catálogo ya estaba listo al iniciar
    _ready(function() {
        // Solo dispara si ya hay tarjetas en el grid (catálogo estático o carga muy rápida)
        setTimeout(function() {
            if (document.querySelectorAll('#gridProductos .card-dinamica').length > 0) {
                actualizarPaginacion();
            }
        }, 300);
    });

    window.actualizarPaginacion = actualizarPaginacion;
})();



        // ===== BANNER: IMÁGENES ALEATORIAS DEL CATÁLOGO =====
        // Se ejecuta después de que el catálogo cargue para tener las cards disponibles
        function _llenarBannerAleatorio() {
            const tarjetasCatalogo = document.querySelectorAll('.card-dinamica');
            const imagenesCatalogo = [];

            tarjetasCatalogo.forEach(card => {
                const numProducto = card.getAttribute('data-num');
                const img = card.querySelector('.img-contenedor-dinamico img');
                if (img && img.src) {
                    imagenesCatalogo.push({ src: img.getAttribute('src'), num: numProducto });
                }
            });

            if (imagenesCatalogo.length === 0) return;

            // Mezcla aleatoria (Fisher-Yates)
            for (let i = imagenesCatalogo.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [imagenesCatalogo[i], imagenesCatalogo[j]] = [imagenesCatalogo[j], imagenesCatalogo[i]];
            }

            // Llena los slots del banner (limpiando primero)
            const slots = document.querySelectorAll('.banner-slot');
            slots.forEach((slot, index) => {
                slot.innerHTML = '';
                const item = imagenesCatalogo[index % imagenesCatalogo.length];
                const img = document.createElement('img');
                img.src = item.src;
                img.alt = 'Producto ' + item.num;

                const num = document.createElement('span');
                num.className = 'banner-num';
                num.textContent = '#' + item.num;

                slot.appendChild(img);
                slot.appendChild(num);
            });
        }
        document.addEventListener('catalogoCargado', _llenarBannerAleatorio);

        const sliderPrecio = document.getElementById('filtroPrecio');
        const txtPrecioMax = document.getElementById('txtPrecioMax');
        // tarjetas se obtiene dinámicamente para incluir las cargadas desde Google Sheets
        let formaActiva = 'todos';
        let eventoActivo = 'todos';
        let precioMaximoActivo = 500;

        function aplicarFiltros() {
            const tarjetas = document.querySelectorAll('.card-dinamica');
            tarjetas.forEach(tarjeta => {
                const fTarjeta = (tarjeta.getAttribute('data-forma') || '').trim().toLowerCase();
                const eTarjeta = (tarjeta.getAttribute('data-evento') || '').trim().toLowerCase();
                const pTarjeta = parseInt(tarjeta.getAttribute('data-precio')) || 0;

                const cumpleForma  = (formaActiva  === 'todos' || fTarjeta === formaActiva);
                const cumpleEvento = (eventoActivo === 'todos' || eTarjeta === eventoActivo);
                const cumplePrecio = (pTarjeta <= precioMaximoActivo);

                tarjeta.classList.toggle('oculto', !(cumpleForma && cumpleEvento && cumplePrecio));
            });

            // Actualizar paginación tras filtrar
            if (typeof window.actualizarPaginacion === 'function') {
                window.actualizarPaginacion();
            }

            // Indicador visual: resaltar encabezados de filtros activos
            var _elFormas = document.querySelector('#filtro-formas');
            if (_elFormas && _elFormas.closest('.filtro-bloque')) {
                var _lbFormas = _elFormas.closest('.filtro-bloque').querySelector('label');
                if (_lbFormas) _lbFormas.style.color = formaActiva !== 'todos' ? '#8c7565' : '';
            }
            var _elEventos = document.querySelector('#filtro-eventos');
            if (_elEventos && _elEventos.closest('.filtro-bloque')) {
                var _lbEventos = _elEventos.closest('.filtro-bloque').querySelector('label');
                if (_lbEventos) _lbEventos.style.color = eventoActivo !== 'todos' ? '#4b6b94' : '';
            }
        }

        // Filtro de FORMA — selección exclusiva dentro del grupo
        document.querySelectorAll('#filtro-formas .btn-filtro').forEach(boton => {
            boton.addEventListener('click', () => {
                document.querySelectorAll('#filtro-formas .btn-filtro').forEach(b => b.classList.remove('activo'));
                boton.classList.add('activo');
                formaActiva = (boton.getAttribute('data-forma') || 'todos').trim().toLowerCase();
                aplicarFiltros();
            });
        });

        // Filtro de EVENTO — selección exclusiva dentro del grupo, independiente del de forma
        document.querySelectorAll('#filtro-eventos .btn-filtro').forEach(boton => {
            boton.addEventListener('click', () => {
                document.querySelectorAll('#filtro-eventos .btn-filtro').forEach(b => b.classList.remove('activo'));
                boton.classList.add('activo');
                eventoActivo = (boton.getAttribute('data-evento') || 'todos').trim().toLowerCase();
                aplicarFiltros();
            });
        });

        if (sliderPrecio) {
            sliderPrecio.addEventListener('input', (e) => {
                precioMaximoActivo = parseInt(e.target.value);
                if (txtPrecioMax) txtPrecioMax.textContent = `$${precioMaximoActivo} MXN`;
                aplicarFiltros();
            });
        }
    


    // ── Helper: convierte data-red-* (JSON array de URLs) a objetos para _videosRedes ──
    function _parsearRedsCard(card, attr, tipo) {
        var raw = card.getAttribute(attr) || '[]';
        var urls;
        try { urls = JSON.parse(raw); } catch(e) { urls = []; }
        return urls.map(function(url, i) {
            url = url.trim();
            if (!url) return null;
            if (tipo === 'youtube') {
                // Extraer ID de YouTube desde URL completa o ID directo
                var ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
                var ytId = ytMatch ? ytMatch[1] : url;
                return { tipo: 'youtube', id: ytId, titulo: 'Video ' + (i+1) };
            }
            return { tipo: tipo, url: url, titulo: tipo.charAt(0).toUpperCase()+tipo.slice(1)+' ' + (i+1) };
        }).filter(Boolean);
    }

    // ===== MODAL DE PRODUCTO (rediseñado) =====
    let galeriaImagenes = [];
    let galeriaVideoPrincipal = '';   // URL/embed del video principal del producto
    let galeriaIndice = 0;

    function abrirModalProducto(card) {
        const nombre = card.getAttribute('data-nombre') || card.querySelector('h3')?.textContent || 'Producto';
        const descripcion = card.getAttribute('data-descripcion') || '';
        const alto = card.getAttribute('data-alto') || '';
        const ancho = card.getAttribute('data-ancho') || '';
        const existencia = parseInt(card.getAttribute('data-existencia') || '0') || 0;
        const imagenesJSON = card.getAttribute('data-imagenes');
        const precioNum = card.getAttribute('data-precio') || '';
        const precioBazar = card.getAttribute('data-precio-bazar') || '';

        // ── Video principal (si existe, va PRIMERO en la galería) ──
        galeriaVideoPrincipal = (card.getAttribute('data-video') || '').trim();

        try {
            galeriaImagenes = imagenesJSON ? JSON.parse(imagenesJSON) : [];
        } catch(e) { galeriaImagenes = []; }

        if (galeriaImagenes.length === 0) {
            const imgPrincipal = card.querySelector('.img-contenedor-dinamico img');
            if (imgPrincipal) galeriaImagenes = [imgPrincipal.getAttribute('src')];
        }

        // ── Poblar _videosRedes desde los atributos de la card ──
        try { _videosRedes.youtube   = _parsearRedsCard(card, 'data-red-youtube',   'youtube');   } catch(e) {}
        try { _videosRedes.facebook  = _parsearRedsCard(card, 'data-red-facebook',  'facebook');  } catch(e) {}
        try { _videosRedes.instagram = _parsearRedsCard(card, 'data-red-instagram', 'instagram'); } catch(e) {}
        try { _videosRedes.tiktok    = _parsearRedsCard(card, 'data-red-tiktok',    'tiktok');    } catch(e) {}

        galeriaIndice = 0;
        document.getElementById('modalProdTitulo').textContent = nombre;

        // Fila de precios (Original izquierda / Bazar derecha, misma altura)
        const precioBadge     = document.getElementById('modalPrecioSuperior');
        const precioFila      = document.getElementById('mpPrecioOriginalFila');
        const bazarFila       = document.getElementById('mpPrecioBazarFila');
        const bazarValor      = document.getElementById('mpPrecioBazarValor');
        const filaCompleta    = document.getElementById('mpPrecioFilaCompleta');

        if (precioNum) {
            precioBadge.textContent = '$' + precioNum + ' MXN';
            precioFila.style.display = 'block';
        } else {
            precioFila.style.display = 'none';
        }
        if (precioBazar) {
            bazarValor.textContent = '$' + precioBazar + ' MXN';
            bazarFila.style.display = 'block';
        } else {
            bazarFila.style.display = 'none';
        }
        // Mostrar/ocultar fila contenedora
        if (filaCompleta) filaCompleta.style.display = (precioNum || precioBazar) ? 'flex' : 'none';

        // Tags inline — SUB-ETIQUETAS (oferta/más vendido) + etiquetas de evento
        // La etiqueta PRINCIPAL se inyecta por inyectarEtiquetasModal()
        const tagsInline = document.getElementById('modalTagsInline');
        tagsInline.innerHTML = '';
        tagsInline.style.display = 'none'; // colapsadas por defecto

        // Limpiar también zona etiqueta principal
        const zonaPrincipal = document.getElementById('mpEtiquetaPrincipalZona');
        if (zonaPrincipal) { zonaPrincipal.innerHTML = ''; zonaPrincipal.style.display = 'none'; }

        // Ocultar botón toggle hasta saber si hay sub-etiquetas
        const btnToggleSub = document.getElementById('mpBtnMostrarSubetiquetas');
        if (btnToggleSub) btnToggleSub.style.display = 'none';

        // — Sub-etiquetas (desde data-subtags: cirio, tazón, stich, etc.) —
        const dataForma = card.getAttribute('data-forma') || '';
        const subtags = (card.getAttribute('data-subtags') || '').split('|').map(s => s.trim()).filter(Boolean);
        let haySubetiquetas = false;
        if (subtags.length > 0) {
            haySubetiquetas = true;
            const rowForma = document.createElement('div');
            rowForma.style.cssText = 'display: flex; flex-wrap: wrap; gap: 5px; width: 100%; margin-bottom: 6px;';
            const labelFm = document.createElement('div');
            labelFm.textContent = 'Sub-etiquetas';
            labelFm.style.cssText = 'font-size: 10px; font-weight: 700; color: #705c4f; text-transform: uppercase; letter-spacing: 0.5px; width: 100%; margin-bottom: 4px;';
            rowForma.appendChild(labelFm);
            subtags.forEach(tag => {
                const spanForma = document.createElement('span');
                spanForma.textContent = tag;
                spanForma.style.cssText = 'background: #e8e0d7; color: #705c4f; font-size: 11px; padding: 3px 9px; border-radius: 12px; font-weight: 600;';
                rowForma.appendChild(spanForma);
            });
            tagsInline.appendChild(rowForma);
        }

        // — Etiquetas de Evento —
        const dataEvento = card.getAttribute('data-evento') || '';
        const eventoMap = {
            'bautizo': 'Bautizo', 'primera-comunion': 'Primera Comunión',
            'fin-novenario': 'Fin de Novenario', 'quince-anos': 'Quinceaños',
            'quinceanos': 'Quinceaños', 'quinceanera': 'Quinceañera',
            'boda': 'Boda', 'baby-shower': 'Baby Shower', 'babyshower': 'Baby Shower',
            'aniversario-luctuoso': 'Aniversario Luctuoso', 'aniversario': 'Aniversario',
            'confirmacion': 'Confirmación',
            'despedida-soltera': 'Despedida de Soltera', 'despedida': 'Despedida de Soltera',
            'graduacion': 'Graduación',
            'primera-comunion': 'Primera Comunión', 'comunion': 'Primera Comunión',
            'fin-novenario': 'Fin de Novenario', 'novenario': 'Fin de Novenario',
            'sin evento': '', 'sin-evento': ''
        };
        // Normalizar: quitar acentos y convertir a minúsculas para comparar
        function _normEvento(s) {
            return s.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, '-');
        }
        // Buscar en el mapa con y sin normalización
        function _lookupEvento(slug) {
            if (eventoMap[slug] !== undefined) return eventoMap[slug];
            var norm = _normEvento(slug);
            if (eventoMap[norm] !== undefined) return eventoMap[norm];
            // Si no está en el mapa, mostrarlo tal como viene (con mayúscula inicial)
            return slug.charAt(0).toUpperCase() + slug.slice(1);
        }
        const eventoSlots = dataEvento.split(/\s+/).filter(e => e && e !== 'sin' && e !== 'evento');
        if (eventoSlots.length > 0) {
            haySubetiquetas = true;
            const labelEv = document.createElement('div');
            labelEv.textContent = 'Etiquetas de Evento';
            labelEv.style.cssText = 'font-size: 10px; font-weight: 700; color: #4b6b94; text-transform: uppercase; letter-spacing: 0.5px; width: 100%; margin-bottom: 4px;';
            tagsInline.appendChild(labelEv);
            const rowEv = document.createElement('div');
            rowEv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 5px; width: 100%;';
            eventoSlots.forEach(slug => {
                const span = document.createElement('span');
                span.textContent = _lookupEvento(slug);
                span.style.cssText = 'background: #e3edf7; color: #4b6b94; font-size: 11px; padding: 3px 9px; border-radius: 12px; font-weight: 600;';
                rowEv.appendChild(span);
            });
            tagsInline.appendChild(rowEv);
        }

        // Mostrar botón toggle solo si hay algo que desplegar
        if (btnToggleSub) btnToggleSub.style.display = haySubetiquetas ? 'inline-block' : 'none';

        // Descripción
        const descTexto = document.getElementById('modalDescripcionTexto');
        const descZona  = document.getElementById('modalDescripcionZona');
        if (descripcion && descripcion !== 'Descripción del producto.') {
            descTexto.textContent = descripcion;
            descZona.style.display = '';
        } else {
            descZona.style.display = 'none';
        }

        // Alto y Ancho
        const dimZona   = document.getElementById('modalDimensionesZona');
        const altoZona  = document.getElementById('modalAltoZona');
        const altoTexto = document.getElementById('modalAltoTexto');
        const anchoZona = document.getElementById('modalAnchoZona');
        const anchoTexto= document.getElementById('modalAnchoTexto');
        if (alto || ancho) {
            if (alto) { altoTexto.textContent = alto; altoZona.style.display = 'block'; }
            else       { altoZona.style.display = 'none'; }
            if (ancho) { anchoTexto.textContent = ancho; anchoZona.style.display = 'block'; }
            else        { anchoZona.style.display = 'none'; }
            dimZona.style.display = 'block';
        } else {
            dimZona.style.display = 'none';
        }

        // ── Stock / Existencia ──
        const existenciaZona  = document.getElementById('modalExistenciaZona');
        const existenciaTexto = document.getElementById('modalExistenciaTexto');
        if (existenciaZona && existenciaTexto) {
            if (existencia > 0) {
                existenciaTexto.textContent = existencia;
                existenciaZona.style.display = 'block';
            } else {
                existenciaZona.style.display = 'none';
            }
        }
        const aditivosScroll = document.getElementById('modalAditivosScroll');
        const aditivosZona   = document.getElementById('modalAditivosZona');
        aditivosScroll.innerHTML = '';

        let subImagenes = [];
        try { subImagenes = JSON.parse(card.getAttribute('data-sub-imagenes') || '[]'); } catch(e) {}

        function _normTexto(s) {
            return (s || '').trim().toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ');
        }

        if (subImagenes.length > 0) {
            const urlACard    = {};
            const nombreACard = {};
            document.querySelectorAll('.card-dinamica').forEach(function(c) {
                try {
                    const imgs = JSON.parse(c.getAttribute('data-imagenes') || '[]');
                    imgs.forEach(function(u) { if (u) urlACard[u.trim()] = c; });
                } catch(e) {}
                const n = _normTexto(c.getAttribute('data-nombre') || '');
                if (n) nombreACard[n] = c;
            });

            function buscarCardPorNombre(entrada) {
                const norm = _normTexto(entrada);
                // No buscar coincidencias parciales con cadenas muy cortas (evita falsos positivos con números)
                if (norm.length < 3) return null;
                if (nombreACard[norm]) return nombreACard[norm];
                const claves = Object.keys(nombreACard);
                for (let k = 0; k < claves.length; k++) {
                    if (claves[k].includes(norm) || norm.includes(claves[k])) {
                        return nombreACard[claves[k]];
                    }
                }
                return null;
            }

            function esURL(s) {
                return /^https?:\/\//i.test(s) || /^\//.test(s) || /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(s);
            }

            console.log('[Aditamentos] SubImagenes de "' + nombre + '":', subImagenes);

            subImagenes.forEach(function(entrada) {
                entrada = (entrada || '').trim();
                if (!entrada) return;

                // Descartar entradas que sean solo números (podrían ser datos de otra columna)
                if (/^\d+$/.test(entrada)) return;
                // Descartar entradas demasiado cortas que no sean URLs
                if (entrada.length < 3 && !/^https?:\/\//i.test(entrada)) return;

                let cardRelacionada = null;
                let srcImagen = '';

                if (esURL(entrada)) {
                    cardRelacionada = urlACard[entrada] || null;
                    srcImagen = entrada;
                } else {
                    cardRelacionada = buscarCardPorNombre(entrada);
                    if (cardRelacionada) {
                        try {
                            const imgs = JSON.parse(cardRelacionada.getAttribute('data-imagenes') || '[]');
                            srcImagen = imgs[0] || '';
                        } catch(e) {}
                    }
                }

                if (!srcImagen && !cardRelacionada) return;

                const nombreRel = cardRelacionada ? (cardRelacionada.getAttribute('data-nombre') || entrada) : entrada;
                const item = document.createElement('div');
                item.style.cssText = 'flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:6px;' +
                    (cardRelacionada ? ' cursor:pointer;' : '');

                const wrap = document.createElement('div');
                wrap.style.cssText = 'position:relative; width:90px; height:90px; border-radius:12px; overflow:hidden;' +
                    ' border:2px solid #e8ddd5; transition:border-color 0.2s, transform 0.18s, box-shadow 0.18s;' +
                    ' box-shadow:0 2px 8px rgba(0,0,0,0.07);';
                if (cardRelacionada) {
                    wrap.onmouseover = function() { this.style.borderColor='#c9a98a'; this.style.transform='translateY(-3px)'; this.style.boxShadow='0 6px 18px rgba(140,117,101,0.22)'; };
                    wrap.onmouseout  = function() { this.style.borderColor='#e8ddd5'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.07)'; };
                }

                if (srcImagen) {
                    const imgEl = document.createElement('img');
                    imgEl.src = srcImagen;
                    imgEl.alt = nombreRel;
                    imgEl.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block;';
                    imgEl.onerror = function() {
                        wrap.innerHTML = '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f9f5f2;gap:4px;">' +
                            '<span style="font-size:22px;">🕯️</span>' +
                            '<span style="font-size:9px;color:#a89080;text-align:center;padding:0 6px;">' + nombreRel + '</span></div>';
                    };
                    wrap.appendChild(imgEl);
                } else {
                    wrap.innerHTML = '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f9f5f2;gap:4px;">' +
                        '<span style="font-size:22px;">🕯️</span>' +
                        '<span style="font-size:9px;color:#a89080;text-align:center;padding:0 6px;">' + nombreRel + '</span></div>';
                }

                if (cardRelacionada) {
                    const lupa = document.createElement('div');
                    lupa.style.cssText = 'position:absolute; bottom:4px; right:4px; width:20px; height:20px;' +
                        ' border-radius:50%; background:rgba(54,42,34,0.55); display:flex; align-items:center;' +
                        ' justify-content:center; font-size:10px; pointer-events:none;';
                    lupa.textContent = '🔍';
                    wrap.appendChild(lupa);
                }

                item.appendChild(wrap);

                const label = document.createElement('span');
                label.textContent = nombreRel;
                label.style.cssText = 'font-size:10px; font-weight:600; color:#8a7a70; text-align:center;' +
                    ' max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
                item.appendChild(label);

                if (cardRelacionada) {
                    item.addEventListener('click', function() {
                        setTimeout(function() { abrirModalProducto(cardRelacionada); }, 60);
                    });
                }

                aditivosScroll.appendChild(item);
            });
            aditivosZona.style.display = aditivosScroll.children.length > 0 ? '' : 'none';
        } else {
            aditivosZona.style.display = 'none';
        }
        // Botón Favoritos modal
        const mpBtnFav = document.getElementById('mpBtnFavoritos');
        if (mpBtnFav) {
            const cardIdx = parseInt(card.getAttribute('data-idx'));
            mpBtnFav._cardIdx = cardIdx; // para que _syncTodo pueda actualizarlo
            const esFav = esFavorito(card);
            mpBtnFav.classList.toggle('guardado', esFav);
            mpBtnFav.textContent = esFav ? '❤️ En Favoritos' : '❤️ Favoritos';
            mpBtnFav.onclick = () => {
                toggleFavoritoCard(card);
                const ahora = esFavorito(card);
                mpBtnFav.classList.toggle('guardado', ahora);
                mpBtnFav.textContent = ahora ? '❤️ En Favoritos' : '❤️ Favoritos';
                mostrarToast(ahora ? '❤️ Añadido a favoritos' : '💔 Quitado de favoritos');
            };
        }

        // Botón Añadir al carrito modal — abre modal de cantidad
        const mpBtnCarrito = document.getElementById('mpBtnCarrito');
        if (mpBtnCarrito) {
            mpBtnCarrito.onclick = () => {
                abrirModalCantidad(card);
            };
        }

        // Botón WhatsApp
        document.getElementById('mpBtnWhatsapp').onclick = () => {
            const texto = encodeURIComponent('Hola, me interesa el producto: ' + nombre + (precioNum ? ' ($' + precioNum + ' MXN)' : ''));
            window.open('https://wa.me/524431322032?text=' + texto, '_blank');
        };

        // Botón Compartir — actualiza OG y abre submenu
        document.getElementById('mpBtnCompartir').onclick = (e) => {
            e.stopPropagation();
            const url    = window.location.href.split('?')[0] + '?producto=' + encodeURIComponent(nombre);
            const urlOG  = (typeof _urlOG === 'function') ? _urlOG(url) : url;
            // Actualizar meta OG con este producto antes de compartir
            if (typeof _actualizarMetaOG === 'function') {
                _actualizarMetaOG(nombre, descripcion, galeriaImagenes[0] || '', urlOG);
            }
            abrirSubmenuCompartir(url, nombre);
        };

        renderizarGaleria();

        document.getElementById('modalProducto').classList.add('abierto');
        document.body.style.overflow = 'hidden';
        _modalActivo = 'producto';
        setTimeout(() => {
            const caja = document.querySelector('.modal-producto-caja');
            if (caja) caja.scrollTop = 0;
        }, 30);

        // Redirigir scroll del mouse al interior del modal aunque el cursor esté en el overlay
        const _modalEl = document.getElementById('modalProducto');
        function _redirigirScrollModal(e) {
            const caja = _modalEl.querySelector('.modal-producto-caja');
            if (!caja) return;
            // Solo redirigir si el evento viene del overlay (no de dentro de la caja)
            if (!caja.contains(e.target)) {
                e.preventDefault();
                caja.scrollTop += e.deltaY;
            }
        }
        _modalEl._wheelHandler = _redirigirScrollModal;
        _modalEl.addEventListener('wheel', _redirigirScrollModal, { passive: false });

        if (history.state && history.state.modalAbierto) return;
        history.pushState({ modalAbierto: true, kukumitaModal: 'producto' }, '');

        // Inyectar etiquetas principales y de evento
        setTimeout(function() { inyectarEtiquetasModal(card); }, 0);
    }

    function cerrarModalProducto() {
        const modalEl = document.getElementById('modalProducto');
        modalEl.classList.remove('abierto');
        // Limpiar el handler de scroll redirigido
        if (modalEl._wheelHandler) {
            modalEl.removeEventListener('wheel', modalEl._wheelHandler);
            delete modalEl._wheelHandler;
        }
        document.body.style.overflow = '';
        _modalActivo = null;
        if (history.state && history.state.modalAbierto) {
            history.replaceState(null, '');
        }
        // Restaurar meta OG genéricos
        document.dispatchEvent(new CustomEvent('modalProductoCerrado'));
        // Resetear sub-etiquetas a estado colapsado para el próximo producto
        var tagsInline = document.getElementById('modalTagsInline');
        var btnToggle  = document.getElementById('mpBtnMostrarSubetiquetas');
        if (tagsInline) tagsInline.style.display = 'none';
        if (btnToggle)  btnToggle.textContent = 'Ver sub-etiquetas ▾';
    }

    function renderizarGaleria() {
        const track = document.getElementById('modalGaleriaTrack');
        const dotsContainer = document.getElementById('modalDots');
        track.innerHTML = '';
        dotsContainer.innerHTML = '';

        // Limpiar listener anterior
        track._scrollHandler && track.removeEventListener('scroll', track._scrollHandler);

        // ── Slide 0: Video de YouTube (solo si el link es de YouTube) ──
        let slideOffset = 0;
        if (galeriaVideoPrincipal) {
            const ytMatch = galeriaVideoPrincipal.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
            if (ytMatch) {
                const videoSlide = document.createElement('div');
                videoSlide.className = 'modal-galeria-slide';
                videoSlide.style.cssText = 'display:flex;align-items:center;justify-content:center;background:#000;';

                const iframe = document.createElement('iframe');
                iframe.src = 'https://www.youtube.com/embed/' + ytMatch[1] + '?rel=0';
                iframe.style.cssText = 'width:100%;height:100%;border:0;';
                iframe.setAttribute('allowfullscreen', '');
                iframe.setAttribute('allow', 'autoplay; encrypted-media');

                videoSlide.appendChild(iframe);
                track.appendChild(videoSlide);

                const dotV = document.createElement('div');
                dotV.className = 'modal-dot activo';
                dotV.onclick = () => irASlide(0);
                dotsContainer.appendChild(dotV);
                slideOffset = 1;
            }
            // Si el link no es de YouTube, se ignora y solo se muestran las imágenes
        }

        galeriaImagenes.forEach((src, i) => {
            const slide = document.createElement('div');
            slide.className = 'modal-galeria-slide';
            const img = document.createElement('img');
            img.src = src;
            img.alt = 'Imagen ' + (i + 1);
            // Clic en imagen abre zoom
            img.style.cursor = 'zoom-in';
            img.onclick = () => abrirZoomGaleria(i);
            slide.appendChild(img);
            track.appendChild(slide);

            const dot = document.createElement('div');
            const dotIdx = i + slideOffset;
            dot.className = 'modal-dot' + (dotIdx === 0 ? ' activo' : '');
            dot.onclick = () => irASlide(dotIdx);
            dotsContainer.appendChild(dot);
        });

        const totalSlides = galeriaImagenes.length + slideOffset;
        dotsContainer.style.display = totalSlides <= 1 ? 'none' : 'flex';

        actualizarNavegacion();

        track._scrollHandler = () => {
            const nuevoIndice = Math.round(track.scrollLeft / track.offsetWidth);
            if (nuevoIndice !== galeriaIndice) {
                galeriaIndice = nuevoIndice;
                actualizarNavegacion();
            }
        };
        track.addEventListener('scroll', track._scrollHandler, { passive: true });
    }

    function irASlide(indice) {
        const track = document.getElementById('modalGaleriaTrack');
        const _totalSlides = galeriaImagenes.length + (galeriaVideoPrincipal ? 1 : 0);
        galeriaIndice = Math.max(0, Math.min(indice, _totalSlides - 1));
        track.scrollTo({ left: galeriaIndice * track.offsetWidth, behavior: 'smooth' });
        actualizarNavegacion();
    }

    function moverGaleria(direccion) {
        irASlide(galeriaIndice + direccion);
    }

    function actualizarNavegacion() {
        const total = galeriaImagenes.length + (galeriaVideoPrincipal ? 1 : 0);
        document.getElementById('btnGalPrev').classList.toggle('oculto-nav', galeriaIndice === 0);
        document.getElementById('btnGalNext').classList.toggle('oculto-nav', galeriaIndice >= total - 1);
        document.getElementById('modalContador').textContent = total > 1 ? `${galeriaIndice + 1} / ${total}` : '';
        document.querySelectorAll('.modal-dot').forEach((dot, i) => {
            dot.classList.toggle('activo', i === galeriaIndice);
        });
    }

    // ── ZOOM LIGHTBOX ──────────────────────────────
    let zoomIndice = 0;

    function abrirZoomGaleria(indice) {
        zoomIndice = (indice !== undefined) ? indice : galeriaIndice;
        actualizarZoom();
        document.getElementById('zoomOverlay').classList.add('abierto');
        document.body.style.overflow = 'hidden';
    }

    function cerrarZoomGaleria() {
        document.getElementById('zoomOverlay').classList.remove('abierto');
    }

    function zoomNavegar(dir) {
        zoomIndice = Math.max(0, Math.min(zoomIndice + dir, galeriaImagenes.length - 1));
        actualizarZoom();
    }

    function actualizarZoom() {
        const total = galeriaImagenes.length;
        const img = document.getElementById('zoomImg');
        img.style.opacity = '0.4';
        img.src = galeriaImagenes[zoomIndice] || '';
        img.onload = () => { img.style.opacity = '1'; };
        document.getElementById('zoomContador').textContent = total > 1 ? `${zoomIndice + 1} / ${total}` : '';
        document.getElementById('zoomPrev').classList.toggle('oculto-zoom', zoomIndice === 0);
        document.getElementById('zoomNext').classList.toggle('oculto-zoom', zoomIndice >= total - 1);
    }

    // Teclado para zoom
    document.addEventListener('keydown', function(e) {
        const overlay = document.getElementById('zoomOverlay');
        if (!overlay.classList.contains('abierto')) return;
        if (e.key === 'Escape') cerrarZoomGaleria();
        if (e.key === 'ArrowLeft') zoomNavegar(-1);
        if (e.key === 'ArrowRight') zoomNavegar(1);
    });

    // Cerrar al hacer clic en el fondo del modal de producto
    document.getElementById('modalProducto').addEventListener('click', function(e) {
        if (e.target === this) cerrarModalProducto();
    });

    // ===== PLACEHOLDER PARA IMÁGENES NO ENCONTRADAS =====
    function mostrarPlaceholder(img) {
        const nombre = img.alt || 'Imagen próximamente';
        const contenedor = img.parentElement;
        img.style.display = 'none';
        const ph = document.createElement('div');
        ph.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f5f0eb;color:#8c7565;text-align:center;padding:12px;box-sizing:border-box;';
        ph.innerHTML = `
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#c9b8a8" stroke-width="1.5" style="margin-bottom:8px;">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="m21 15-5-5L5 21"/>
            </svg>
            <span style="font-size:11px;font-weight:700;color:#8c7565;">Imagen próximamente</span>
            <span style="font-size:10px;color:#b09080;margin-top:3px;">${nombre}</span>
        `;
        contenedor.appendChild(ph);
    }

    // ===== POST-PROCESADO DE CARDS (se ejecuta cada vez que el catálogo se renderiza) =====
    function postProcesarCards() {
        // Activar click en imagen de cada card
        document.querySelectorAll('.card-dinamica').forEach(card => {
            const imgContenedor = card.querySelector('.img-contenedor-dinamico');
            if (imgContenedor) {
                imgContenedor.style.cursor = 'pointer';
                // Evitar duplicar listeners usando un flag
                if (!imgContenedor._clickBound) {
                    imgContenedor._clickBound = true;
                    imgContenedor.addEventListener('click', () => abrirModalProducto(card));
                }
            }

            // Hint "Toca para ver detalles" (solo si no existe ya)
            if (!card.querySelector('.card-hint-tap')) {
                const hint = document.createElement('div');
                hint.className = 'card-hint-tap';
                hint.textContent = 'Toca para ver detalles';
                card.appendChild(hint);
            }

            // Sub-etiquetas debajo de la imagen desde data-subtags
            const infoDiv = card.querySelector('.img-contenedor-dinamico');
            if (infoDiv && !card.querySelector('.subtags-row')) {
                const subtags = (card.getAttribute('data-subtags') || '').split('|').map(s => s.trim()).filter(Boolean);
                if (subtags.length > 0) {
                    const tagsRow = document.createElement('div');
                    tagsRow.className = 'subtags-row';
                    tagsRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 3px; padding: 5px 6px 2px 6px;';
                    subtags.slice(0, 5).forEach(tag => {
                        const t = document.createElement('span');
                        t.textContent = tag;
                        t.style.cssText = 'font-size: 9px; padding: 2px 6px; border-radius: 10px; font-weight: 600; background: #e8e0d7; color: #705c4f;';
                        tagsRow.appendChild(t);
                    });
                    infoDiv.insertAdjacentElement('afterend', tagsRow);
                }
            }
        });

        // Agregar título "Decoraciones y Aditamentos" y completar hasta 3 recuadros
        document.querySelectorAll('.card-dinamica').forEach(card => {
            const primerRecuadro = card.querySelector('.recuadro-item');
            if (primerRecuadro) {
                const contenedorFlex = primerRecuadro.parentElement;
                if (contenedorFlex && !contenedorFlex.previousElementSibling?.classList.contains('titulo-aditivos-card')) {
                    const titulo = document.createElement('div');
                    titulo.className = 'titulo-aditivos-card';
                    titulo.style.cssText = 'font-size: 9px; font-weight: bold; color: #8a7a70; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.4px;';
                    titulo.textContent = 'Decoraciones y Aditamentos';
                    contenedorFlex.parentElement.insertBefore(titulo, contenedorFlex);
                }
                const contenedorFlex2 = primerRecuadro.parentElement;
                const recuadrosActuales = contenedorFlex2.querySelectorAll('.recuadro-item').length;
                for (let i = recuadrosActuales; i < 3; i++) {
                    const vacio = document.createElement('div');
                    vacio.className = 'recuadro-item recuadro-vacio';
                    vacio.title = 'Espacio disponible';
                    vacio.style.cssText = 'width: 32px; height: 32px; border: 1px dashed #d4c5b8; border-radius: 4px; overflow: hidden; background: #f9f5f2; display: flex; align-items: center; justify-content: center; cursor: default;';
                    vacio.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c9b8a8" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
                    contenedorFlex2.appendChild(vacio);
                }
            }
        });

        // Aplicar onerror placeholder a imágenes de producto
        document.querySelectorAll('.img-contenedor-dinamico img').forEach(img => {
            img.onerror = function() { mostrarPlaceholder(this); };
        });
    }

    // Ejecutar post-procesado cuando el catálogo asíncrono cargue
    document.addEventListener('catalogoCargado', postProcesarCards);
    // También ejecutar ahora por si ya hay cards en el DOM
    postProcesarCards();

    // ===== FUNCIÓN PARA REDIRIGIR A PRODUCTO DESDE ZONA DE OFERTAS =====
    function irAProducto(numProducto) {
        const card = document.querySelector(`.card-dinamica[data-num="${numProducto}"]`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => abrirModalProducto(card), 400);
        }
    }

    // ===== INICIALIZAR SLOTS DE OFERTAS Y MÁS VENDIDOS =====
    document.querySelectorAll('.oferta-slot').forEach(slot => {
        const numProducto = slot.getAttribute('data-producto');
        const imagenCustom = slot.getAttribute('data-imagen');
        const placeholder = slot.querySelector('.oferta-placeholder');
        const imgWrap = slot.querySelector('.oferta-img-wrap');
        const infoNombre = slot.querySelector('.oferta-info-nombre');
        const infoPrecio = slot.querySelector('.oferta-info-precio');

        let imagenSrc = imagenCustom;
        let nombreProducto = '';
        let precioProducto = '';
        let cardRef = null;

        // Si hay número de producto, obtener datos del catálogo
        if (numProducto) {
            const card = document.querySelector(`.card-dinamica[data-num="${numProducto}"]`);
            if (card) {
                cardRef = card;
                nombreProducto = card.getAttribute('data-nombre') || '';
                precioProducto = card.getAttribute('data-precio') ? `$${card.getAttribute('data-precio')} MXN` : '';
                if (!imagenSrc) {
                    const imgPrincipal = card.querySelector('.img-contenedor-dinamico img');
                    if (imgPrincipal) imagenSrc = imgPrincipal.getAttribute('src');
                }
            }
        }

        // Mostrar imagen y datos si existe el producto
        if (imagenSrc && numProducto) {
            slot.classList.add('con-producto');
            if (placeholder) placeholder.style.display = 'none';
            if (imgWrap) {
                imgWrap.style.display = 'block';
                const img = document.createElement('img');
                img.src = imagenSrc;
                img.alt = nombreProducto || 'Producto';
                img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
                img.onerror = function() { imgWrap.style.display = 'none'; if (placeholder) placeholder.style.display = 'flex'; };
                imgWrap.appendChild(img);
            }
            if (infoNombre) infoNombre.textContent = nombreProducto;
            if (infoPrecio) infoPrecio.textContent = precioProducto;

            // Abrir modal del producto al hacer clic
            slot.style.cursor = 'pointer';
            slot.addEventListener('click', () => {
                if (cardRef) {
                    cardRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => abrirModalProducto(cardRef), 300);
                }
            });
        }
    });





    // ===== MODO OSCURO =====
    function toggleModoOscuro() {
        document.body.classList.toggle('modo-oscuro');
        localStorage.setItem('velas-modo-oscuro', document.body.classList.contains('modo-oscuro') ? '1' : '0');
    }
    // Restaurar preferencia guardada
    if (localStorage.getItem('velas-modo-oscuro') === '1') {
        document.body.classList.add('modo-oscuro');
    }

    // ===== CAMBIO DE MODO: ARREGLOS / TODOS LOS PRODUCTOS =====
    function cambiarModoVelas(modo) {
        // Botones
        const btnTodosProductos = document.getElementById('btnModoTodosProductos');
        const btnArreglos       = document.getElementById('btnModoArreglos');
        const btnPaquetes       = document.getElementById('btnModoPaquetes');
        const btnEtiquetas      = document.getElementById('btnModoEtiquetas');

        const panelArr  = document.getElementById('panelArreglos');
        const panelEtiq = document.getElementById('panelEtiquetas');
        const panelTod  = document.getElementById('panelTodos');
        const bloqueArr = document.getElementById('bloqueFiltroPrecioArreglos');
        const bloqueTod = document.getElementById('bloqueFiltroPrecioTodos');

        // Desactivar todos los botones y paneles
        [btnTodosProductos, btnArreglos, btnPaquetes, btnEtiquetas]
            .forEach(b => b && b.classList.remove('activo'));
        [panelArr, panelEtiq, panelTod]
            .forEach(p => p && p.classList.remove('visible'));
        if (bloqueArr) bloqueArr.style.display = 'none';
        if (bloqueTod) bloqueTod.style.display = 'none';

        if (modo === 'mostrar_todo') {
            if (btnTodosProductos) btnTodosProductos.classList.add('activo');
            if (panelTod) panelTod.classList.add('visible');
            if (bloqueTod) bloqueTod.style.display = 'block';
            aplicarFiltrosUnificados('mostrar_todo');
        } else if (modo === 'arreglos') {
            if (btnArreglos) btnArreglos.classList.add('activo');
            if (bloqueArr) bloqueArr.style.display = 'block';
            if (panelArr) panelArr.classList.add('visible');
            aplicarFiltrosArreglos();
        } else if (modo === 'paquetes') {
            if (btnPaquetes) btnPaquetes.classList.add('activo');
            if (panelTod) panelTod.classList.add('visible');
            if (bloqueTod) bloqueTod.style.display = 'block';
            aplicarFiltrosUnificados('paquetes');
        } else if (modo === 'etiquetas') {
            if (btnEtiquetas) btnEtiquetas.classList.add('activo');
            if (panelEtiq) panelEtiq.classList.add('visible');
            aplicarFiltrosUnificados('etiquetas');
        } else {
            // Fallback: mostrar todo
            if (btnTodosProductos) btnTodosProductos.classList.add('activo');
            if (panelTod) panelTod.classList.add('visible');
            if (bloqueTod) bloqueTod.style.display = 'block';
            aplicarFiltrosUnificados('mostrar_todo');
        }
    }

    // Exponer funciones al scope global para que el HTML pueda llamarlas
    window.cambiarModoVelas         = cambiarModoVelas;

    // ===== SISTEMA DE BÚSQUEDA UNIFICADA =====

    // Estado de filtros activos por panel
    const filtrosUnificados = {
        arreglos:     { forma: 'todos', evento: 'todos' },
        todos:        { forma: 'todos', evento: 'todos' },
        mostrar_todo: {},
        etiquetas:    { evento: 'todos' },
        decoraciones: {}
    };

    // ── Utilidades de búsqueda inteligente ──────────────────────────────────
    // Quita acentos y pasa a minúsculas para comparar sin importar tildes ni mayúsculas
    function normalizarTexto(str) {
        return (str || '').toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    // Palabras pequeñas que no deben usarse como criterio de búsqueda
    var STOPWORDS = new Set([
        'de','del','la','las','el','los','un','una','unos','unas',
        'y','e','o','u','a','en','con','por','para','que','se',
        'es','son','su','sus','al','lo','le','les','no','si'
    ]);

    // Sinónimos y variantes ortográficas: cada grupo agrupa palabras equivalentes.
    // Si el query contiene cualquiera de ellas, se buscan TODAS en el texto.
    var SINONIMOS = [
        ['tazon','tason','tazones','tasones','bowl','tazón','tasón'],
        ['virgen','virjen','birgen','birjen','virgin'],
        ['elefante','elefantes'],
        ['arreglo','arreglos'],
        ['vela','velas'],
        ['figura','figuras'],
        ['flores','flor'],
    ];

    // Dada una palabra normalizada, devuelve el grupo de variantes al que pertenece (o [la misma palabra])
    function expandirVariantes(palabra) {
        for (var i = 0; i < SINONIMOS.length; i++) {
            if (SINONIMOS[i].indexOf(palabra) !== -1) {
                return SINONIMOS[i];
            }
        }
        return [palabra];
    }

    // Divide el query en palabras significativas (sin stopwords, mínimo 2 chars)
    function palabrasBusqueda(query) {
        return normalizarTexto(query)
            .split(/\s+/)
            .filter(function(p) { return p.length >= 2 && !STOPWORDS.has(p); });
    }

    // Devuelve true si TODAS las palabras significativas del query aparecen
    // en alguna parte del texto (nombre + tipo + subtags del producto).
    // Tolerancia: acepta variantes ortográficas y sinónimos definidos en SINONIMOS.
    function coincideNombre(nombreCard, query, card) {
        if (!query || !query.trim()) return true;

        // Construir texto completo del producto para buscar
        var textoCompleto = normalizarTexto(nombreCard);
        if (card) {
            var tipos    = normalizarTexto(card.getAttribute('data-tipos')   || '');
            var subtags  = normalizarTexto(card.getAttribute('data-subtags') || '');
            var tipo     = normalizarTexto(card.getAttribute('data-tipo')    || '');
            textoCompleto += ' ' + tipos + ' ' + subtags + ' ' + tipo;
        }

        var palabras = palabrasBusqueda(query);
        if (palabras.length === 0) return true; // solo stopwords → mostrar todo

        return palabras.every(function(p) {
            var variantes = expandirVariantes(p);
            // Coincide si alguna variante aparece como substring en el texto completo
            return variantes.some(function(v) { return textoCompleto.includes(v); });
        });
    }
    // ────────────────────────────────────────────────────────────────────────

    function filtrarPorNombreUnificado(panel, valor) {
        aplicarFiltrosUnificados(panel);
    }

    function toggleDropdownFiltros(panel) {
        const dropdown = document.getElementById('dropdown' + capitalizar(panel));
        const btnFlecha = document.getElementById('btnFlecha' + capitalizar(panel));
        if (!dropdown) return;
        const abierto = dropdown.classList.toggle('abierto');
        if (btnFlecha) btnFlecha.classList.toggle('abierto', abierto);
        // Cerrar otros dropdowns
        ['arreglos','todos','etiquetas'].forEach(p => {
            if (p !== panel) {
                const dd = document.getElementById('dropdown' + capitalizar(p));
                const bf = document.getElementById('btnFlecha' + capitalizar(p));
                if (dd) dd.classList.remove('abierto');
                if (bf) bf.classList.remove('abierto');
            }
        });
    }

    function capitalizar(str) {
        const map = { arreglos: 'Arreglos', todos: 'Todos', etiquetas: 'Etiquetas', decoraciones: 'Decoraciones' };
        return map[str] || str.charAt(0).toUpperCase() + str.slice(1);
    }

    function toggleGrupoFiltro(grupoId) {
        const grupo = document.getElementById(grupoId);
        if (!grupo) return;
        const header = grupo.previousElementSibling;
        grupo.classList.toggle('abierto');
        if (header) header.classList.toggle('abierto');
    }

    function seleccionarTagFiltro(btn, panel, tipo, valor) {
        // Marcar activo dentro del grupo
        const grupoMap = {
            arreglos:  { forma: 'grupoFormaArreglos',   evento: 'grupoEventoArreglos' },
            todos:     { forma: 'grupoFormaTodos',       evento: 'grupoEventoTodos' },
            etiquetas: { evento: 'grupoEventoEtiquetas' }
        };
        const grupoId = grupoMap[panel]?.[tipo];
        if (grupoId) {
            document.querySelectorAll('#' + grupoId + ' .bbu-tag').forEach(b => b.classList.remove('activo'));
            btn.classList.add('activo');
        }
        // Guardar estado
        if (filtrosUnificados[panel]) filtrosUnificados[panel][tipo] = valor;
        aplicarFiltrosUnificados(panel);
    }

    // ── Helper: comprueba si una card tiene alguno de los tipos indicados ──
    function tieneTipo(card, ...buscar) {
        const rawTipos = (card.getAttribute('data-tipos') || card.getAttribute('data-tipo') || '');
        const tipos = rawTipos.toLowerCase().replace(/^"+|"+$/g, '').split(/[|,]/).map(s => s.trim().replace(/^"+|"+$/g, '')).filter(Boolean);
        const variantes = {
            'producto':        ['producto','productos'],
            'arreglo':         ['arreglo','arreglos'],
            'paquetes':        ['paquete','paquetes'],
            'decoracion':      ['decoracion','decoraciones','aditamento','aditamentos','centro de mesa','centro_de_mesa','centrodemesa'],
            'etiqueta':        ['etiqueta','etiquetas'],
            // Categorías de etiquetaprincipal (col G)
            'figuras':         ['figura','figuras'],
            'bases':           ['base','bases'],
            'macetas':         ['maceta','macetas'],
            'tazones':         ['tazon','tazones','tazón','tazónes'],
            'portavelas':      ['porta vela','porta velas','portavela','portavelas','porta_vela','porta_velas'],
            'portainciensos':  ['porta incienso','porta inciensos','portaincienso','portainciensos','porta_incienso','porta_inciensos'],
            'aditamentos':     ['aditamento','aditamentos']
        };
        return buscar.some(function(b) {
            const lista = variantes[b] || [b];
            return tipos.some(function(t) { return lista.includes(t); });
        });
    }

    function aplicarFiltrosUnificados(panel) {
        const inputMap = {
            arreglos:     'inputBusquedaArreglos',
            todos:        'inputBusquedaTodos',
            etiquetas:    'inputBusquedaEtiquetas',
            decoraciones: 'inputBusquedaDecoraciones'
        };
        const inputEl = document.getElementById(inputMap[panel]);
        const textoBusq = (inputEl ? inputEl.value : '').trim().toLowerCase();
        const filtros = filtrosUnificados[panel] || {};
        const formaActiva  = filtros.forma  || 'todos';
        const eventoActivo = filtros.evento || 'todos';

        // Modos que filtran por etiquetaprincipal directamente
        const modosPorEtiqueta = ['paquetes'];

        document.querySelectorAll('.card-dinamica').forEach(card => {
            const formaCard  = (card.dataset.forma  || '').toLowerCase();
            const eventoCard = (card.dataset.evento || '').toLowerCase();
            const nombreCard = (card.getAttribute('data-nombre') || '').toLowerCase();

            const okNombre = coincideNombre(nombreCard, textoBusq, card);
            const okForma  = formaActiva  === 'todos' || formaCard === formaActiva;
            const okEvento = eventoActivo === 'todos' || eventoCard.split(' ').includes(eventoActivo);

            // Si hay texto de búsqueda activo, ignorar el filtro de tipo y buscar en TODOS los productos
            if (textoBusq) {
                card.classList.toggle('oculto', !okNombre);
            } else if (modosPorEtiqueta.includes(panel)) {
                // Filtrar por etiquetaprincipal usando tieneTipo con el nombre del modo
                card.classList.toggle('oculto', !tieneTipo(card, panel));
            } else if (panel === 'decoraciones') {
                card.classList.toggle('oculto', !tieneTipo(card, 'decoracion'));
            } else if (panel === 'etiquetas') {
                card.classList.toggle('oculto', !(tieneTipo(card, 'etiqueta') && okEvento));
            } else if (panel === 'arreglos') {
                // Respetar también el filtro de precio activo en arreglos
                let okPrecio = true;
                if (precioArreglosActivo !== 'todos') {
                    const pAttr = tipoPrecioArreglos === 'bazar'
                        ? String(parseInt(card.getAttribute('data-precio-bazar') || '0', 10))
                        : String(parseInt(card.getAttribute('data-precio') || '0', 10));
                    okPrecio = pAttr === precioArreglosActivo;
                }
                card.classList.toggle('oculto', !(tieneTipo(card, 'arreglo') && okForma && okEvento && okPrecio));
            } else if (panel === 'mostrar_todo') {
                card.classList.toggle('oculto', false); // sin texto: mostrar todo
            } else {
                // panel === 'todos' (Productos): muestra solo los que tienen tipo 'producto'
                card.classList.toggle('oculto', !(tieneTipo(card, 'producto') && okForma && okEvento));
            }
        });

        if (typeof window.actualizarPaginacion === 'function') window.actualizarPaginacion();
    }

    // Cerrar dropdowns al hacer click fuera
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.barra-busqueda-unificada-wrap')) {
            document.querySelectorAll('.bbu-dropdown.abierto').forEach(dd => dd.classList.remove('abierto'));
            document.querySelectorAll('.bbu-btn-flecha.abierto').forEach(bf => bf.classList.remove('abierto'));
        }
    });

    // ===== FILTROS DE ARREGLOS (estilo yesos: Forma / Tamaño / Precio) =====
    let modoFiltroArreglos = 'forma';   // 'forma' | 'tamano'
    let formaArreglosActiva = 'todos';
    let tamanoArreglosActivo = 'todos';
    let tipoPrecioArreglos = 'original'; // 'original' | 'bazar'

    function cambiarModoFiltroArreglos(modo) {
        modoFiltroArreglos = modo;
        document.getElementById('btn-arreglos-modo-forma').classList.toggle('activo', modo === 'forma');
        document.getElementById('btn-arreglos-modo-tamano').classList.toggle('activo', modo === 'tamano');
        document.getElementById('panel-arreglos-forma').style.display = modo === 'forma' ? '' : 'none';
        document.getElementById('panel-arreglos-tamano').style.display = modo === 'tamano' ? '' : 'none';

        if (modo === 'forma') {
            tamanoArreglosActivo = 'todos';
        } else {
            formaArreglosActiva = 'todos';
            document.querySelectorAll('#panel-arreglos-tamano .btn-filtro').forEach(b => b.classList.remove('activo'));
            document.getElementById('btn-arreglos-tam-todos').classList.add('activo');
        }
        aplicarFiltrosArreglos();
    }

    function filtrarFormaArreglos(btn, forma) {
        formaArreglosActiva = forma;
        document.querySelectorAll('#menu-formas-arreglos .btn-filtro').forEach(b => b.classList.remove('activo'));
        btn.classList.add('activo');
        aplicarFiltrosArreglos();
    }

    function filtrarTamanoArreglos(btn, tam) {
        tamanoArreglosActivo = tam;
        document.querySelectorAll('#panel-arreglos-tamano .btn-filtro').forEach(b => b.classList.remove('activo'));
        btn.classList.add('activo');
        aplicarFiltrosArreglos();
    }

    let precioArreglosActivo = 'todos'; // precio exacto seleccionado

    function cambiarTipoPrecioArreglos(tipo) {
        tipoPrecioArreglos = tipo;
        document.getElementById('btn-arreglos-precio-original').classList.toggle('activo', tipo === 'original');
        document.getElementById('btn-arreglos-precio-bazar').classList.toggle('activo', tipo === 'bazar');
        // Resetear selección de precio al cambiar tipo
        precioArreglosActivo = 'todos';
        document.querySelectorAll('#lista-precios-arreglos .btn-precio-velas').forEach(b => b.classList.remove('activo'));
        const btnTodos = document.querySelector('#lista-precios-arreglos .btn-precio-velas');
        if (btnTodos) btnTodos.classList.add('activo');
        aplicarFiltrosArreglos();
    }

    function filtrarPrecioArreglos(btn, precio) {
        precioArreglosActivo = precio;
        document.querySelectorAll('#lista-precios-arreglos .btn-precio-velas').forEach(b => b.classList.remove('activo'));
        btn.classList.add('activo');

        // Si el modo activo es "Mostrar Todo", filtrar por precio sobre TODOS los tipos
        var btnModoActivo = document.querySelector('.btn-modo-velas.activo');
        if (!btnModoActivo || btnModoActivo.id === 'btnModoTodosProductos') {
            aplicarFiltroPrecioSobreTodo(precio, tipoPrecioArreglos);
        } else {
            aplicarFiltrosArreglos();
        }
    }

    // Filtra por precio exacto sobre TODOS los tipos sin restricción de categoría
    function aplicarFiltroPrecioSobreTodo(precio, tipoPrecio) {
        document.querySelectorAll('.card-dinamica').forEach(function(card) {
            if (precio === 'todos') {
                card.classList.remove('oculto');
            } else {
                var precioNormal = String(parseInt(card.getAttribute('data-precio') || '0', 10));
                var precioBazar  = String(parseInt(card.getAttribute('data-precio-bazar') || '0', 10));
                var precioCard   = tipoPrecio === 'bazar'
                    ? (precioBazar !== '0' ? precioBazar : precioNormal)
                    : (precioNormal !== '0' ? precioNormal : precioBazar);
                card.classList.toggle('oculto', precioCard !== String(precio));
            }
        });
        if (typeof window.actualizarPaginacion === 'function') window.actualizarPaginacion();
    }

    function aplicarFiltrosArreglos() {
        document.querySelectorAll('.card-dinamica').forEach(card => {
            let visible = true;

            // Solo mostrar tarjetas que tengan tipo arreglo
            if (!tieneTipo(card, 'arreglo')) {
                card.classList.add('oculto');
                return;
            }

            // Filtro por forma (usa data-forma)
            if (modoFiltroArreglos === 'forma' && formaArreglosActiva !== 'todos') {
                const formaCard = (card.getAttribute('data-forma') || '').toLowerCase();
                visible = formaCard === formaArreglosActiva;
            }

            // Filtro por tamaño (usa data-tamano si existe, si no muestra todo)
            if (modoFiltroArreglos === 'tamano' && tamanoArreglosActivo !== 'todos') {
                const tamCard = (card.getAttribute('data-tamano') || '').toLowerCase();
                visible = tamCard === tamanoArreglosActivo;
            }

            // Filtro por precio exacto según tipo seleccionado — usa data-attributes directamente
            if (precioArreglosActivo !== 'todos') {
                const precioNormalCard = String(parseInt(card.getAttribute('data-precio') || '0', 10));
                const precioBazarCard  = String(parseInt(card.getAttribute('data-precio-bazar') || '0', 10));
                let precioCard;
                if (tipoPrecioArreglos === 'bazar') {
                    precioCard = precioBazarCard !== '0' ? precioBazarCard : precioNormalCard;
                } else {
                    precioCard = precioNormalCard !== '0' ? precioNormalCard : precioBazarCard;
                }
                if (precioCard !== precioArreglosActivo) visible = false;
            }

            card.classList.toggle('oculto', !visible);
        });
        if (typeof window.actualizarPaginacion === 'function') window.actualizarPaginacion();
    }

    // Exponer funciones de filtros al scope global
    window.filtrarPrecioArreglos        = filtrarPrecioArreglos;
    window.aplicarFiltrosArreglos       = aplicarFiltrosArreglos;
    window.cambiarTipoPrecioArreglos    = cambiarTipoPrecioArreglos;
    window.cambiarModoFiltroArreglos    = cambiarModoFiltroArreglos;
    window.filtrarFormaArreglos         = filtrarFormaArreglos;
    window.filtrarTamanoArreglos        = filtrarTamanoArreglos;
    window.aplicarFiltrosUnificados     = aplicarFiltrosUnificados;
    window.filtrarPorNombreUnificado    = filtrarPorNombreUnificado;
    window.toggleDropdownFiltros        = toggleDropdownFiltros;
    window.toggleGrupoFiltro            = toggleGrupoFiltro;
    window.seleccionarTagFiltro         = seleccionarTagFiltro;

    // ===== FILTROS TODOS LOS PRODUCTOS =====
    function actualizarPrecio(val) {
        document.getElementById('txtPrecioMax').textContent = '$' + val + ' MXN';
        aplicarFiltrosTodos();
    }

    function filtrarPorNombreTodos(valor) {
        const btn = document.getElementById('btnLimpiarTodos');
        btn.classList.toggle('visible', valor.trim().length > 0);
        aplicarFiltrosTodos();
    }

    function limpiarBusquedaTodos() {
        document.getElementById('inputBusquedaTodos').value = '';
        document.getElementById('btnLimpiarTodos').classList.remove('visible');
        aplicarFiltrosTodos();
    }

    let tipoPrecioActual = 'original'; // 'original' | 'bazar'

    let precioExactoTodosActivo = 'todos'; // precio exacto seleccionado en panel "todos"

    function filtrarPrecioTodos(btn, precio) {
        precioExactoTodosActivo = precio;
        document.querySelectorAll('#lista-precios-todos .btn-precio-velas').forEach(b => b.classList.remove('activo'));
        btn.classList.add('activo');
        aplicarFiltrosPrecioExactoTodos();
    }

    function aplicarFiltrosPrecioExactoTodos() {
        // Delegar siempre a aplicarFiltrosTodos para que se respeten TODOS los filtros activos
        // (forma, evento, nombre, slider) ademas del precio exacto
        aplicarFiltrosTodos();
    }

    function cambiarTipoPrecio(tipo) {
        tipoPrecioActual = tipo;
        document.getElementById('btn-precio-original').classList.toggle('activo', tipo === 'original');
        document.getElementById('btn-precio-bazar').classList.toggle('activo', tipo === 'bazar');
        // Actualizar etiqueta del slider según tipo
        const label = document.getElementById('labelTipoPrecio');
        if (label) label.textContent = tipo === 'bazar' ? 'Precio Mayoreo Máximo:' : 'Precio Máximo:';
        // Resetear selección de precio exacto al cambiar tipo
        precioExactoTodosActivo = 'todos';
        const btnTd = document.querySelector('#lista-precios-todos .btn-precio-velas');
        document.querySelectorAll('#lista-precios-todos .btn-precio-velas').forEach(b => b.classList.remove('activo'));
        if (btnTd) btnTd.classList.add('activo');
        aplicarFiltrosPrecioExactoTodos();
    }

    function aplicarFiltrosTodos() {
        const formaActiva  = document.querySelector('#filtro-formas .btn-filtro.activo')?.dataset.forma || 'todos';
        const eventoActivo = document.querySelector('#filtro-eventos .btn-filtro.activo')?.dataset.evento || 'todos';
        const _sliderEl = document.getElementById('filtroPrecio');
        const precioMax    = _sliderEl ? parseInt(_sliderEl.value) : 99999;
        const textoBusq    = (document.getElementById('inputBusquedaTodos').value || '').trim().toLowerCase();

        document.querySelectorAll('.card-dinamica').forEach(card => {
            const formaCard  = card.dataset.forma || '';
            const eventoCard = card.dataset.evento || '';
            const nombreCard = (card.getAttribute('data-nombre') || '').toLowerCase();

            // Seleccionar precio segun tipo activo
            let precioCard;
            if (tipoPrecioActual === 'bazar') {
                precioCard = parseInt(card.getAttribute('data-precio-bazar') || card.getAttribute('data-precio') || '0');
            } else {
                precioCard = parseInt(card.getAttribute('data-precio') || '0');
            }

            const okForma   = formaActiva  === 'todos' || formaCard  === formaActiva;
            const okEvento  = eventoActivo === 'todos' || eventoCard.split(' ').includes(eventoActivo);
            const okNombre  = coincideNombre(nombreCard, textoBusq, card);

            // Si hay precio exacto activo (boton $15/$20/etc), tiene prioridad sobre el slider
            let okPrecio;
            if (precioExactoTodosActivo !== 'todos') {
                const precioNormalCard = String(parseInt(card.getAttribute('data-precio') || '0'));
                const precioBazarCard  = String(parseInt(card.getAttribute('data-precio-bazar') || '0'));
                if (tipoPrecioActual === 'bazar') {
                    // En modo mayoreo: primero bazar, si es 0 caer a precio normal
                    okPrecio = precioBazarCard !== '0'
                        ? precioBazarCard === String(precioExactoTodosActivo)
                        : precioNormalCard === String(precioExactoTodosActivo);
                } else {
                    // En modo original: primero precio normal, si es 0 caer a precio bazar
                    okPrecio = precioNormalCard !== '0'
                        ? precioNormalCard === String(precioExactoTodosActivo)
                        : precioBazarCard === String(precioExactoTodosActivo);
                }
            } else {
                okPrecio = precioCard <= precioMax;
            }

            card.classList.toggle('oculto', !(okForma && okEvento && okPrecio && okNombre));
        });
        if (typeof window.actualizarPaginacion === 'function') window.actualizarPaginacion();
    }

    // ===== SCROLL DE BARRA DE PRECIOS =====
    function scrollPrecios(id, px) {
        const el = document.getElementById(id);
        if (el) el.scrollBy({ left: px, behavior: 'smooth' });
    }

    // Inicializar listeners de filtros de botones (forma / evento)
    _ready(function() {
        document.querySelectorAll('#filtro-formas .btn-filtro').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#filtro-formas .btn-filtro').forEach(b => b.classList.remove('activo'));
                btn.classList.add('activo');
                aplicarFiltrosTodos();
            });
        });
        document.querySelectorAll('#filtro-eventos .btn-filtro').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#filtro-eventos .btn-filtro').forEach(b => b.classList.remove('activo'));
                btn.classList.add('activo');
                aplicarFiltrosTodos();
            });
        });
    });



// ═══ DRAWER ═══
function abrirDrawer() {
    document.getElementById('drawer').classList.add('activo');
    document.getElementById('drawerOverlay').classList.add('activo');
    actualizarEstadoSesionDrawer();
    if (!document.getElementById('drawerResultados').classList.contains('visible')) {
        mostrarSugerenciasDrawer();
    }
    // Empujar entrada al historial para que el botón "atrás" lo cierre
    history.pushState({ kukumitaModal: 'drawer' }, '');
}
function cerrarDrawer() {
    var drawer = document.getElementById('drawer');
    if (!drawer || !drawer.classList.contains('activo')) return;
    drawer.classList.remove('activo');
    document.getElementById('drawerOverlay').classList.remove('activo');
    // Si el estado actual es el del drawer, regresamos en el historial
    if (history.state && history.state.kukumitaModal === 'drawer') {
        history.replaceState(null, '');
    }
}
function toggleSubpanelDrawer(id) {
    document.getElementById(id).classList.toggle('visible');
    const tog = document.getElementById('toggleOscuroDrawer');
    if (tog) tog.classList.toggle('activo', document.body.classList.contains('modo-oscuro'));
}

// ═══ SESIÓN SIMULADA (conectar con Firebase cuando esté listo) ═══
function estaEnSesion() {
    return localStorage.getItem('velas-sesion-activa') === '1';
}

function actualizarEstadoSesionDrawer() {
    const conSesion = estaEnSesion();
    document.getElementById('drawerZonaSesion').classList.toggle('visible', !conSesion);
    document.getElementById('drawerPerfilBloque').style.display = conSesion ? 'flex' : 'none';
    if (conSesion) {
        const foto = localStorage.getItem('velas-foto-perfil');
        if (foto) document.getElementById('drawerAvatar').src = foto;
        const nombre = localStorage.getItem('velas-nombre-usuario') || 'Mi cuenta';
        document.getElementById('drawerNombreUsuario').textContent = nombre;
    }
}

function cerrarSesion() {
    localStorage.removeItem('velas-sesion-activa');
    localStorage.removeItem('velas-foto-perfil');
    localStorage.removeItem('velas-nombre-usuario');
    cerrarPantallaPerfil();
    actualizarEstadoSesionDrawer();
}

// ═══ PANTALLA PERFIL COMPLETA ═══
function abrirPantallaPerfil() {
    const foto = localStorage.getItem('velas-foto-perfil');
    if (foto) document.getElementById('pantallaAvatar').src = foto;
    document.getElementById('pantallaUsuarioNombre').textContent =
        localStorage.getItem('velas-nombre-usuario') || 'Mi cuenta';
    document.getElementById('pantallaPerfil').classList.add('activo');
    document.body.style.overflow = 'hidden';
    _modalActivo = 'perfil';
    history.pushState({ kukumitaModal: 'perfil' }, '');
}

// ─── SISTEMA CENTRALIZADO DE MODALES CON HISTORIAL ───
// Registra qué modal está abierto para que el botón "atrás" lo cierre
var _modalActivo = null; // nombre del modal activo

function _abrirModalConHistorial(nombre, abrirFn) {
    // Si ya hay un modal abierto, no apilamos otro pushState
    if (!_modalActivo) {
        history.pushState({ kukumitaModal: nombre }, '');
    }
    _modalActivo = nombre;
    document.body.style.overflow = 'hidden';
    abrirFn();
}

function _cerrarModalConHistorial(cerrarFn) {
    _modalActivo = null;
    document.body.style.overflow = '';
    cerrarFn();
    // Si el estado del historial fue empujado por este modal, retrocedemos
    if (history.state && history.state.kukumitaModal) {
        history.replaceState(null, '');
    }
}

// Escucha el botón "atrás" del dispositivo
window.addEventListener('popstate', function(e) {
    // Modal de cantidad — debe revisarse primero
    var modalCantidad = document.getElementById('modalCantidad');
    if (modalCantidad && modalCantidad.classList.contains('abierto')) {
        modalCantidad.classList.remove('abierto');
        document.body.style.overflow = '';
        _modalActivo = null;
        _mcCardActual = null;
        return;
    }
    // Drawer lateral
    var drawer = document.getElementById('drawer');
    if (drawer && drawer.classList.contains('activo')) {
        drawer.classList.remove('activo');
        document.getElementById('drawerOverlay').classList.remove('activo');
        return;
    }
    // Pantalla Perfil
    var pantallaPerfil = document.getElementById('pantallaPerfil');
    if (pantallaPerfil && pantallaPerfil.classList.contains('activo')) {
        pantallaPerfil.classList.remove('activo');
        _modalActivo = null;
        return;
    }
    // Pantalla Carrito
    var pantallaCarrito = document.getElementById('pantallaCarrito');
    if (pantallaCarrito && pantallaCarrito.classList.contains('activa')) {
        pantallaCarrito.classList.remove('activa');
        document.body.style.overflow = '';
        _modalActivo = null;
        // Restaurar burbuja al cerrar con botón atrás
        var burbujaBack = document.getElementById('burbujaCarrito');
        if (burbujaBack) { burbujaBack.style.removeProperty('display'); }
        actualizarBurbuja();
        return;
    }
    // Pantalla Favoritos
    var pantallaFavoritos = document.getElementById('pantallaFavoritos');
    if (pantallaFavoritos && pantallaFavoritos.classList.contains('activa')) {
        pantallaFavoritos.classList.remove('activa');
        document.body.style.overflow = '';
        _modalActivo = null;
        return;
    }
    // Modal de producto (ya tenía su propio manejo, lo respetamos)
    var modalProd = document.getElementById('modalProducto');
    if (modalProd && modalProd.classList.contains('abierto')) {
        modalProd.classList.remove('abierto');
        document.body.style.overflow = 'auto';
        _modalActivo = null;
        return;
    }
    // Modal Tienda
    var modalTienda = document.getElementById('modalTienda');
    if (modalTienda && modalTienda.classList.contains('abierto')) {
        modalTienda.classList.remove('abierto');
        document.body.style.overflow = '';
        _modalActivo = null;
        return;
    }
    // Modal Uber
    var modalUber = document.getElementById('modalUber');
    if (modalUber && modalUber.classList.contains('abierto')) {
        modalUber.classList.remove('abierto');
        document.body.style.overflow = '';
        _modalActivo = null;
        return;
    }
    // Modal Bazar
    var modalBazar = document.getElementById('modalBazar');
    if (modalBazar && (modalBazar.style.display === 'flex' || modalBazar.classList.contains('abierto'))) {
        if (typeof cerrarModalBazar === 'function') cerrarModalBazar();
        document.body.style.overflow = '';
        _modalActivo = null;
        return;
    }
    // Modal QR
    var modalQR = document.getElementById('modalQR');
    if (modalQR && modalQR.classList.contains('abierto')) {
        modalQR.classList.remove('abierto');
        _modalActivo = null;
        return;
    }
    // Modal Info Etiqueta
    var modalEtiq = document.getElementById('modalInfoEtiqueta');
    if (modalEtiq && modalEtiq.classList.contains('abierto')) {
        modalEtiq.classList.remove('abierto');
        document.body.style.overflow = '';
        _modalActivo = null;
        return;
    }
});

// ─── MODAL UBER ENVÍOS ───
function abrirModalUber() {
    history.pushState({ kukumitaModal: 'uber' }, '');
    _modalActivo = 'uber';
    document.getElementById('modalUber').classList.add('abierto');
    document.body.style.overflow = 'hidden';
}
function cerrarModalUber() {
    document.getElementById('modalUber').classList.remove('abierto');
    document.body.style.overflow = '';
    _modalActivo = null;
    if (history.state && history.state.kukumitaModal === 'uber') {
        history.replaceState(null, '');
    }
}

// ─── MODAL BÚSCANOS EN TIENDA ───
function abrirModalTienda() {
    history.pushState({ kukumitaModal: 'tienda' }, '');
    _modalActivo = 'tienda';
    document.getElementById('modalTienda').classList.add('abierto');
    document.body.style.overflow = 'hidden';
}
function cerrarModalTienda() {
    document.getElementById('modalTienda').classList.remove('abierto');
    document.body.style.overflow = '';
    _modalActivo = null;
    if (history.state && history.state.kukumitaModal === 'tienda') {
        history.replaceState(null, '');
    }
}

// ─── QR MODAL ───
function abrirModalQR() {
    const url = window.location.href;
    document.getElementById('qrUrlTexto').textContent = url;
    document.getElementById('modalQR').classList.add('abierto');
    generarQR(url);
}
function cerrarModalQR() {
    document.getElementById('modalQR').classList.remove('abierto');
}
_ready(function() {
    document.getElementById('modalQR').addEventListener('click', function(e) {
        if (e.target === this) cerrarModalQR();
    });
});

function generarQR(texto) {
    const canvas = document.getElementById('qrCanvas');
    const ctx = canvas.getContext('2d');
    const size = window.innerWidth >= 768 ? 380 : 200;
    canvas.width = size;
    canvas.height = size;

    if (window.QRious) {
        new QRious({ element: canvas, value: texto, size: size, backgroundAlpha: 1, foreground: '#362a22', background: '#fff', level: 'H' });
        return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js';
    script.onload = () => {
        new QRious({ element: canvas, value: texto, size: size, backgroundAlpha: 1, foreground: '#362a22', background: '#fff', level: 'H' });
    };
    script.onerror = () => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(texto);
        img.onload = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0,0,size,size); ctx.drawImage(img, 0, 0, size, size); };
    };
    document.head.appendChild(script);
}

// ─── COPIAR URL ───
async function copiarURL() {
    const url = window.location.href;
    try {
        await navigator.clipboard.writeText(url);
        const btn = document.getElementById('btnCopiarURL');
        const span = btn.querySelector('span');
        const textoOriginal = span ? span.textContent : '';
        if (span) span.textContent = '\u00a1Copiado!'; document.getElementById('btnCopiarTexto').textContent = '\u00a1Copiado!';
        setTimeout(() => { if (span) span.textContent = textoOriginal; document.getElementById('btnCopiarTexto').textContent = 'Copiar URL'; }, 2000);
        mostrarToast('\ud83d\udd17 URL copiada al portapapeles');
    } catch (e) {
        const temp = document.createElement('textarea');
        temp.value = url;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        mostrarToast('\ud83d\udd17 URL copiada al portapapeles');
    }
}
function cerrarPantallaPerfil() {
    document.getElementById('pantallaPerfil').classList.remove('activo');
    if (history.state && history.state.kukumitaModal === 'perfil') {
        history.replaceState(null, '');
    }
}

// ═══ FOTO DE PERFIL ═══
function elegirFotoGaleria() {
    document.getElementById('inputFotoPerfil').click();
}
function aplicarFotoPerfil(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;
    const user = (typeof auth !== 'undefined') ? auth.currentUser : null;

    // Vista previa inmediata mientras sube
    const reader = new FileReader();
    reader.onload = e => {
        const src = e.target.result;
        const avatarDrawer = document.getElementById('drawerAvatar');
        const avatarPantalla = document.getElementById('pantallaAvatar');
        if (avatarDrawer) avatarDrawer.src = src;
        if (avatarPantalla) avatarPantalla.src = src;
        localStorage.setItem('velas-foto-perfil', src); // fallback local
    };
    reader.readAsDataURL(archivo);

    // Subir a Firebase Storage si hay sesión
    if (user && typeof firebase !== 'undefined' && firebase.storage) {
        mostrarToast('⏳ Subiendo foto…');
        const storage = firebase.storage();
        const ref = storage.ref('fotos-perfil/' + user.uid + '/avatar.jpg');
        ref.put(archivo).then(function() {
            return ref.getDownloadURL();
        }).then(function(url) {
            return user.updateProfile({ photoURL: url }).then(function() {
                localStorage.setItem('velas-foto-perfil', url);
                const avatarDrawer = document.getElementById('drawerAvatar');
                const avatarPantalla = document.getElementById('pantallaAvatar');
                if (avatarDrawer) avatarDrawer.src = url;
                if (avatarPantalla) avatarPantalla.src = url;
                mostrarToast('✅ Foto de perfil actualizada');
            });
        }).catch(function(err) {
            console.error('Error subiendo foto:', err);
            mostrarToast('⚠️ Foto guardada solo en este dispositivo');
        });
    } else {
        mostrarToast('✅ Foto actualizada en este dispositivo');
    }
}

_ready(function() {
    actualizarEstadoSesionDrawer();
});

// Swipe desde borde izquierdo para abrir
(function() {
    var startX = 0, startY = 0, tocandoBorde = false;
    document.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        tocandoBorde = startX < 24;
    }, { passive: true });
    document.addEventListener('touchend', function(e) {
        if (!tocandoBorde) return;
        var dx = e.changedTouches[0].clientX - startX;
        var dy = Math.abs(e.changedTouches[0].clientY - startY);
        if (dx > 50 && dy < 60) abrirDrawer();
    }, { passive: true });
})();

// ═══ BÚSQUEDA EN DRAWER ═══
function obtenerProductosDrawer() {
    return Array.from(document.querySelectorAll('#gridProductos .card-dinamica')).map(function(card) {
        return {
            nombre: card.getAttribute('data-nombre') || '',
            precio: card.getAttribute('data-precio') || '',
            img: (card.querySelector('.img-contenedor-dinamico img') || {}).src || '',
            card: card
        };
    });
}
function mostrarSugerenciasDrawer() {
    var prods = obtenerProductosDrawer().slice(0, 3);
    renderizarResultadosDrawer(prods, 'Productos destacados');
}
function _normDrawer(str) {
    return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Sinónimos para la búsqueda del drawer (misma tabla que coincideNombre)
var _SINONIMOS_DRAWER = [
    ['tazon','tason','tazones','tasones','bowl','tazón','tasón'],
    ['virgen','virjen','birgen','birjen','virgin'],
    ['elefante','elefantes'],
    ['arreglo','arreglos'],
    ['vela','velas'],
    ['figura','figuras'],
    ['flores','flor'],
];
function _expandirDrawer(palabra) {
    for (var i = 0; i < _SINONIMOS_DRAWER.length; i++) {
        if (_SINONIMOS_DRAWER[i].indexOf(palabra) !== -1) return _SINONIMOS_DRAWER[i];
    }
    return [palabra];
}
function _coincideDrawer(nombre, query, card) {
    var texto = _normDrawer(nombre);
    if (card) {
        texto += ' ' + _normDrawer(card.getAttribute('data-tipos') || '');
        texto += ' ' + _normDrawer(card.getAttribute('data-subtags') || '');
    }
    var palabras = _normDrawer(query).split(/\s+/).filter(function(p){ return p.length >= 2; });
    if (!palabras.length) return true;
    return palabras.every(function(p) {
        return _expandirDrawer(p).some(function(v){ return texto.includes(v); });
    });
}

function ejecutarBusquedaDrawer() {
    var rawQuery = document.getElementById('drawerInputBusqueda').value.trim();
    var query    = rawQuery.toLowerCase();
    if (!query) { mostrarSugerenciasDrawer(); return; }

    // Mostrar TODOS los resultados en el catálogo principal:
    // 1. Cerrar drawer
    cerrarDrawer();
    // 2. Cambiar a modo "mostrar todo" para que no haya filtro de tipo
    if (typeof window.cambiarModoVelas === 'function') window.cambiarModoVelas('mostrar_todo');
    // 3. Filtrar todas las cards por query (con acento y sinónimos)
    var cards = document.querySelectorAll('#gridProductos .card-dinamica');
    var total = 0;
    cards.forEach(function(card) {
        var nombre = card.getAttribute('data-nombre') || '';
        var match  = _coincideDrawer(nombre, query, card);
        card.classList.toggle('oculto', !match);
        card.classList.remove('paginacion-oculto');
        if (match) total++;
    });
    // 4. Repaginar
    if (typeof window.actualizarPaginacion === 'function') window.actualizarPaginacion();
    // 5. Scroll al catálogo
    var grid = document.getElementById('gridProductos');
    if (grid) setTimeout(function(){ grid.scrollIntoView({ behavior:'smooth', block:'start' }); }, 100);
    // 6. Toast informativo
    if (typeof mostrarToast === 'function') {
        mostrarToast(total > 0
            ? '🔍 ' + total + ' resultado' + (total !== 1 ? 's' : '') + ' para "' + rawQuery + '"'
            : '😕 Sin resultados para "' + rawQuery + '"');
    }
}
function renderizarResultadosDrawer(lista, titulo) {
    var cont = document.getElementById('drawerResultados');
    var listaEl = document.getElementById('drawerListaResultados');
    var sinRes = document.getElementById('drawerSinResultados');
    var tituloEl = document.getElementById('drawerRecTitulo');
    cont.classList.add('visible');
    tituloEl.textContent = titulo;
    listaEl.innerHTML = '';
    sinRes.style.display = 'none';
    if (lista.length === 0) { sinRes.style.display = 'block'; return; }
    lista.slice(0, 4).forEach(function(p) {
        var item = document.createElement('div');
        item.className = 'drawer-rec-item';
        item.innerHTML = '<img class="drawer-rec-img" src="' + p.img + '" alt="' + p.nombre + '" onerror="this.style.background=\'#eee\'">'
            + '<div class="drawer-rec-info"><p class="drawer-rec-nombre">' + p.nombre + '</p>'
            + '<p class="drawer-rec-precio">$' + p.precio + ' MXN</p></div>'
            + '<span style="color:#bbb;">›</span>';
        item.onclick = function() {
            cerrarDrawer();
            p.card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(function() {
                var btn = p.card.querySelector('button');
                if (btn) btn.click();
            }, 400);
        };
        listaEl.appendChild(item);
    });
}





// ═══════════════════════════════════════════
//  FIREBASE CONFIGURACIÓN
// ═══════════════════════════════════════════
const firebaseConfig = {
    apiKey: "AIzaSyAkyPOwwU-HoDAVqNcMKIkiI7pkBhpTRmw",
    authDomain: "yesos-kukumita.firebaseapp.com",
    projectId: "yesos-kukumita",
    storageBucket: "yesos-kukumita.firebasestorage.app",
    messagingSenderId: "784730667884",
    appId: "1:784730667884:web:95e50565255b6e1d379149",
    measurementId: "G-B3ST4NJR1G"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const providerGoogle = new firebase.auth.GoogleAuthProvider();

// ─── TOAST ───
function mostrarToast(msg) {
    const t = document.getElementById('toastNotif');
    t.textContent = msg;
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), 2800);
}

// ─── MODAL GOOGLE ───
function abrirModalGoogle() {
    document.getElementById('modalGoogleAuth').classList.add('abierto');
}
function cerrarModalGoogle() {
    document.getElementById('modalGoogleAuth').classList.remove('abierto');
}

// ─── INICIAR SESIÓN CON GOOGLE ───
async function iniciarSesionGoogle() {
    try {
        const result = await auth.signInWithPopup(providerGoogle);
        cerrarModalGoogle();
        cerrarDrawer();
    } catch (e) {
        console.error('[Auth Error]', e.code, e.message);

        // Popup bloqueado o cerrado por el usuario → intentar con redirect
        if (
            e.code === 'auth/popup-blocked' ||
            e.code === 'auth/popup-closed-by-user' ||
            e.code === 'auth/cancelled-popup-request'
        ) {
            try {
                mostrarToast('⏳ Redirigiendo para iniciar sesión…');
                await auth.signInWithRedirect(providerGoogle);
                // La página se recargará; el resultado se maneja en getRedirectResult abajo
            } catch (e2) {
                console.error('[Redirect fallback error]', e2.code, e2.message);
                mostrarToast('No se pudo iniciar sesión. Intenta de nuevo.');
            }
            return;
        }

        // Dominio no autorizado en Firebase Console
        if (e.code === 'auth/unauthorized-domain') {
            mostrarToast('❌ Dominio no autorizado. Avisa al administrador.');
            console.warn('Agrega este dominio en Firebase Console → Authentication → Settings → Authorized domains:', window.location.hostname);
            return;
        }

        // Proveedor Google no habilitado
        if (e.code === 'auth/operation-not-allowed') {
            mostrarToast('❌ Inicio con Google no habilitado. Avisa al administrador.');
            console.warn('Habilita el proveedor Google en Firebase Console → Authentication → Sign-in method.');
            return;
        }

        // Red o configuración de Firebase incorrecta
        if (e.code === 'auth/network-request-failed') {
            mostrarToast('Sin conexión. Revisa tu internet e intenta de nuevo.');
            return;
        }

        // Cualquier otro error: mostrar código para facilitar el diagnóstico
        mostrarToast('Error al iniciar sesión (' + (e.code || 'desconocido') + ')');
    }
}

// ─── MANEJAR RESULTADO DE REDIRECT (para móvil / Safari) ───
auth.getRedirectResult().then(result => {
    if (result && result.user) {
        cerrarModalGoogle();
        if (typeof cerrarDrawer === 'function') cerrarDrawer();
    }
}).catch(e => {
    if (e.code && e.code !== 'auth/no-auth-event') {
        console.error('[Redirect result error]', e.code, e.message);
        mostrarToast('Error al completar el inicio de sesión (' + e.code + ')');
    }
});

// ─── CERRAR SESIÓN (override del anterior) ───
function cerrarSesion() {
    auth.signOut().then(() => {
        cerrarPantallaPerfil();
        mostrarToast('Sesión cerrada');
    });
}

// ─── ESCUCHAR CAMBIOS DE SESIÓN ───
auth.onAuthStateChanged(user => {
    if (user) {
        // Guardar datos en localStorage como cache visual
        localStorage.setItem('velas-sesion-activa', '1');
        if (user.photoURL) localStorage.setItem('velas-foto-perfil', user.photoURL);
        localStorage.setItem('velas-nombre-usuario', user.displayName || 'Mi cuenta');
        localStorage.setItem('velas-email-usuario', user.email || '');
        localStorage.setItem('velas-proveedor', user.providerData[0]?.providerId || '');
    } else {
        localStorage.removeItem('velas-sesion-activa');
        localStorage.removeItem('velas-foto-perfil');
        localStorage.removeItem('velas-nombre-usuario');
        localStorage.removeItem('velas-email-usuario');
        localStorage.removeItem('velas-proveedor');
    }
    actualizarEstadoSesionDrawer();
    actualizarPantallaPerfil();
});

// ─── ACTUALIZAR PANTALLA PERFIL CON DATOS REALES ───
function actualizarPantallaPerfil() {
    const user = auth.currentUser;
    if (!user) return;

    const foto = user.photoURL || '';
    const nombre = user.displayName || 'Mi cuenta';
    const email = user.email || '';
    const esGoogle = user.providerData.some(p => p.providerId === 'google.com');

    const avatarEl = document.getElementById('pantallaAvatar');
    const nombreEl = document.getElementById('pantallaUsuarioNombre');
    const subNombre = document.getElementById('subNombreActual');
    const subContrasena = document.getElementById('subContrasenaInfo');
    const btnContrasena = document.getElementById('btnContrasena');

    if (avatarEl && foto) avatarEl.src = foto;
    if (nombreEl) nombreEl.textContent = nombre;
    if (subNombre) subNombre.textContent = nombre + (email ? '  ·  ' + email : '');

    if (esGoogle) {
        if (subContrasena) subContrasena.textContent = 'Cuenta Google — sin contraseña local';
        if (btnContrasena) {
            btnContrasena.querySelector('div').innerHTML =
                'Contraseña <span class="op-sub">Cuenta Google — sin contraseña local</span>';
            btnContrasena.style.opacity = '0.5';
            btnContrasena.style.cursor = 'default';
            btnContrasena.onclick = () => mostrarToast('Tu cuenta usa Google. No necesitas contraseña.');
        }
    } else {
        if (btnContrasena) btnContrasena.onclick = gestionarContrasena;
    }
}

// ─── CAMBIAR NOMBRE DE USUARIO ───
function cambiarNombreUsuario() {
    var panel = document.getElementById('panelEditarNombre');
    if (!panel) return;
    var abierto = panel.classList.toggle('abierto');
    if (abierto) {
        var user = auth.currentUser;
        var input = document.getElementById('inputNuevoNombre');
        if (input && user) input.value = user.displayName || '';
        if (input) setTimeout(function(){ input.focus(); input.select(); }, 50);
    }
}

async function guardarNuevoNombre() {
    const user = auth.currentUser;
    if (!user) return;
    const input = document.getElementById('inputNuevoNombre');
    const nuevoNombre = input ? input.value.trim() : '';
    if (!nuevoNombre) { mostrarToast('Escribe un nombre válido'); return; }
    try {
        await user.updateProfile({ displayName: nuevoNombre });
        localStorage.setItem('velas-nombre-usuario', nuevoNombre);
        document.getElementById('pantallaUsuarioNombre').textContent = nuevoNombre;
        document.getElementById('drawerNombreUsuario').textContent = nuevoNombre;
        const subNombre = document.getElementById('subNombreActual');
        if (subNombre) subNombre.textContent = nuevoNombre + '  ·  ' + (user.email || '');
        document.getElementById('panelEditarNombre').classList.remove('abierto');
        mostrarToast('✅ Nombre actualizado');
    } catch (e) {
        mostrarToast('Error al actualizar el nombre');
    }
}

// ─── GESTIONAR CONTRASEÑA ───
async function gestionarContrasena() {
    const user = auth.currentUser;
    if (!user) return;
    const esGoogle = user.providerData.some(p => p.providerId === 'google.com');
    if (esGoogle) {
        mostrarToast('Tu cuenta usa Google. No necesitas contraseña.');
        return;
    }
    // Enviar email de restablecimiento
    const confirmado = confirm('¿Enviar un correo para restablecer tu contraseña a ' + user.email + '?');
    if (!confirmado) return;
    try {
        await auth.sendPasswordResetEmail(user.email);
        mostrarToast('📧 Correo enviado a ' + user.email);
    } catch (e) {
        mostrarToast('Error al enviar el correo');
    }
}

// ─── FOTO DE PERFIL (override con Firebase Storage si se desea) ───
function aplicarFotoPerfil(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;
    const user = (typeof auth !== 'undefined') ? auth.currentUser : null;

    // Vista previa inmediata
    const reader = new FileReader();
    reader.onload = e => {
        const src = e.target.result;
        const avatarDrawer = document.getElementById('drawerAvatar');
        const avatarPantalla = document.getElementById('pantallaAvatar');
        if (avatarDrawer) avatarDrawer.src = src;
        if (avatarPantalla) avatarPantalla.src = src;
        localStorage.setItem('velas-foto-perfil', src);
    };
    reader.readAsDataURL(archivo);

    // Subir a Firebase Storage si hay sesión
    if (user && typeof firebase !== 'undefined' && firebase.storage) {
        mostrarToast('⏳ Subiendo foto…');
        const storage = firebase.storage();
        const ref = storage.ref('fotos-perfil/' + user.uid + '/avatar.jpg');
        ref.put(archivo).then(function() {
            return ref.getDownloadURL();
        }).then(function(url) {
            return user.updateProfile({ photoURL: url }).then(function() {
                localStorage.setItem('velas-foto-perfil', url);
                const avatarDrawer = document.getElementById('drawerAvatar');
                const avatarPantalla = document.getElementById('pantallaAvatar');
                if (avatarDrawer) avatarDrawer.src = url;
                if (avatarPantalla) avatarPantalla.src = url;
                mostrarToast('✅ Foto de perfil actualizada');
            });
        }).catch(function(err) {
            console.error('Error subiendo foto:', err);
            mostrarToast('⚠️ Foto guardada solo en este dispositivo');
        });
    } else {
        mostrarToast('✅ Foto actualizada en este dispositivo');
    }
}

// ─── ABRIR PANTALLA PERFIL (override con datos reales) ───
function abrirPantallaPerfil() {
    actualizarPantallaPerfil();
    // Fallback si Firebase aún no tiene usuario pero hay sesión guardada
    const foto = (auth.currentUser?.photoURL) || localStorage.getItem('velas-foto-perfil');
    const nombre = (auth.currentUser?.displayName) || localStorage.getItem('velas-nombre-usuario') || 'Mi cuenta';
    const avatarEl = document.getElementById('pantallaAvatar');
    const nombreEl = document.getElementById('pantallaUsuarioNombre');
    if (avatarEl && foto) avatarEl.src = foto;
    if (nombreEl) nombreEl.textContent = nombre;
    document.getElementById('pantallaPerfil').classList.add('activo');
    document.body.style.overflow = 'hidden';
    _modalActivo = 'perfil';
    history.pushState({ kukumitaModal: 'perfil' }, '');
}



// ═══ ETIQUETA "VELA" EN TODAS LAS CARDS ═══
document.querySelectorAll('.card-dinamica').forEach(function(card) {
    card.setAttribute('data-tags', 'vela');
    const tagDivs = Array.from(card.querySelectorAll('div[style*="display: flex"][style*="gap: 5px"]')).filter(function(div) {
        return div.querySelectorAll('span[style*="background"]').length > 0 
            && div.querySelectorAll('.recuadro-item').length === 0;
    });
    tagDivs.forEach(function(div) { div.style.display = 'none'; });
});

// ═══ BÚSQUEDA EN DRAWER: wrapper legacy (ya no necesita caso especial, todo va al catálogo) ═══
// Se conserva por compatibilidad pero la función ejecutarBusquedaDrawer ya maneja todo.



// ===== PÍLDORAS (BIOGRAFÍA / OFERTAS / MÁS VENDIDOS) =====
var _pillBtns   = { biografia:'pillBiografia', productos:'pillProductos', ofertas:'pillOfertas', masvendidos:'pillMasVendidos' };
var _pillPanels = { biografia:'panelPillBiografia', productos:null, ofertas:'panelPillOfertas', masvendidos:'panelPillMasVendidos' };

function activarPill(cual) {
    // Desactivar todos
    Object.values(_pillBtns).forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('activo');
    });
    // FIX: filtrar nulls para evitar getElementById(null) que rompe el script
    Object.values(_pillPanels).filter(Boolean).forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('activo');
    });

    // Activar el seleccionado
    var btnEl = document.getElementById(_pillBtns[cual]);
    if (btnEl) btnEl.classList.add('activo');
    var panelId = _pillPanels[cual];
    var panelEl = panelId ? document.getElementById(panelId) : null;
    if (panelEl) panelEl.classList.add('activo');

    // Mostrar/ocultar catálogo de productos
    var catalogo = document.getElementById('zona-catalogo');
    if (catalogo) catalogo.style.display = (cual === 'biografia') ? 'none' : 'block';

    if (cual === 'productos') {
        setTimeout(function() {
            if (catalogo) catalogo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
    }
}

// ===== PREFERENCIA DE PÁGINA DE INICIO =====
function setPaginaInicio(cual) {
    localStorage.setItem('kukumita-inicio', cual);
    _actualizarBotonesInicio(cual);
    activarPill(cual);
}

function _actualizarBotonesInicio(cual) {
    var btnProd = document.getElementById('btnInicioProductos');
    var btnBio  = document.getElementById('btnInicioBiografia');
    if (!btnProd || !btnBio) return;
    if (cual === 'productos') {
        btnProd.style.background = '#8c7565';
        btnProd.style.color      = 'white';
        btnProd.style.borderColor= '#8c7565';
        btnBio.style.background  = '';
        btnBio.style.color       = '';
        btnBio.style.borderColor = '';
    } else {
        btnBio.style.background  = '#8c7565';
        btnBio.style.color       = 'white';
        btnBio.style.borderColor = '#8c7565';
        btnProd.style.background = '';
        btnProd.style.color      = '';
        btnProd.style.borderColor= '';
    }
}

// Aplicar preferencia guardada (o productos por defecto)
(function() {
    var pref = localStorage.getItem('kukumita-inicio') || 'productos';
    _ready(function() {
        activarPill(pref);
        _actualizarBotonesInicio(pref);
    });
})();

// ===== FAVORITOS =====
// Los IDs se guardan como enteros. listaProductos es la fuente de verdad.
var favoritos = (JSON.parse(localStorage.getItem('kukumita-favoritos') || '[]')).map(Number);

function _guardarFavoritos() {
    localStorage.setItem('kukumita-favoritos', JSON.stringify(favoritos));
}

function esFavorito(card) {
    if (!card) return false;
    var idx = parseInt(card.getAttribute('data-idx'));
    return !isNaN(idx) && favoritos.indexOf(idx) !== -1;
}

function _syncTodo(idx, esFav) {
    // 1. Botón exterior en la tarjeta del catálogo
    var card = document.querySelector('[data-idx="' + idx + '"]');
    if (card) {
        var like = card.querySelector('.btn-like');
        if (like) { like.textContent = esFav ? '❤️' : '🤍'; like.classList.toggle('liked', esFav); }
    }
    // 2. Botón dentro del modal si el modal está mostrando este producto
    var mpBtnFav = document.getElementById('mpBtnFavoritos');
    if (mpBtnFav && mpBtnFav._cardIdx === idx) {
        mpBtnFav.classList.toggle('guardado', esFav);
        mpBtnFav.textContent = esFav ? '❤️ En Favoritos' : '❤️ Favoritos';
    }
    // 3. Panel de favoritos si está abierto
    var panel = document.getElementById('pantallaFavoritos');
    if (panel && panel.classList.contains('activa')) renderizarFavoritos();
}

// ── Modal de login requerido para favoritos ──
function _mostrarModalLoginFavoritos() {
    // Si ya existe el modal, solo mostrarlo
    var m = document.getElementById('modalLoginFavoritos');
    if (!m) {
        m = document.createElement('div');
        m.id = 'modalLoginFavoritos';
        m.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;';
        m.innerHTML = [
            '<div style="background:#fff;border-radius:20px;max-width:340px;width:100%;padding:32px 24px 24px;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,0.25);position:relative;">',
            '<div style="font-size:2.8rem;margin-bottom:10px;">❤️</div>',
            '<h3 style="margin:0 0 8px;font-size:1.15rem;font-weight:800;color:#362a22;">Inicia sesión para guardar favoritos</h3>',
            '<p style="font-size:0.88rem;color:#8c7565;margin:0 0 22px;line-height:1.6;">Para guardar productos en tu lista de favoritos necesitas tener una cuenta.</p>',
            '<button onclick="cerrarDrawer();document.getElementById(\'modalLoginFavoritos\').remove();iniciarSesionGoogle();" ',
            'style="width:100%;background:linear-gradient(135deg,#f5a623,#e8921a);color:#fff;border:none;border-radius:999px;padding:13px 20px;font-size:0.95rem;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:10px;transition:opacity .2s;" ',
            'onmouseover="this.style.opacity=\'0.88\'" onmouseout="this.style.opacity=\'1\'">',
            '🔑 Iniciar sesión / Registrarse</button>',
            '<button onclick="document.getElementById(\'modalLoginFavoritos\').remove()" ',
            'style="width:100%;background:transparent;color:#8c7565;border:2px solid #e8ddd5;border-radius:999px;padding:11px 20px;font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit;transition:border-color .2s;" ',
            'onmouseover="this.style.borderColor=\'#8c7565\'" onmouseout="this.style.borderColor=\'#e8ddd5\'">',
            'Continuar sin cuenta</button>',
            '</div>'
        ].join('');
        // Cerrar al hacer clic en el fondo
        m.addEventListener('click', function(e){ if(e.target===m) m.remove(); });
        document.body.appendChild(m);
    } else {
        m.style.display = 'flex';
    }
}

function toggleFavoritoCard(card) {
    if (!estaEnSesion()) { _mostrarModalLoginFavoritos(); return; }
    var idx = card ? parseInt(card.getAttribute('data-idx')) : NaN;
    if (isNaN(idx)) return;
    var pos = favoritos.indexOf(idx);
    var esFav;
    if (pos === -1) { favoritos.push(idx); esFav = true; }
    else { favoritos.splice(pos, 1); esFav = false; }
    _guardarFavoritos();
    _syncTodo(idx, esFav);
}

function toggleLike(productoIdx, btn) {
    if (!estaEnSesion()) { _mostrarModalLoginFavoritos(); return; }
    var idx = parseInt(productoIdx);
    if (isNaN(idx)) return;
    var pos = favoritos.indexOf(idx);
    var esFav;
    if (pos === -1) { favoritos.push(idx); esFav = true; }
    else { favoritos.splice(pos, 1); esFav = false; }
    _guardarFavoritos();
    _syncTodo(idx, esFav);
}

function abrirPantallaFavoritos() {
    var overlay = document.getElementById('drawerOverlay');
    var drawer = document.getElementById('drawer') || document.getElementById('drawerLateral');
    if (overlay) overlay.style.display = 'none';
    if (drawer) drawer.classList.remove('abierto');
    renderizarFavoritos();
    document.getElementById('pantallaFavoritos').classList.add('activa');
    document.body.style.overflow = 'hidden';
    _modalActivo = 'favoritos';
    // Siempre empujar una entrada propia al historial
    history.pushState({ kukumitaModal: 'favoritos' }, '');
}

function cerrarFavoritos() {
    var pantalla = document.getElementById('pantallaFavoritos');
    if (!pantalla || !pantalla.classList.contains('activa')) return;
    pantalla.classList.remove('activa');
    document.body.style.overflow = '';
    _modalActivo = null;
    if (history.state && history.state.kukumitaModal === 'favoritos') {
        history.replaceState(null, '');
    }
}

function renderizarFavoritos() {
    var grid = document.getElementById('favGrid');
    var vacio = document.getElementById('favVacio');
    if (!grid) return;
    grid.innerHTML = '';
    if (favoritos.length === 0) {
        vacio.style.display = 'block';
        grid.style.display = 'none';
        return;
    }
    vacio.style.display = 'none';
    grid.style.display = 'grid';
    favoritos.forEach(function(idxProd) {
        // Buscar en listaProductos primero (fuente de verdad, siempre disponible)
        var prod = (typeof listaProductos !== 'undefined')
            ? listaProductos.find(function(p) { return p.id === idxProd; })
            : null;
        // Si no está en lista, intenta desde el DOM como fallback
        var card = document.querySelector('[data-idx="' + idxProd + '"]');

        var nombre = prod ? prod.nombre : (card ? (card.querySelector('h3') || {}).textContent : 'Producto');
        var precio = prod ? ('$' + (prod.precioBazar || prod.precioNormal || '') + ' MXN') : '';
        var imgSrc = prod ? (prod.imagen || (prod.imagenes && prod.imagenes[0]) || '') :
                    (card ? ((card.querySelector('img') || {}).src || '') : '');

        var div = document.createElement('div');
        div.className = 'fav-card';
        div.innerHTML =
            '<button class="btn-quitar-fav" onclick="quitarFavorito(' + idxProd + ')">✕</button>' +
            (imgSrc ? '<img class="fav-card-img" src="' + imgSrc + '" alt="' + (nombre||'') + '">' :
                      '<div class="fav-card-img" style="background:#f0eae4;display:flex;align-items:center;justify-content:center;font-size:2rem;">🕯️</div>') +
            '<div class="fav-card-info">' +
            '<div class="fav-card-nombre">' + (nombre || 'Producto') + '</div>' +
            '<div class="fav-card-precio">' + precio + '</div>' +
            '</div>';
        div.onclick = function(e) {
            if (e.target.classList.contains('btn-quitar-fav')) return;
            cerrarFavoritos();
            setTimeout(function() {
                var c = document.querySelector('[data-idx="' + idxProd + '"]');
                if (c) c.scrollIntoView({ behavior:'smooth', block:'center' });
            }, 200);
        };
        grid.appendChild(div);
    });
}

function quitarFavorito(idxProd) {
    var idx = parseInt(idxProd);
    var pos = favoritos.indexOf(idx);
    if (pos !== -1) favoritos.splice(pos, 1);
    _guardarFavoritos();
    _syncTodo(idx, false);
    renderizarFavoritos();
}

// Sincronizar botones like al terminar de renderizar el catálogo
function syncBotonesLike() {
    var tarjetas = document.querySelectorAll('[data-idx]');
    tarjetas.forEach(function(card) {
        var idx = parseInt(card.getAttribute('data-idx'));
        if (isNaN(idx)) return;
        var esFav = favoritos.indexOf(idx) !== -1;
        var like = card.querySelector('.btn-like');
        if (like) { like.textContent = esFav ? '❤️' : '🤍'; like.classList.toggle('liked', esFav); }
    });
}
_ready(syncBotonesLike);



function abrirModalBazar() {
    var modal = document.getElementById('modalBazar');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    if (typeof window._actualizarContadorBazar === 'function') window._actualizarContadorBazar();
}
function cerrarModalBazar() {
    var modal = document.getElementById('modalBazar');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}
// Cierra al hacer clic en el fondo oscuro
document.getElementById('modalBazar').addEventListener('click', function(e) {
    if (e.target === this) cerrarModalBazar();
});
// Responsive: centrado en escritorio
(function() {
    var style = document.createElement('style');
    style.textContent = '@media (min-width:600px) { #modalBazar { align-items:center !important; padding:16px !important; } #modalBazar > div { border-radius:16px !important; height:auto !important; max-height:92vh !important; } }';
    document.head.appendChild(style);
})();



(function() {
    // ── AQUÍ AÑADES TUS LINKS DE FACEBOOK ──
    // Pega el link directo de cada imagen copiada desde Facebook
    var imagenesGaleriaFB = [
        // Ejemplo de estructura (reemplaza con tus URLs reales de Facebook):
        // "https://scontent.xx.fbcdn.net/v/t1.0-0/...",
        // "https://scontent.xx.fbcdn.net/v/t1.0-0/...",
    ];

    var POR_PAGINA = 12;
    var paginaActual = 1;

    function totalPaginas() {
        return Math.max(1, Math.ceil(imagenesGaleriaFB.length / POR_PAGINA));
    }

    function renderizarGaleriaFB() {
        var grid = document.getElementById('galeria-facebook-grid');
        var pagNav = document.getElementById('galeria-facebook-paginacion');
        if (!grid || !pagNav) return;

        grid.innerHTML = '';
        pagNav.innerHTML = '';

        var inicio = (paginaActual - 1) * POR_PAGINA;
        var fin = Math.min(inicio + POR_PAGINA, imagenesGaleriaFB.length);
        var imagenesPagina = imagenesGaleriaFB.slice(inicio, fin);

        if (imagenesGaleriaFB.length === 0) {
            // Mostrar slots vacíos de ejemplo cuando no hay imágenes
            for (var i = 0; i < 3; i++) {
                var slot = document.createElement('div');
                slot.style.cssText = 'aspect-ratio:1/1; border-radius:8px; overflow:hidden; background:#f5f0eb; border:1px dashed #d4c5b8; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#b09080; font-size:0.75rem; text-align:center; padding:12px; box-sizing:border-box;';
                slot.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#c9b8a8" stroke-width="1.5" style="margin-bottom:8px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span>Imagen de<br>Facebook<br>próximamente</span>';
                grid.appendChild(slot);
            }
        } else {
            imagenesPagina.forEach(function(src) {
                var card = document.createElement('div');
                card.style.cssText = 'aspect-ratio:1/1; border-radius:8px; overflow:hidden; background:#f5f0eb; border:1px solid #e8ddd5; cursor:zoom-in; position:relative;';
                var img = document.createElement('img');
                img.src = src;
                img.loading = 'lazy';
                img.referrerpolicy = 'no-referrer';
                img.crossorigin = 'anonymous';
                img.style.cssText = 'width:100%; height:100%; object-fit:cover; display:block; transition:transform 0.25s;';
                img.onerror = function() {
                    card.innerHTML = '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f5f0eb;color:#b09080;font-size:0.72rem;text-align:center;padding:10px;box-sizing:border-box;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c9b8a8" stroke-width="1.5" style="margin-bottom:6px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg><span>No se pudo<br>cargar</span></div>';
                };
                card.addEventListener('mouseenter', function() { img.style.transform = 'scale(1.04)'; });
                card.addEventListener('mouseleave', function() { img.style.transform = 'scale(1)'; });
                // Lightbox simple al tocar la imagen
                card.addEventListener('click', function() { abrirLightboxFB(src); });
                card.appendChild(img);
                grid.appendChild(card);
            });
        }

        // Paginación — solo si hay más de una página
        if (totalPaginas() > 1) {
            // Botón anterior
            var btnPrev = document.createElement('button');
            btnPrev.textContent = '‹ Anterior';
            btnPrev.disabled = paginaActual === 1;
            btnPrev.style.cssText = 'padding:8px 18px; border-radius:999px; border:2px solid #d4c5b8; background:' + (paginaActual === 1 ? '#f0eae4' : '#fff') + '; color:' + (paginaActual === 1 ? '#bbb' : '#5c4d43') + '; font-size:0.88rem; font-weight:700; cursor:' + (paginaActual === 1 ? 'default' : 'pointer') + '; transition:all 0.2s; font-family:inherit;';
            btnPrev.onclick = function() {
                if (paginaActual > 1) { paginaActual--; renderizarGaleriaFB(); }
            };
            pagNav.appendChild(btnPrev);

            // Números de página
            for (var p = 1; p <= totalPaginas(); p++) {
                (function(num) {
                    var btnNum = document.createElement('button');
                    btnNum.textContent = num;
                    var esActivo = num === paginaActual;
                    btnNum.style.cssText = 'width:36px; height:36px; border-radius:50%; border:2px solid ' + (esActivo ? '#8c7565' : '#d4c5b8') + '; background:' + (esActivo ? '#8c7565' : '#fff') + '; color:' + (esActivo ? '#fff' : '#5c4d43') + '; font-size:0.88rem; font-weight:700; cursor:pointer; transition:all 0.2s; font-family:inherit;';
                    btnNum.onclick = function() {
                        paginaActual = num;
                        renderizarGaleriaFB();
                    };
                    pagNav.appendChild(btnNum);
                })(p);
            }

            // Botón siguiente
            var btnNext = document.createElement('button');
            btnNext.textContent = 'Siguiente ›';
            btnNext.disabled = paginaActual === totalPaginas();
            btnNext.style.cssText = 'padding:8px 18px; border-radius:999px; border:2px solid #d4c5b8; background:' + (paginaActual === totalPaginas() ? '#f0eae4' : '#fff') + '; color:' + (paginaActual === totalPaginas() ? '#bbb' : '#5c4d43') + '; font-size:0.88rem; font-weight:700; cursor:' + (paginaActual === totalPaginas() ? 'default' : 'pointer') + '; transition:all 0.2s; font-family:inherit;';
            btnNext.onclick = function() {
                if (paginaActual < totalPaginas()) { paginaActual++; renderizarGaleriaFB(); }
            };
            pagNav.appendChild(btnNext);
        }
    }

    // ── LIGHTBOX SIMPLE ──
    function abrirLightboxFB(src) {
        var lb = document.getElementById('lightboxFB');
        if (!lb) {
            lb = document.createElement('div');
            lb.id = 'lightboxFB';
            lb.style.cssText = 'display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.88); align-items:center; justify-content:center; padding:16px; box-sizing:border-box;';
            lb.innerHTML = '<img id="lightboxFBImg" src="" referrerpolicy="no-referrer" crossorigin="anonymous" style="max-width:100%; max-height:92vh; border-radius:10px; object-fit:contain; box-shadow:0 8px 40px rgba(0,0,0,0.6);"><button onclick="document.getElementById(\'lightboxFB\').style.display=\'none\'; document.body.style.overflow=\'\';" style="position:fixed; top:14px; right:14px; width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,0.18); color:white; border:none; font-size:22px; cursor:pointer; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);">✕</button>';
            lb.addEventListener('click', function(e) { if (e.target === lb) { lb.style.display = 'none'; document.body.style.overflow = ''; } });
            document.body.appendChild(lb);
        }
        document.getElementById('lightboxFBImg').src = src;
        lb.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    // Exponer función para agregar imágenes desde fuera si se necesita
    window.agregarImagenFB = function(url) {
        imagenesGaleriaFB.push(url);
        renderizarGaleriaFB();
    };
    window.establecerImagenesFB = function(arr) {
        imagenesGaleriaFB = arr;
        paginaActual = 1;
        renderizarGaleriaFB();
    };

    // Inicializar al cargar
    document.addEventListener('DOMContentLoaded', function() {
        renderizarGaleriaFB();
    });
    // Si el DOM ya cargó
    if (document.readyState !== 'loading') renderizarGaleriaFB();
})();



// ═══════════════════════════════════════════════════════════════════
//  SISTEMA DE ETIQUETAS PRINCIPALES + SUB-ETIQUETAS + CARRUSELES
// ═══════════════════════════════════════════════════════════════════

// Tipos → clase CSS y texto
var TIPO_INFO = {
    producto:     { cls: 'producto',   label: '📦 Producto' },
    productos:    { cls: 'producto',   label: '📦 Producto' },
    arreglo:      { cls: 'arreglo',    label: '🕯️ Arreglo' },
    arreglos:     { cls: 'arreglo',    label: '🕯️ Arreglo' },
    aditamento:   { cls: 'aditamento', label: '✨ Aditamento' },
    aditamentos:  { cls: 'aditamento', label: '✨ Aditamento' },
    decoracion:   { cls: 'decoracion', label: '🎀 Decoración' },
    decoraciones: { cls: 'decoracion', label: '🎀 Decoración' },
    etiqueta:        { cls: 'etiqueta',      label: '🏷️ Etiqueta' },
    etiquetas:       { cls: 'etiqueta',      label: '🏷️ Etiqueta' },
    'centro de mesa':{ cls: 'centro-mesa',   label: '🌸 Centro de Mesa' },
    'centro_de_mesa':{ cls: 'centro-mesa',   label: '🌸 Centro de Mesa' },
    centrodemesa:    { cls: 'centro-mesa',   label: '🌸 Centro de Mesa' },
    paquete:         { cls: 'paquete',       label: '🎁 Paquete' },
    paquetes:        { cls: 'paquete',       label: '🎁 Paquete' }
};

// ── Inyectar etiqueta principal (sobre el título) y sub-etiquetas (sobre evento) ──
// ── Toggle sub-etiquetas en el modal de producto ──────────────────────────────
function toggleSubetiquetasModal() {
    var zona = document.getElementById('modalTagsInline');
    var btn  = document.getElementById('mpBtnMostrarSubetiquetas');
    if (!zona || !btn) return;
    var abierto = zona.style.display !== 'none';
    zona.style.display = abierto ? 'none' : 'block';
    btn.textContent = abierto ? 'Ver sub-etiquetas ▾' : 'Ocultar sub-etiquetas ▴';
}

function inyectarEtiquetasModal(card) {
    // 1. ETIQUETAS PRINCIPALES — lee data-tipos (puede haber varias separadas por |)
    var zonaPrincipal = document.getElementById('mpEtiquetaPrincipalZona');
    if (zonaPrincipal) {
        zonaPrincipal.innerHTML = '';
        var rawTipos = (card.getAttribute('data-tipos') || card.getAttribute('data-tipo') || '');
        var tipos = rawTipos.toLowerCase()
            .replace(/^"+|"+$/g, '')
            .split('|')
            .map(function(s) { return s.trim().replace(/^"+|"+$/g, ''); })
            .filter(Boolean);

        var hayEtiqueta = false;
        tipos.forEach(function(tipo) {
            var info = TIPO_INFO[tipo];
            if (info) {
                var ePrincipal = document.createElement('span');
                ePrincipal.className = 'mp-etiqueta-principal ' + info.cls;
                ePrincipal.textContent = info.label;
                zonaPrincipal.appendChild(ePrincipal);
                hayEtiqueta = true;
            }
        });
        if (hayEtiqueta) {
            zonaPrincipal.style.display = 'flex';
            zonaPrincipal.style.flexWrap = 'wrap';
            zonaPrincipal.style.gap = '6px';
        } else {
            zonaPrincipal.style.display = 'none';
        }
    }

    // ── Badge número de fila en Google Sheets (esquina derecha, misma altura) ──
    var filaSheets = card.getAttribute('data-sheet-row') || '';
    var badge = document.getElementById('mpSheetRowBadge');
    if (badge) {
        if (filaSheets) {
            badge.textContent = '# ' + filaSheets;
            badge.title = 'Fila ' + filaSheets + ' en Google Sheets';
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    // 2. SUB-ETIQUETAS (Oferta / Más vendido) — se PREPENDEN al inicio de modalTagsInline
    var tagsInline = document.getElementById('modalTagsInline');
    if (!tagsInline) return;

    var ofertaActiva = card.getAttribute('data-oferta') === '1';
    var mvActivo     = card.getAttribute('data-mas-vendido') === '1';

    if (ofertaActiva || mvActivo) {
        var rowSub = document.createElement('div');
        rowSub.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; width:100%; margin-bottom:8px;';

        if (ofertaActiva) {
            var eOferta = document.createElement('span');
            eOferta.className = 'mp-sub-etiqueta oferta';
            eOferta.innerHTML = '🏷️ Oferta activa';
            eOferta.title = 'Ver info de la oferta';
            eOferta.onclick = (function(c){ return function(e){ e.stopPropagation(); abrirModalInfoEtiqueta(c, 'oferta'); }; })(card);
            rowSub.appendChild(eOferta);
        }
        if (mvActivo) {
            var eMV = document.createElement('span');
            eMV.className = 'mp-sub-etiqueta masvendido';
            eMV.innerHTML = '🏆 Más vendido';
            eMV.title = 'Ver imágenes de pedidos';
            eMV.onclick = (function(c){ return function(e){ e.stopPropagation(); abrirModalInfoEtiqueta(c, 'masvendido'); }; })(card);
            rowSub.appendChild(eMV);
        }

        // Insertar antes del primer hijo (encima de las etiquetas de evento)
        tagsInline.insertBefore(rowSub, tagsInline.firstChild);
    }
}

// ── Modal de info de etiqueta ─────────────────────────────────────
function abrirModalInfoEtiqueta(card, tipo) {
    var cuerpo = document.getElementById('modalEtiquetaCuerpo');
    var titulo = document.getElementById('modalEtiquetaTitulo');
    cuerpo.innerHTML = '';

    if (tipo === 'oferta') {
        titulo.textContent = '🏷️ Información de Oferta';
        var desc = card.getAttribute('data-oferta-desc') || '';
        var dur  = card.getAttribute('data-oferta-duracion') || '';
        var nombre = card.getAttribute('data-nombre') || 'Producto';

        var badgeEl = document.createElement('div');
        badgeEl.style.cssText = 'display:inline-block; background:#e8f5e9; color:#2e7d32; font-size:0.78rem; font-weight:700; padding:4px 12px; border-radius:20px; margin-bottom:8px;';
        badgeEl.textContent = '✅ Oferta activa';
        cuerpo.appendChild(badgeEl);

        var h3 = document.createElement('h3');
        h3.style.cssText = 'font-size:1.1rem; font-weight:800; color:#362a22; margin:0 0 6px;';
        h3.textContent = nombre;
        cuerpo.appendChild(h3);

        if (desc) {
            var descEl = document.createElement('p');
            descEl.style.cssText = 'font-size:0.9rem; color:#5c4d43; line-height:1.7; margin:0 0 10px; background:#fdf6f0; border-left:3px solid #8c7565; padding:10px 12px; border-radius:0 8px 8px 0;';
            descEl.textContent = desc;
            cuerpo.appendChild(descEl);
        }
        if (dur) {
            var durEl = document.createElement('div');
            durEl.style.cssText = 'display:flex; align-items:center; gap:8px; background:#f5f0eb; border-radius:8px; padding:10px 14px; font-size:0.88rem; color:#5c4d43; font-weight:600;';
            durEl.innerHTML = '🗓️ <span>Duración: <strong>' + dur + '</strong></span>';
            cuerpo.appendChild(durEl);
        }
        if (!desc && !dur) {
            var sinInfo = document.createElement('p');
            sinInfo.style.cssText = 'font-size:0.9rem; color:#999; text-align:center; padding:20px 0;';
            sinInfo.textContent = 'Este producto está en oferta especial. Contáctanos para más detalles.';
            cuerpo.appendChild(sinInfo);
        }

    } else if (tipo === 'masvendido') {
        titulo.textContent = '🏆 Pedidos Destacados';
        var nombre = card.getAttribute('data-nombre') || 'Producto';

        var h3 = document.createElement('h3');
        h3.style.cssText = 'font-size:1.1rem; font-weight:800; color:#362a22; margin:0 0 4px;';
        h3.textContent = nombre;
        cuerpo.appendChild(h3);

        var subtitulo = document.createElement('p');
        subtitulo.style.cssText = 'font-size:0.82rem; color:#8c7565; margin:0 0 12px;';
        subtitulo.textContent = '¡Mira qué hermosos lucen los pedidos de este producto!';
        cuerpo.appendChild(subtitulo);

        var imagenesRaw = card.getAttribute('data-mas-vendido-imagenes') || '[]';
        var imagenes = [];
        try { imagenes = JSON.parse(imagenesRaw); } catch(e) { imagenes = []; }

        if (imagenes.length > 0) {
            var galeria = document.createElement('div');
            galeria.className = 'modal-mv-galeria';
            imagenes.forEach(function(src) {
                var img = document.createElement('img');
                img.className = 'modal-mv-img';
                img.src = src;
                img.loading = 'lazy';
                img.onerror = function() { this.style.display = 'none'; };
                img.onclick = function() { abrirLightboxMV(src); };
                galeria.appendChild(img);
            });
            cuerpo.appendChild(galeria);
        } else {
            var sinImg = document.createElement('p');
            sinImg.style.cssText = 'font-size:0.9rem; color:#999; text-align:center; padding:20px 0;';
            sinImg.textContent = 'Las imágenes de pedidos de este producto estarán disponibles próximamente.';
            cuerpo.appendChild(sinImg);
        }
    }

    document.getElementById('modalInfoEtiqueta').classList.add('abierto');
    document.body.style.overflow = 'hidden';
}

function cerrarModalInfoEtiqueta() {
    document.getElementById('modalInfoEtiqueta').classList.remove('abierto');
    document.body.style.overflow = '';
}
document.getElementById('modalInfoEtiqueta').addEventListener('click', function(e) {
    if (e.target === this) cerrarModalInfoEtiqueta();
});

// Lightbox rápido para imágenes de más vendidos
function abrirLightboxMV(src) {
    var lb = document.getElementById('lightboxFB');
    if (!lb) {
        lb = document.createElement('div');
        lb.id = 'lightboxFB';
        lb.style.cssText = 'display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.88); align-items:center; justify-content:center; padding:16px; box-sizing:border-box;';
        lb.innerHTML = '<img id="lightboxFBImg" src="" style="max-width:100%; max-height:92vh; border-radius:10px; object-fit:contain; box-shadow:0 8px 40px rgba(0,0,0,0.6);"><button onclick="document.getElementById(\'lightboxFB\').style.display=\'none\'; document.body.style.overflow=\'\';" style="position:fixed; top:14px; right:14px; width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,0.18); color:white; border:none; font-size:22px; cursor:pointer; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(4px);">✕</button>';
        lb.addEventListener('click', function(e) { if (e.target === lb) { lb.style.display = 'none'; document.body.style.overflow = ''; } });
        document.body.appendChild(lb);
    }
    document.getElementById('lightboxFBImg').src = src;
    lb.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// ── Carruseles de Ofertas y Más Vendidos ─────────────────────────
function construirCarrusel(tipo) {
    // tipo: 'ofertas' | 'masvendidos'
    var dataAttr = tipo === 'ofertas' ? 'data-oferta' : 'data-mas-vendido';
    var trackId  = tipo + '-carousel-track';
    var vacioId  = tipo + '-vacio';
    var contadorId = tipo + '-contador';
    var btnPrevId  = tipo + '-btn-prev';
    var btnNextId  = tipo + '-btn-next';

    var track   = document.getElementById(trackId);
    var vacioel = document.getElementById(vacioId);
    var contadorEl = document.getElementById(contadorId);
    if (!track) return;

    // Recoger productos activos
    var cards = Array.from(document.querySelectorAll('.card-dinamica'))
        .filter(function(c) { return c.getAttribute(dataAttr) === '1'; });

    track.innerHTML = '';

    if (cards.length === 0) {
        track.style.display = 'none';
        if (vacioel) vacioel.style.display = 'block';
        if (contadorEl) contadorEl.textContent = '';
        document.getElementById(btnPrevId).style.display = 'none';
        document.getElementById(btnNextId).style.display = 'none';
        return;
    }

    track.style.display = 'flex';
    if (vacioel) vacioel.style.display = 'none';
    if (contadorEl) contadorEl.textContent = cards.length + (cards.length === 1 ? ' producto' : ' productos');

    // Mostrar flechas si hay más de 3
    var mostrarFlechas = cards.length > 3;
    var btnPrev = document.getElementById(btnPrevId);
    var btnNext = document.getElementById(btnNextId);
    if (btnPrev) { btnPrev.style.display = mostrarFlechas ? 'flex' : 'none'; }
    if (btnNext) { btnNext.style.display = mostrarFlechas ? 'flex' : 'none'; }

    cards.forEach(function(card) {
        var nombre = card.getAttribute('data-nombre') || '';
        var precio = card.getAttribute('data-precio') || '';
        var precioBazar = card.getAttribute('data-precio-bazar') || '';
        var imgEl = card.querySelector('.img-contenedor-dinamico img');
        var imgSrc = imgEl ? imgEl.getAttribute('src') : '';

        var precioMostrar = precioBazar || precio;
        var esOferta = tipo === 'ofertas';

        var cardEl = document.createElement('div');
        cardEl.className = 'carrusel-card';
        cardEl.innerHTML =
            '<img class="carrusel-card-img" src="' + imgSrc + '" alt="' + nombre + '" loading="lazy" onerror="this.style.background=\'#f5f0eb\'; this.style.height=\'120px\';">' +
            '<div class="carrusel-card-info">' +
                '<div class="carrusel-card-badge' + (esOferta ? '' : ' mv') + '">' + (esOferta ? '🏷️ Oferta' : '🏆 Top') + '</div>' +
                '<div class="carrusel-card-nombre" title="' + nombre + '">' + nombre + '</div>' +
                '<div class="carrusel-card-precio">' + (precioMostrar ? '$' + precioMostrar + ' MXN' : '') + '</div>' +
            '</div>';

        // Al hacer click abre el modal de producto
        cardEl.onclick = (function(c){ return function() { abrirModalProducto(c); }; })(card);
        track.appendChild(cardEl);
    });
}

// Navegar carrusel por scroll programático
function scrollCarrusel(tipo, direccion) {
    var track = document.getElementById(tipo + '-carousel-track');
    if (!track) return;
    var anchoCard = 174; // 160px + 14px gap
    track.scrollBy({ left: direccion * anchoCard * 3, behavior: 'smooth' });
}

// Actualizar flechas según posición de scroll
function actualizarFlechasCarrusel(tipo) {
    var track = document.getElementById(tipo + '-carousel-track');
    var btnPrev = document.getElementById(tipo + '-btn-prev');
    var btnNext = document.getElementById(tipo + '-btn-next');
    if (!track || !btnPrev || !btnNext) return;
    var cards = track.querySelectorAll('.carrusel-card').length;
    if (cards <= 3) return; // flechas ya ocultas
    // En los extremos del scroll, se puede seguir scrollando hacia el lado opuesto (comportamiento circular simulado via el mismo scroll nativo)
    // Simplemente siempre mostrar ambas flechas cuando hay >3
    btnPrev.style.display = 'flex';
    btnNext.style.display = 'flex';
}

// ── Patch abrirModalProducto — YA NO NECESARIO ──
// inyectarEtiquetasModal(card) ahora se llama directamente
// al final de abrirModalProducto con setTimeout(..., 0).

// ── Inicializar al cargar ─────────────────────────────────────────
// ── Carruseles se construyen DESPUÉS de que el catálogo cargue ──
document.addEventListener('catalogoCargado', function() {
    construirCarrusel('ofertas');
    construirCarrusel('masvendidos');
});

// Escuchar scroll en tracks (solo necesita DOM, no catálogo)
document.addEventListener('DOMContentLoaded', function() {
    ['ofertas', 'masvendidos'].forEach(function(tipo) {
        var track = document.getElementById(tipo + '-carousel-track');
        if (track) {
            track.addEventListener('scroll', function() { actualizarFlechasCarrusel(tipo); }, { passive: true });
        }
    });
});

// Exponer para poder refrescar desde fuera
window.refrescarCarruseles = function() {
    construirCarrusel('ofertas');
    construirCarrusel('masvendidos');
};



// ══════════════════════════════════════════════
// SISTEMA DE CARRITO KUKUMITA
// ══════════════════════════════════════════════
var carrito = (function() {
    try { var g = localStorage.getItem('kukumita-carrito'); return g ? JSON.parse(g) : []; }
    catch(e) { return []; }
})();
function _guardarCarrito() {
    try { localStorage.setItem('kukumita-carrito', JSON.stringify(carrito)); } catch(e) {}
}
var _mcCardActual = null;
var _mcCantidadActual = 1;
var _CARRITO_MAX_PRODUCTOS = 20;
var _CARRITO_MAX_PIEZAS = 99;

// ── ANTI-SPAM para cotización ──
var _cotizacionUltimoEnvio = 0;
var _cotizacionCooldown = 30000; // 30 segundos entre envíos

// ── Modal de Cantidad ──
function abrirModalCantidad(card) {
    _mcCardActual = card;
    _mcCantidadActual = 1;
    var nombre = card.getAttribute('data-nombre')
        || (card.querySelector('.nombre-vela, .card-nombre, h3, .producto-nombre') || {}).textContent
        || 'Producto';
    nombre = nombre.trim();
    var precioNum = card.getAttribute('data-precio') || '';
    var precioBazar = card.getAttribute('data-precio-bazar') || '';
    var imagenes = [];
    try { imagenes = JSON.parse(card.getAttribute('data-imagenes') || '[]'); } catch(e) {}
    var imgEl = card.querySelector('.img-contenedor-dinamico img, img');
    var imgSrc = imagenes[0] || (imgEl ? (imgEl.getAttribute('src') || imgEl.src) : '') || '';

    document.getElementById('mcNombreProducto').textContent = nombre;
    if (imgSrc) document.getElementById('mcImgProducto').src = imgSrc;
    document.getElementById('mcNumCantidad').textContent = '1';

    var precioMostrar = precioBazar || precioNum;
    if (precioMostrar) {
        document.getElementById('mcPrecioProducto').textContent = '$' + precioMostrar + ' MXN por pieza';
    } else {
        document.getElementById('mcPrecioProducto').textContent = '';
    }

    actualizarBotonesMC();
    document.getElementById('modalCantidad').classList.add('abierto');
    document.body.style.overflow = 'hidden';
    history.pushState({ kukumitaModal: 'cantidad' }, '');
    _modalActivo = 'cantidad';
}

function cerrarModalCantidad() {
    document.getElementById('modalCantidad').classList.remove('abierto');
    document.body.style.overflow = '';
    _modalActivo = null;
    _mcCardActual = null;
    if (history.state && history.state.kukumitaModal === 'cantidad') {
        history.replaceState(null, '');
    }
}

function cambiarCantidadMC(delta) {
    _mcCantidadActual = Math.max(1, Math.min(_CARRITO_MAX_PIEZAS, _mcCantidadActual + delta));
    document.getElementById('mcNumCantidad').textContent = _mcCantidadActual;
    actualizarBotonesMC();
}

function actualizarBotonesMC() {
    document.getElementById('mcBtnMenos').disabled = _mcCantidadActual <= 1;
    document.getElementById('mcBtnMas').disabled = _mcCantidadActual >= _CARRITO_MAX_PIEZAS;
}

function confirmarAgregarCarrito() {
    if (!_mcCardActual) return;
    var card = _mcCardActual;
    var nombre = card.getAttribute('data-nombre') || card.querySelector('h3')?.textContent || 'Producto';
    var precioNum = card.getAttribute('data-precio') || '';
    var precioBazar = card.getAttribute('data-precio-bazar') || '';
    var imagenes = [];
    try { imagenes = JSON.parse(card.getAttribute('data-imagenes') || '[]'); } catch(e) {}
    var imgSrc = imagenes[0] || (card.querySelector('.img-contenedor-dinamico img')?.getAttribute('src')) || '';
    var precioFinal = parseFloat(precioBazar || precioNum) || 0;

    // Verificar si ya está en el carrito
    var existente = carrito.find(function(i){ return i.nombre === nombre; });
    if (existente) {
        existente.cantidad = Math.min(_CARRITO_MAX_PIEZAS, existente.cantidad + _mcCantidadActual);
        mostrarToast('🛒 Cantidad actualizada en el carrito');
    } else {
        // Verificar límite de 20 productos diferentes
        if (carrito.length >= _CARRITO_MAX_PRODUCTOS) {
            mostrarToast('⚠️ Límite de 20 productos alcanzado');
            cerrarModalCantidad();
            return;
        }
        carrito.push({ nombre: nombre, precio: precioFinal, img: imgSrc, cantidad: _mcCantidadActual });
        mostrarToast('✅ ' + nombre + ' añadido al carrito');
    }

    actualizarBurbuja();
    _guardarCarrito();
    cerrarModalCantidad();
}

// ── Burbuja flotante ──
function actualizarBurbuja() {
    var total = carrito.length;
    var burbuja = document.getElementById('burbujaCarrito');
    var badge = document.getElementById('burbujaBadge');
    if (!burbuja || !badge) return;

    // Badge: muestra el número solo cuando hay productos
    if (total > 0) {
        badge.textContent = total;
        badge.style.display = 'flex';
        badge.style.animation = 'none';
        badge.offsetWidth; // reflow para reiniciar animación
        badge.style.animation = 'badge-pop 0.35s cubic-bezier(.34,1.56,.64,1) both';
    } else {
        badge.style.display = 'none';
    }
    // La burbuja SIEMPRE es visible (nunca se oculta aquí)
    burbuja.style.removeProperty('display');
    burbuja.classList.add('visible');
}

// ── Pantalla de carrito ──
function abrirPantallaCarrito() {
    // Cerrar drawer sin usar cerrarDrawer() para evitar conflicto de history.back()
    var drawer = document.getElementById('drawer');
    var overlay = document.getElementById('drawerOverlay');
    if (drawer && drawer.classList.contains('activo')) {
        drawer.classList.remove('activo');
        if (overlay) overlay.classList.remove('activo');
        // Limpiar el estado del drawer del historial para que no interfiera
        if (history.state && history.state.kukumitaModal === 'drawer') {
            history.replaceState(null, '');
        }
    }
    // Limpiar cualquier estado de modal anterior que pudiera haber quedado colgado
    _modalActivo = null;
    try { renderizarCarrito(); } catch(e) { console.error('[Kukumita] Error en renderizarCarrito:', e); }
    var pantalla = document.getElementById('pantallaCarrito');
    if (!pantalla) return;
    // Si ya estaba abierta no hacer doble pushState
    if (pantalla.classList.contains('activa')) return;
    pantalla.classList.add('activa');
    document.body.style.overflow = 'hidden';
    _modalActivo = 'carrito';
    // Ocultar burbuja mientras el carrito está abierto
    var burbuja = document.getElementById('burbujaCarrito');
    if (burbuja) burbuja.style.display = 'none';
    history.pushState({ kukumitaModal: 'carrito' }, '');
}

function cerrarPantallaCarrito() {
    var pantalla = document.getElementById('pantallaCarrito');
    if (!pantalla || !pantalla.classList.contains('activa')) return;
    pantalla.classList.remove('activa');
    document.body.style.overflow = '';
    _modalActivo = null;
    var burbuja = document.getElementById('burbujaCarrito');
    if (burbuja) { burbuja.style.removeProperty('display'); }
    actualizarBurbuja();
    if (history.state && history.state.kukumitaModal === 'carrito') {
        history.replaceState(null, '');
    }
}

// ── Calcula el total de descuento de los cupones aplicados sobre el carrito ──
function calcularDescuentoCupones(carritoItems) {
    var total = 0;
    _cuponesAplicados.forEach(function(c) {
        var precioBase = 0;
        if (c.productoIdx !== undefined && carritoItems[c.productoIdx]) {
            precioBase = carritoItems[c.productoIdx].precio || 0;
        } else if (carritoItems.length > 0) {
            precioBase = carritoItems[0].precio || 0;
        }
        if (c.tipo === 'porcentaje') {
            total += precioBase * (c.descuento / 100);
        } else {
            total += Math.min(c.descuento, precioBase);
        }
    });
    return total;
}

function renderizarCarrito() {
    var grid = document.getElementById('cartGrid');
    var vacio = document.getElementById('cartVacio');
    var totalZona = document.getElementById('cartTotalZona');
    var ctaZona = document.getElementById('cartCtaZona');
    var limiteMsg = document.getElementById('cartLimiteMsg');
    grid.innerHTML = '';

    if (carrito.length === 0) {
        vacio.style.display = 'block';
        totalZona.style.display = 'none';
        ctaZona.style.display = 'none';
        limiteMsg.classList.remove('visible');
        return;
    }

    vacio.style.display = 'none';
    totalZona.style.display = 'block';
    ctaZona.style.display = 'block';

    // Mostrar/ocultar mensaje de límite
    limiteMsg.classList.toggle('visible', carrito.length >= _CARRITO_MAX_PRODUCTOS);

    var total = 0;
    carrito.forEach(function(item, idx) {
        total += item.precio * item.cantidad;
        var div = document.createElement('div');
        div.className = 'cart-card';

        var imgHtml = item.img
            ? '<img class="cart-card-img" src="' + item.img + '" alt="' + item.nombre + '" onerror="this.style.background=\'#f0eae4\'; this.src=\'\';">'
            : '<div class="cart-card-img" style="background:#f0eae4; display:flex; align-items:center; justify-content:center; font-size:2rem;">🕯️</div>';

        var subtotal = item.precio ? '$' + (item.precio * item.cantidad).toFixed(0) + ' MXN' : '';

        div.innerHTML =
            '<button class="btn-quitar-cart" onclick="quitarDelCarrito(' + idx + ')">✕</button>' +
            imgHtml +
            '<div class="cart-card-info">' +
            '<div class="cart-card-nombre">' + item.nombre + '</div>' +
            (item.precio ? '<div class="cart-card-precio">$' + item.precio + ' MXN c/u</div>' : '') +
            // Controles de cantidad editables
            '<div style="display:flex; align-items:center; gap:6px; margin-top:6px;">' +
            '<button onclick="cambiarCantidadCarrito(' + idx + ',-1)" style="width:26px;height:26px;border-radius:50%;background:#8c7565;color:white;border:none;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0;" ' + (item.cantidad <= 1 ? 'disabled style="width:26px;height:26px;border-radius:50%;background:#d9cfc8;color:white;border:none;font-size:16px;cursor:default;display:flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0;"' : '') + '>−</button>' +
            '<span style="font-size:14px;font-weight:800;color:#362a22;min-width:22px;text-align:center;" id="cartQty_' + idx + '">' + item.cantidad + '</span>' +
            '<button onclick="cambiarCantidadCarrito(' + idx + ',1)" style="width:26px;height:26px;border-radius:50%;background:#8c7565;color:white;border:none;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0;" ' + (item.cantidad >= _CARRITO_MAX_PIEZAS ? 'disabled style="width:26px;height:26px;border-radius:50%;background:#d9cfc8;color:white;border:none;font-size:16px;cursor:default;display:flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0;"' : '') + '>+</button>' +
            '</div>' +
            (item.precio ? '<div style="font-size:0.8rem; color:#2e7d32; font-weight:700; margin-top:4px;" id="cartSub_' + idx + '">Subtotal: ' + subtotal + '</div>' : '') +
            '</div>';
        grid.appendChild(div);
    });

    // ── Cupones y total — delegado a _renderizarZonaCupones() ──
    _renderizarZonaCupones();

    // ── Poblar selector de producto para cupón ──
    var selectorZona = document.getElementById('cartCuponSelectorZona');
    var selectEl     = document.getElementById('cartCuponProductoSelect');
    if (selectorZona) selectorZona.style.display = (_cuponesAplicados.length > 0 && carrito.length > 0) ? 'block' : 'none';
    if (selectEl) {
        selectEl.innerHTML = '<option value="">— Elige un producto —</option>';
        carrito.forEach(function(item, idx) {
            var opt = document.createElement('option');
            opt.value = idx;
            var precioUnidad = item.precio ? '$' + item.precio + ' MXN' : 'Sin precio';
            opt.textContent = item.nombre + ' (' + item.cantidad + ' pza' + (item.cantidad !== 1 ? 's' : '') + ' · ' + precioUnidad + ' c/u)';
            selectEl.appendChild(opt);
        });
        var yaAsignado = _cuponesAplicados.find(function(c) { return c.productoIdx !== undefined; });
        if (yaAsignado) selectEl.value = yaAsignado.productoIdx;
        selectEl.onchange = function() { asignarCuponAProducto(parseInt(this.value)); };
    }

    // ── Total con descuento ──
    var descuentoTotal = calcularDescuentoCupones(carrito);
    var hayDescuento   = descuentoTotal > 0;
    var displayTotal   = Math.max(0, total - descuentoTotal);
    document.getElementById('cartTotalValor').textContent = displayTotal > 0 ? '$' + displayTotal.toFixed(0) + ' MXN' : 'Precio por cotizar';
    if (hayDescuento) document.getElementById('cartTotalValor').title = 'Precio original: $' + total.toFixed(0) + ' MXN';
}

function quitarDelCarrito(idx) {
    carrito.splice(idx, 1);
    _guardarCarrito();
    actualizarBurbuja();
    renderizarCarrito();
}

function cambiarCantidadCarrito(idx, delta) {
    if (!carrito[idx]) return;
    var nueva = Math.max(1, Math.min(_CARRITO_MAX_PIEZAS, carrito[idx].cantidad + delta));
    carrito[idx].cantidad = nueva;
    _guardarCarrito();
    renderizarCarrito();
}

// ── Botón pedir cotización con link compartible + anti-spam ──
function pedirCotizacionWA() {
    if (carrito.length === 0) { mostrarToast('Tu carrito está vacío'); return; }

    var ahora = Date.now();
    if (ahora - _cotizacionUltimoEnvio < _cotizacionCooldown) {
        var segsRestantes = Math.ceil((_cotizacionCooldown - (ahora - _cotizacionUltimoEnvio)) / 1000);
        mostrarToast('⏳ Espera ' + segsRestantes + ' segundos antes de volver a enviar');
        return;
    }
    _cotizacionUltimoEnvio = ahora;

    // Construir el link compartible con los productos del carrito
    var baseUrl = window.location.origin + window.location.pathname;
    var params = carrito.map(function(item) {
        return 'p=' + encodeURIComponent(item.nombre) + '&q=' + item.cantidad + '&pr=' + item.precio;
    }).join('&');
    var linkCarrito = baseUrl + '?' + params + '#carrito';

    // Calcular total
    var total = carrito.reduce(function(sum, i){ return sum + i.precio * i.cantidad; }, 0);

    // Construir mensaje
    var lineas = ['Hola, me gustaría pedir una cotización de los siguientes productos de Yesos Fer Kukúmita:\n'];
    carrito.forEach(function(item, i) {
        lineas.push((i+1) + '. *' + item.nombre + '*');
        lineas.push('   Cantidad: ' + item.cantidad + ' piezas');
        if (item.precio) lineas.push('   Precio unitario: $' + item.precio + ' MXN');
        if (item.precio) lineas.push('   Subtotal: $' + (item.precio * item.cantidad).toFixed(0) + ' MXN');
    });
    if (total > 0) lineas.push('\n*Total estimado: $' + total.toFixed(0) + ' MXN*');
    lineas.push('\n🔗 Ver mi selección: ' + linkCarrito);

    var mensaje = lineas.join('\n');
    var btn = document.getElementById('btnPedirCotizacion');
    btn.disabled = true;
    btn.textContent = '⏳ Enviando...';
    setTimeout(function() {
        window.open('https://wa.me/524431322032?text=' + encodeURIComponent(mensaje), '_blank');
        btn.disabled = false;
        btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg> Pedir Cotización por WhatsApp';
    }, 800);
}

// ══════════════════════════════════════════════════════════════════════
// SISTEMA DE CUPONES KUKUMITA v2
// - Cupones activos + cupones usados (historial)
// - Persistencia en Firestore por usuario Google
// - Modal de detalle al tocar un cupón
// - Visibles en el carrito aunque esté vacío
// ══════════════════════════════════════════════════════════════════════

var _cuponesAplicados = []; // [{codigo, descuento, descripcion, tipo, origen, fechaObtenido}]
var _cuponesUsados    = []; // [{codigo, descuento, descripcion, tipo, origen, fechaObtenido, fechaUsado}]

// Catálogo de cupones válidos (lado cliente)
var _catalogoCupones = {
    'ZONA15':        { descuento: 15, tipo: 'porcentaje', descripcion: '15% de descuento en 1 pieza', origen: 'Zona Interactiva — Biografía', icono: '🎉' },
    'BIENVENIDA10':  { descuento: 10, tipo: 'porcentaje', descripcion: '10% de descuento en 1 pieza', origen: 'Bienvenida',                   icono: '🎁' }
};

// ── Fingerprint ligero para anti-abuso en dispositivo ──
function _generarFingerprint() {
    var nav = window.navigator;
    var parts = [nav.language||'', nav.platform||'', window.screen.width+'x'+window.screen.height,
                 String(nav.hardwareConcurrency||0), Intl.DateTimeFormat().resolvedOptions().timeZone||''];
    var str = parts.join('|'), hash = 0;
    for (var i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return 'fp_' + Math.abs(hash).toString(36);
}
function _getStorageKey(codigo)    { return 'kuku_cupon_'  + codigo.toUpperCase() + '_' + _generarFingerprint(); }
function _getStorageKeyUsado(cod)  { return 'kuku_usado_'  + cod.toUpperCase()    + '_' + _generarFingerprint(); }

function _cuponYaUsado(codigo) {
    try { var raw = localStorage.getItem(_getStorageKey(codigo)); if (!raw) return false; var d = JSON.parse(raw); return !!(d.ts && d.fp); } catch(e) { return false; }
}
function _marcarCuponUsado(codigo) {
    try { localStorage.setItem(_getStorageKey(codigo), JSON.stringify({ codigo: codigo.toUpperCase(), fp: _generarFingerprint(), ts: Date.now(), ua: (navigator.userAgent||'').substring(0,80) })); } catch(e) {}
}
function _cuponEnCarritoActual(codigo) {
    return _cuponesAplicados.some(function(c) { return c.codigo === codigo.toUpperCase(); });
}

// ── Cargar historial de usados desde localStorage ──
function _cargarHistorialUsados() {
    try {
        var raw = localStorage.getItem('kuku_cupones_usados');
        if (raw) _cuponesUsados = JSON.parse(raw);
    } catch(e) {}
}
function _guardarHistorialUsados() {
    try { localStorage.setItem('kuku_cupones_usados', JSON.stringify(_cuponesUsados)); } catch(e) {}
}
function _moverCuponAUsados(codigo) {
    var idx = _cuponesAplicados.findIndex(function(c){ return c.codigo === codigo; });
    if (idx !== -1) {
        var c = _cuponesAplicados.splice(idx, 1)[0];
        c.fechaUsado = new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' });
        _cuponesUsados.unshift(c);
        _guardarHistorialUsados();
    }
}

// Inicializar historial al arrancar
_ready(function() { _cargarHistorialUsados(); });

// ── Modal de detalle de cupón ──
(function() {
    var _modal = null;
    function _crearModal() {
        if (_modal) return;
        _modal = document.createElement('div');
        _modal.id = 'modalDetalleCupon';
        _modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,0.55);backdrop-filter:blur(3px);align-items:center;justify-content:center;padding:20px;';
        _modal.innerHTML =
            '<div style="background:#fff;border-radius:20px;max-width:380px;width:100%;padding:28px 24px;box-shadow:0 16px 48px rgba(0,0,0,0.22);position:relative;animation:submenuFadeIn 0.2s ease;">' +
            '<button onclick="cerrarDetalleCupon()" style="position:absolute;top:14px;right:14px;background:#f5ede8;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;color:#8c7565;">✕</button>' +
            '<div id="detalleCuponContenido"></div>' +
            '</div>';
        _modal.addEventListener('click', function(e){ if(e.target===_modal) cerrarDetalleCupon(); });
        document.body.appendChild(_modal);
    }
    window.abrirDetalleCupon = function(codigo, esUsado) {
        _crearModal();
        var lista = esUsado ? _cuponesUsados : _cuponesAplicados;
        var c = lista.find(function(x){ return x.codigo === codigo; });
        if (!c) return;
        var def = _catalogoCupones[c.codigo] || {};
        var icono = def.icono || '🎟️';
        var colorFondo = esUsado ? '#f5f5f5' : 'linear-gradient(135deg,#fdf3e7,#fae8d0)';
        var colorBorde = esUsado ? '#ddd'    : '#e8c89a';
        var html =
            '<div style="text-align:center;margin-bottom:20px;">' +
            '<div style="font-size:3rem;margin-bottom:8px;">' + icono + '</div>' +
            '<h3 style="font-size:1.3rem;font-weight:900;color:#362a22;margin:0 0 4px;letter-spacing:1px;">' + c.codigo + '</h3>' +
            '<span style="font-size:0.78rem;font-weight:700;color:' + (esUsado?'#999':'#8c7565') + ';text-transform:uppercase;letter-spacing:0.8px;">' +
            (esUsado ? '✅ Cupón utilizado' : '✨ Cupón activo') + '</span>' +
            '</div>' +
            '<div style="background:' + colorFondo + ';border:2px solid ' + colorBorde + ';border-radius:14px;padding:16px 18px;margin-bottom:16px;">' +
            '<p style="font-size:1.1rem;font-weight:900;color:#362a22;margin:0 0 6px;text-align:center;">' +
            c.descuento + (c.tipo==='porcentaje'?'% de descuento':' MXN de descuento') + ' en 1 pieza' +
            '</p>' +
            '<p style="font-size:0.82rem;color:#8c7565;margin:0;text-align:center;">' + (c.descripcion||'') + '</p>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:8px;">' +
            '<div style="display:flex;gap:10px;align-items:flex-start;">' +
            '<span style="font-size:1rem;flex-shrink:0;">📍</span>' +
            '<div><p style="font-size:0.78rem;font-weight:700;color:#aaa;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.6px;">Dónde lo obtuviste</p>' +
            '<p style="font-size:0.88rem;color:#5c4d43;margin:0;font-weight:600;">' + (c.origen || def.origen || 'Desconocido') + '</p></div>' +
            '</div>' +
            (c.fechaObtenido ? '<div style="display:flex;gap:10px;align-items:flex-start;"><span style="font-size:1rem;flex-shrink:0;">📅</span><div><p style="font-size:0.78rem;font-weight:700;color:#aaa;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.6px;">Fecha obtenido</p><p style="font-size:0.88rem;color:#5c4d43;margin:0;font-weight:600;">' + c.fechaObtenido + '</p></div></div>' : '') +
            (esUsado && c.fechaUsado ? '<div style="display:flex;gap:10px;align-items:flex-start;"><span style="font-size:1rem;flex-shrink:0;">🗓️</span><div><p style="font-size:0.78rem;font-weight:700;color:#aaa;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.6px;">Fecha utilizado</p><p style="font-size:0.88rem;color:#5c4d43;margin:0;font-weight:600;">' + c.fechaUsado + '</p></div></div>' : '') +
            '</div>';
        if (!esUsado) {
            html += '<button onclick="cerrarDetalleCupon()" style="width:100%;margin-top:20px;background:linear-gradient(135deg,#8c7565,#5c4d43);color:white;border:none;border-radius:999px;padding:13px;font-size:0.95rem;font-weight:800;cursor:pointer;font-family:inherit;">Entendido ✓</button>';
        } else {
            html += '<div style="margin-top:18px;text-align:center;padding:10px 14px;background:#f9f5f2;border-radius:10px;"><p style="font-size:0.8rem;color:#9a8878;margin:0;font-style:italic;">Este cupón ya fue utilizado, pero lo guardamos como recuerdo 🕯️</p></div>' +
                    '<button onclick="cerrarDetalleCupon()" style="width:100%;margin-top:14px;background:#e8ddd5;color:#5c4d43;border:none;border-radius:999px;padding:13px;font-size:0.95rem;font-weight:800;cursor:pointer;font-family:inherit;">Cerrar</button>';
        }
        document.getElementById('detalleCuponContenido').innerHTML = html;
        _modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    };
    window.cerrarDetalleCupon = function() {
        if (_modal) _modal.style.display = 'none';
        document.body.style.overflow = '';
    };
})();

// ── Reclamar cupón de la Zona Interactiva ──
function reclamarCuponZonaInteractiva() {
    var codigo = 'ZONA15';
    var btnEl  = document.getElementById('btnReclamarCupon15');

    if (_cuponEnCarritoActual(codigo)) { mostrarToast('🎟️ El cupón ZONA15 ya está en tu carrito'); return; }
    if (_cuponYaUsado(codigo)) { _bloquearBtnCupon15(); mostrarToast('⚠️ Este cupón ya fue reclamado anteriormente'); return; }

    var cupDef = _catalogoCupones[codigo];
    var fechaHoy = new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' });
    _cuponesAplicados.push({
        codigo:        codigo,
        descuento:     cupDef.descuento,
        descripcion:   cupDef.descripcion,
        tipo:          cupDef.tipo,
        origen:        cupDef.origen,
        fechaObtenido: fechaHoy
    });
    _marcarCuponUsado(codigo);

    // Guardar en Firestore si hay sesión
    _guardarCuponFirestore(codigo, cupDef, fechaHoy);

    if (btnEl) {
        btnEl.disabled = true;
        btnEl.style.background = 'linear-gradient(135deg,#4caf50,#2e7d32)';
        btnEl.style.boxShadow   = '0 4px 16px rgba(46,125,50,0.4)';
        btnEl.innerHTML = '✅ Cupón guardado en tu carrito';
    }
    mostrarToast('🎉 ¡Cupón del 15% añadido! Ábrelo en el carrito.');
    renderizarCarrito();
}

function _bloquearBtnCupon15() {
    var btnEl    = document.getElementById('btnReclamarCupon15');
    var estadoEl = document.getElementById('zonaCupon15Estado');
    if (btnEl) {
        btnEl.disabled = true;
        btnEl.style.background = 'linear-gradient(135deg,#bbb,#999)';
        btnEl.style.boxShadow  = 'none';
        btnEl.style.cursor     = 'default';
        btnEl.innerHTML        = '⛔ Ya has utilizado este cupón';
    }
    if (estadoEl && !estadoEl.querySelector('.msg-cupon-usado')) {
        var msg = document.createElement('p');
        msg.className = 'msg-cupon-usado';
        msg.style.cssText = 'font-size:0.78rem;color:#9a8878;margin-top:10px;font-style:italic;';
        msg.textContent   = 'Este cupón ya fue reclamado desde este dispositivo.';
        estadoEl.appendChild(msg);
    }
}

// Al cargar la página, revisar si el cupón ya fue usado y bloquear botón
_ready(function() {
    if (_cuponYaUsado('ZONA15')) {
        setTimeout(_bloquearBtnCupon15, 400);
    }
});

// ── Aplicar cupón manual (por código) ──
function aplicarCuponManual() {
    var inputEl = document.getElementById('inputCuponManual');
    if (!inputEl) return;
    var codigo  = (inputEl.value || '').trim().toUpperCase();
    if (!codigo) { mostrarToast('Escribe un código de cupón'); return; }

    var def = _catalogoCupones[codigo];
    if (!def) { mostrarToast('❌ Código no válido o no reconocido'); return; }
    if (_cuponEnCarritoActual(codigo)) { mostrarToast('🎟️ Ese cupón ya está aplicado'); return; }
    if (_cuponYaUsado(codigo)) { mostrarToast('⚠️ Este cupón ya fue usado anteriormente'); return; }

    var fechaHoy = new Date().toLocaleDateString('es-MX', { year:'numeric', month:'long', day:'numeric' });
    _cuponesAplicados.push({
        codigo:        codigo,
        descuento:     def.descuento,
        descripcion:   def.descripcion,
        tipo:          def.tipo,
        origen:        def.origen || 'Código manual',
        fechaObtenido: fechaHoy
    });
    _marcarCuponUsado(codigo);
    _guardarCuponFirestore(codigo, def, fechaHoy);
    inputEl.value = '';
    mostrarToast('✅ Cupón ' + codigo + ' aplicado');
    renderizarCarrito();
}

function quitarCupon(codigo) {
    _cuponesAplicados = _cuponesAplicados.filter(function(c) { return c.codigo !== codigo; });
    renderizarCarrito();
}

// ── Renderizar cupones en el carrito (activos + historial usados) ──
// Este bloque reemplaza la lógica de renderizarCarrito relacionada con cupones.
// Se llama desde renderizarCarrito() al final del bloque de cupones.
function _renderizarZonaCupones() {
    var cuponesZona  = document.getElementById('cartCuponesZona');
    var cuponesLista = document.getElementById('cartCuponesLista');
    var cuponDesc    = document.getElementById('cartCuponDesc');
    if (!cuponesZona || !cuponesLista) return;

    // Mostrar la zona si hay cupones activos O si hay historial de usados
    var hayAlgo = _cuponesAplicados.length > 0 || _cuponesUsados.length > 0;
    cuponesZona.style.display = hayAlgo ? 'block' : 'none';

    cuponesLista.innerHTML = '';

    // ── Cupones activos ──
    if (_cuponesAplicados.length === 0) {
        var p = document.createElement('p');
        p.style.cssText = 'font-size:0.8rem;color:#b09080;margin:0 0 8px;';
        p.textContent   = 'No tienes cupones activos.';
        cuponesLista.appendChild(p);
    } else {
        _cuponesAplicados.forEach(function(c) {
            var productoInfo = c.productoIdx !== undefined && carrito[c.productoIdx]
                ? ('→ aplica a 1 pieza de "' + carrito[c.productoIdx].nombre + '"')
                : (c.productoIdx === undefined ? '→ selecciona un producto abajo' : '→ producto eliminado');
            var el = document.createElement('div');
            el.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;background:#fff;border:1.5px solid #e8c89a;border-radius:10px;padding:8px 12px;gap:8px;cursor:pointer;transition:border-color 0.2s;';
            el.onmouseover = function(){ this.style.borderColor='#c9a98a'; };
            el.onmouseout  = function(){ this.style.borderColor='#e8c89a'; };
            el.innerHTML =
                '<div style="flex:1;min-width:0;" onclick="abrirDetalleCupon(\'' + c.codigo + '\',false)">' +
                '<span style="font-size:0.85rem;font-weight:800;color:#362a22;">🎟️ ' + c.codigo + '</span>' +
                '<span style="font-size:0.75rem;color:#8c7565;display:block;margin-top:1px;">' + c.descripcion + ' — ' + c.descuento + (c.tipo==='porcentaje'?'%':' MXN') + '</span>' +
                '<span style="font-size:0.72rem;color:#a07850;display:block;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + productoInfo + '</span>' +
                '<span style="font-size:0.68rem;color:#c9a98a;display:block;margin-top:2px;">Toca para ver detalles →</span>' +
                '</div>' +
                '<button onclick="event.stopPropagation();quitarCupon(\'' + c.codigo + '\')" style="background:#f5e8e0;border:none;border-radius:50%;width:26px;height:26px;min-width:26px;font-size:12px;cursor:pointer;color:#8c7565;display:flex;align-items:center;justify-content:center;margin-top:2px;flex-shrink:0;">✕</button>';
            cuponesLista.appendChild(el);
        });
    }

    // ── Historial de cupones usados ──
    if (_cuponesUsados.length > 0) {
        var sep = document.createElement('div');
        sep.style.cssText = 'margin:12px 0 8px;display:flex;align-items:center;gap:8px;';
        sep.innerHTML = '<div style="flex:1;height:1px;background:#e8ddd5;"></div>' +
            '<span style="font-size:0.72rem;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.7px;white-space:nowrap;">Cupones utilizados</span>' +
            '<div style="flex:1;height:1px;background:#e8ddd5;"></div>';
        cuponesLista.appendChild(sep);

        _cuponesUsados.forEach(function(c) {
            var el = document.createElement('div');
            el.style.cssText = 'display:flex;align-items:center;justify-content:space-between;background:#fafafa;border:1.5px solid #eee;border-radius:10px;padding:8px 12px;gap:8px;cursor:pointer;opacity:0.72;transition:opacity 0.2s;';
            el.onmouseover = function(){ this.style.opacity='1'; };
            el.onmouseout  = function(){ this.style.opacity='0.72'; };
            el.onclick = function(){ abrirDetalleCupon(c.codigo, true); };
            el.innerHTML =
                '<div style="flex:1;min-width:0;">' +
                '<span style="font-size:0.83rem;font-weight:800;color:#999;">✅ ' + c.codigo + '</span>' +
                '<span style="font-size:0.72rem;color:#bbb;display:block;margin-top:1px;">' + c.descripcion + '</span>' +
                '<span style="font-size:0.68rem;color:#c9a98a;display:block;margin-top:2px;">Toca para ver detalles →</span>' +
                '</div>';
            cuponesLista.appendChild(el);
        });
    }

    // Descuento total
    var descuentoTotal = calcularDescuentoCupones(carrito);
    if (cuponDesc) cuponDesc.textContent = descuentoTotal > 0 ? ('Ahorro: $' + descuentoTotal.toFixed(0) + ' MXN') : '';
}

function asignarCuponAProducto(idx) {
    if (isNaN(idx) || idx < 0 || idx >= carrito.length) return;
    // Asignar a todos los cupones sin producto (o reasignar todos si ya tienen)
    _cuponesAplicados.forEach(function(c) {
        c.productoIdx = idx;
    });
    var preview = document.getElementById('cartCuponSelectorPreview');
    if (preview && carrito[idx]) {
        var item = carrito[idx];
        var precioBase = item.precio || 0;
        var cupon = _cuponesAplicados[0];
        var ahorro = cupon
            ? (cupon.tipo === 'porcentaje'
                ? (precioBase * cupon.descuento / 100).toFixed(0)
                : Math.min(cupon.descuento, precioBase).toFixed(0))
            : 0;
        preview.style.display = 'block';
        preview.textContent = '✅ Descuento de $' + ahorro + ' MXN aplicado a 1 pieza de "' + item.nombre + '"';
    }
    renderizarCarrito();
}

// ══════════════════════════════════════════════════════════════════════
// SUBMENÚS DE IMAGEN Y TÍTULO
// ══════════════════════════════════════════════════════════════════════

// Animación CSS para submenús
(function() {
    var style = document.createElement('style');
    style.textContent = '@keyframes submenuFadeIn { from { opacity:0; transform:translateX(-50%) translateY(-8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }';
    document.head.appendChild(style);
})();

function toggleSubmenuPerfil(tipo) {
    var ids = { imagen: 'submenuImagen', titulo: 'submenuTitulo' };
    var otroIds = { imagen: 'submenuTitulo', titulo: 'submenuImagen' };
    var el = document.getElementById(ids[tipo]);
    var otro = document.getElementById(otroIds[tipo]);
    if (!el) return;
    // Cerrar el otro
    if (otro) otro.style.display = 'none';
    el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
}

function cerrarSubmenus() {
    ['submenuImagen', 'submenuTitulo'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

// Cerrar submenús al hacer clic fuera
document.addEventListener('click', function(e) {
    if (!e.target.closest('#imgPerfilBtn') &&
        !e.target.closest('#submenuImagen') &&
        !e.target.closest('#tituloVelasKukumita') &&
        !e.target.closest('#submenuTitulo')) {
        cerrarSubmenus();
    }
});

function irAZonaInteractiva() {
    // Activa el panel de Biografía y lleva a su inicio (el cupón se descubre explorando)
    if (typeof activarPill === 'function') activarPill('biografia');
    setTimeout(function() {
        var panel = document.getElementById('panelPillBiografia');
        if (panel) {
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, 120);
}

// Cerrar modal de cantidad al hacer clic en el fondo
_ready(function() {
    var _mc = document.getElementById('modalCantidad');
    if (_mc) _mc.addEventListener('click', function(e) { if (e.target === this) cerrarModalCantidad(); });
    actualizarBurbuja();
});

// ══════════════════════════════════════════════════════
// LÓGICA DEL SUBMENU DE COMPARTIR
// ══════════════════════════════════════════════════════
var _scUrlActual = '';
var _scNombreActual = '';

function abrirSubmenuCompartir(url, nombre) {
    _scUrlActual = url;
    _scNombreActual = nombre || 'Producto';
    var linkEl = document.getElementById('scLinkTexto');
    if (linkEl) linkEl.textContent = url;
    document.getElementById('submenuCompartir').classList.add('abierto');
    document.body.style.overflow = 'hidden';
}

function cerrarSubmenuCompartir() {
    document.getElementById('submenuCompartir').classList.remove('abierto');
    document.body.style.overflow = '';
}

function copiarLinkProducto() {
    // Usar la URL del Worker (si está configurado) para que al pegar en Facebook
    // se muestre la imagen del producto en lugar de la imagen genérica del sitio.
    var urlACopiar = (typeof _urlOG === 'function') ? _urlOG(_scUrlActual) : _scUrlActual;
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(urlACopiar).then(function() {
            mostrarToast('✅ ¡Link copiado al portapapeles!');
        }).catch(function() {
            _copiarFallback(urlACopiar);
        });
    } else {
        _copiarFallback(urlACopiar);
    }
}

function _copiarFallback(texto) {
    var ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); mostrarToast('✅ ¡Link copiado!'); } catch(e) {}
    document.body.removeChild(ta);
}

// ── Helper: devuelve la URL del Cloudflare Worker si está configurado,
//    o la URL normal de la página en caso contrario.
//    El worker sirve las meta tags OG correctas para que Facebook
//    muestre la imagen del producto al pegar el link.
function _urlOG(urlPaginaReal) {
    if (!OG_WORKER_URL || !OG_WORKER_URL.trim()) return urlPaginaReal;
    try {
        var params = new URL(urlPaginaReal).searchParams;
        var producto = params.get('producto');
        if (!producto) return urlPaginaReal;
        return OG_WORKER_URL.replace(/\/$/, '') + '/?producto=' + encodeURIComponent(producto);
    } catch(e) {
        return urlPaginaReal;
    }
}

function compartirEnWhatsApp() {
    // Usamos la URL del Worker (si está configurado) para que WhatsApp
    // lea las meta tags OG y muestre la imagen del producto, igual que en Facebook.
    var urlParaWhatsApp = _urlOG(_scUrlActual);
    var texto = encodeURIComponent('🕯️ Mira este producto de Yesos Fer Kukúmita: ' + _scNombreActual + '\n' + urlParaWhatsApp);
    window.open('https://wa.me/?text=' + texto, '_blank');
}

function compartirEnFacebook() {
    // Usamos la URL del worker (si está configurado) para que Facebook
    // lea las meta tags OG y muestre la imagen del producto.
    var urlParaFB = encodeURIComponent(_urlOG(_scUrlActual));
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + urlParaFB, '_blank', 'width=600,height=400');
}

function compartirEnInstagram() {
    // Instagram no tiene share URL directa, copiamos el link
    copiarLinkProducto();
    mostrarToast('📸 Link copiado — pégalo en tu historia de Instagram');
}

// Cerrar al hacer clic en el fondo
_ready(function() {
    var _sc = document.getElementById('submenuCompartir');
    if (_sc) _sc.addEventListener('click', function(e) { if (e.target === this) cerrarSubmenuCompartir(); });
});

// ══════════════════════════════════════════════════════════════════════
// FIRESTORE — cupones y favoritos vinculados al usuario Google
// Reglas necesarias en Firebase Console (Firestore Rules):
//
//   rules_version = '2';
//   service cloud.firestore {
//     match /databases/{database}/documents {
//       match /productos/{document} {
//         allow read: if true;
//         allow write: if false;
//       }
//       // Cada usuario solo lee y escribe su propio perfil
//       match /usuarios/{userId}/{document=**} {
//         allow read, write: if request.auth != null && request.auth.uid == userId;
//       }
//     }
//   }
//
// ══════════════════════════════════════════════════════════════════════

var _db = null;

_ready(function() {
    try {
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            _db = firebase.firestore();
        }
    } catch(e) { console.warn('Firestore no disponible:', e); }
});

function _guardarCuponFirestore(codigo, cupDef, fechaObtenido) {
    if (!_db) return;
    try {
        var user = (typeof auth !== 'undefined') ? auth.currentUser : null;
        if (!user) return;
        _db.collection('usuarios').doc(user.uid)
           .collection('cupones').doc(codigo.toUpperCase())
           .set({
               codigo:        codigo.toUpperCase(),
               descuento:     cupDef.descuento,
               tipo:          cupDef.tipo,
               descripcion:   cupDef.descripcion,
               origen:        cupDef.origen || 'desconocido',
               fechaObtenido: fechaObtenido || new Date().toISOString(),
               usado:         false
           }, { merge: true });
    } catch(e) { console.warn('Error guardando cupón:', e); }
}

function _cargarCuponesFirestore(uid) {
    if (!_db || !uid) return;
    _db.collection('usuarios').doc(uid).collection('cupones').get()
       .then(function(snap) {
           snap.forEach(function(doc) {
               var d = doc.data();
               if (d.usado) {
                   // Agregar al historial de usados si no está ya
                   var yaEsta = _cuponesUsados.some(function(c){ return c.codigo === d.codigo; });
                   if (!yaEsta) {
                       _cuponesUsados.push({
                           codigo:        d.codigo,
                           descuento:     d.descuento,
                           tipo:          d.tipo,
                           descripcion:   d.descripcion,
                           origen:        d.origen,
                           fechaObtenido: d.fechaObtenido,
                           fechaUsado:    d.usadoEn || ''
                       });
                       _guardarHistorialUsados();
                   }
               } else {
                   // Agregar a activos si no está ya
                   var yaEstaA = _cuponesAplicados.some(function(c){ return c.codigo === d.codigo; });
                   if (!yaEstaA) {
                       _cuponesAplicados.push({
                           codigo:        d.codigo,
                           descuento:     d.descuento,
                           tipo:          d.tipo,
                           descripcion:   d.descripcion,
                           origen:        d.origen,
                           fechaObtenido: d.fechaObtenido
                       });
                   }
               }
           });
           renderizarCarrito();
       })
       .catch(function(e){ console.warn('Error cargando cupones Firestore:', e); });
}

function _cargarFavoritosFirestore(uid) {
    if (!_db || !uid) return;
    _db.collection('usuarios').doc(uid).get().then(function(doc) {
        if (doc.exists) {
            var d = doc.data();
            if (d.favoritos && Array.isArray(d.favoritos)) {
                var localFavs = [];
                try { localFavs = JSON.parse(localStorage.getItem('velas-favoritos') || '[]'); } catch(e) {}
                var merged = Array.from(new Set(localFavs.concat(d.favoritos)));
                localStorage.setItem('velas-favoritos', JSON.stringify(merged));
                if (typeof syncBotonesLike === 'function') syncBotonesLike();
            }
        }
    }).catch(function(){});
}

// Hook al onAuthStateChanged existente: cargar datos cuando el usuario inicia sesión
(function() {
    _ready(function() {
        var _intentos = 0;
        var _esperar = setInterval(function() {
            _intentos++;
            if (typeof auth !== 'undefined' && auth.onAuthStateChanged) {
                clearInterval(_esperar);
                auth.onAuthStateChanged(function(user) {
                    if (user) {
                        setTimeout(function() {
                            _cargarCuponesFirestore(user.uid);
                            _cargarFavoritosFirestore(user.uid);
                        }, 600);
                    }
                });
            }
            if (_intentos > 40) clearInterval(_esperar);
        }, 250);
    });
})();


// ══════════════════════════════════════════════════════════════════════
// WHATSAPP CARRITO — incluir cupones en el mensaje
// ══════════════════════════════════════════════════════════════════════
(function() {
    var _origWA = window.pedirCotizacionWA;
    window.pedirCotizacionWA = function() {
        if (carrito.length === 0) { mostrarToast('Tu carrito está vacío'); return; }

        var ahora = Date.now();
        if (typeof _cotizacionUltimoEnvio !== 'undefined' && typeof _cotizacionCooldown !== 'undefined') {
            if (ahora - _cotizacionUltimoEnvio < _cotizacionCooldown) {
                var segs = Math.ceil((_cotizacionCooldown - (ahora - _cotizacionUltimoEnvio)) / 1000);
                mostrarToast('⏳ Espera ' + segs + ' segundos antes de volver a enviar');
                return;
            }
            _cotizacionUltimoEnvio = ahora;
        }

        var baseUrl     = window.location.origin + window.location.pathname;
        var params      = carrito.map(function(i){ return 'p='+encodeURIComponent(i.nombre)+'&q='+i.cantidad+'&pr='+i.precio; }).join('&');
        var linkCarrito = baseUrl + '?' + params + '#carrito';
        var total       = carrito.reduce(function(s,i){ return s+(i.precio||0)*i.cantidad; }, 0);
        var descuento   = (typeof calcularDescuentoCupones==='function') ? calcularDescuentoCupones(carrito) : 0;

        var lineas = ['Hola, me gustaría pedir una cotización de los siguientes productos de Yesos Fer Kukúmita:\n'];
        carrito.forEach(function(item, i) {
            lineas.push((i+1)+'. *'+item.nombre+'*');
            lineas.push('   Cantidad: '+item.cantidad+' piezas');
            if (item.precio) lineas.push('   Precio unitario: $'+item.precio+' MXN');
            if (item.precio) lineas.push('   Subtotal: $'+(item.precio*item.cantidad).toFixed(0)+' MXN');
        });
        if (total > 0) lineas.push('\n*Total estimado: $'+total.toFixed(0)+' MXN*');

        if (_cuponesAplicados && _cuponesAplicados.length > 0) {
            lineas.push('\n🎟️ *Cupones aplicados:*');
            _cuponesAplicados.forEach(function(c) {
                var prod = (c.productoIdx!==undefined && carrito[c.productoIdx]) ? ' (en "'+carrito[c.productoIdx].nombre+'")' : '';
                lineas.push('   • '+c.codigo+' — '+c.descuento+(c.tipo==='porcentaje'?'%':' MXN')+prod);
            });
            if (descuento > 0) lineas.push('   _Ahorro: $'+descuento.toFixed(0)+' MXN_');
            var conDesc = Math.max(0, total - descuento);
            if (conDesc > 0) lineas.push('*Total con descuento: $'+conDesc.toFixed(0)+' MXN*');
        }
        lineas.push('\n🔗 Ver mi selección: '+linkCarrito);

        var mensaje = lineas.join('\n');
        var btn = document.getElementById('btnPedirCotizacion');
        if (btn) { btn.disabled=true; btn.textContent='⏳ Enviando...'; }
        setTimeout(function() {
            window.open('https://wa.me/524431322032?text='+encodeURIComponent(mensaje), '_blank');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg> Pedir Cotización por WhatsApp';
            }
        }, 800);
    };
})();

// ══════════════════════════════════════════════════════════════════
// FILTRO RÁPIDO POR EVENTO (carrusel "Busca por Evento")
// ══════════════════════════════════════════════════════════════════
(function() {
    // Normaliza slugs: quita acentos, espacios→guion, todo minúsculas
    function _normSlug(s) {
        return (s || '').toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }

    window.filtrarPorEventoCarrusel = function(btnPulsado, evento) {
        // Marcar botón activo
        document.querySelectorAll('.btn-evento-carrusel').forEach(function(b) {
            b.classList.remove('activo-evento');
        });
        btnPulsado.classList.add('activo-evento');

        // Activar modo "Mostrar Todo" para que todas las cards sean candidatas
        if (typeof window.cambiarModoVelas === 'function') {
            window.cambiarModoVelas('mostrar_todo');
        }

        if (evento === 'todos') {
            // Sin filtro de evento adicional — el modo mostrar_todo ya muestra todo
            return;
        }

        // Pequeño retardo para que cambiarModoVelas termine de mostrar las cards
        setTimeout(function() {
            var slugFiltro = _normSlug(evento);
            var cards = document.querySelectorAll('#gridProductos .card-dinamica');
            var hay = false;
            cards.forEach(function(card) {
                var dataEvento = (card.getAttribute('data-evento') || '').toLowerCase();
                // data-evento puede ser multi-valor separado por espacios
                var slugs = dataEvento.split(/\s+/).map(_normSlug).filter(Boolean);
                var coincide = slugs.includes(slugFiltro);
                card.classList.toggle('oculto', !coincide);
                card.classList.remove('paginacion-oculto');
                if (coincide) hay = true;
            });

            // Actualizar paginación
            if (typeof window.actualizarPaginacion === 'function') {
                window.actualizarPaginacion();
            }
        }, 60);
    };

    // Ocultar/mostrar gradientes y botones según posición del scroll
    window.actualizarGradienteEvento = function(el) {
        var gradR = document.getElementById('eventoScrollGradient');
        var gradL = document.getElementById('eventoScrollGradientL');
        var btnPrev = document.getElementById('btnEventoPrev');
        var btnNext = document.getElementById('btnEventoNext');
        var maxScroll = el.scrollWidth - el.clientWidth;
        var atEnd   = el.scrollLeft >= maxScroll - 8;
        var atStart = el.scrollLeft <= 8;
        if (gradR) gradR.style.opacity  = atEnd   ? '0' : '1';
        if (gradL) gradL.style.opacity  = atStart ? '0' : '1';
        if (btnPrev) btnPrev.style.opacity = atStart ? '0.35' : '1';
        if (btnNext) btnNext.style.opacity = atEnd   ? '0.35' : '1';
    };

    window.scrollEventos = function(dir) {
        var el = document.getElementById('eventoCarrusel');
        if (!el) return;
        el.scrollBy({ left: dir * 220, behavior: 'smooth' });
    };

    // Limpiar filtro de evento cuando el usuario cambia de tab manualmente
    _ready(function() {
        document.querySelectorAll('.btn-modo-velas').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.btn-evento-carrusel').forEach(function(b) {
                    b.classList.remove('activo-evento');
                });
            });
        });
    });
})();

// ══════════════════════════════════════════════════════════════════
(function() {
    var _modoGuardado = null;
    var _precioExactoGuardado = null;
    var _precioArreglosGuardado = null;

    window.busquedaGlobal = function(valor) {
        var query = (valor || '').trim().toLowerCase();
        var btnLimpiar  = document.getElementById('btnLimpiarGlobal');
        var infoEl      = document.getElementById('resultadosGlobalInfo');
        if (btnLimpiar) btnLimpiar.style.display = query ? 'block' : 'none';

        if (!query) {
            limpiarBusquedaGlobal();
            return;
        }

        // Marcar modo búsqueda global activo
        document.body.classList.add('busqueda-global-activa');

        // Mostrar TODAS las cards que coincidan con el nombre, sin importar tipo ni precio
        var cards = document.querySelectorAll('#gridProductos .card-dinamica');
        var total = 0;
        cards.forEach(function(card) {
            var nombre = (card.getAttribute('data-nombre') || '');
            var match  = coincideNombre(nombre, query, card);
            card.classList.toggle('oculto', !match);
            card.classList.remove('paginacion-oculto');
            if (match) total++;
        });

        // Info de resultados
        if (infoEl) {
            infoEl.style.display = 'block';
            infoEl.textContent = total > 0
                ? total + ' resultado' + (total !== 1 ? 's' : '') + ' para "' + valor.trim() + '"'
                : 'Sin resultados para "' + valor.trim() + '"';
        }

        // Actualizar paginación con resultados globales
        if (typeof window.actualizarPaginacion === 'function') window.actualizarPaginacion();
    };

    window.limpiarBusquedaGlobal = function() {
        var input    = document.getElementById('inputBusquedaGlobal');
        var btnLimpiar = document.getElementById('btnLimpiarGlobal');
        var infoEl   = document.getElementById('resultadosGlobalInfo');
        if (input) input.value = '';
        if (btnLimpiar) btnLimpiar.style.display = 'none';
        if (infoEl) infoEl.style.display = 'none';
        document.body.classList.remove('busqueda-global-activa');

        // Restaurar el modo activo actual para que sus filtros vuelvan a aplicar
        var btnActivo = document.querySelector('.btn-modo-velas.activo');
        if (btnActivo) {
            var modos = {
                'btnModoTodosProductos':  'mostrar_todo',
                'btnModoArreglos':        'arreglos',
                'btnModoPaquetes':        'paquetes',
                'btnModoEtiquetas':       'etiquetas'
            };
            var modo = modos[btnActivo.id] || 'mostrar_todo';
            if (typeof window.cambiarModoVelas === 'function') window.cambiarModoVelas(modo);
        } else {
            // Fallback: mostrar todo
            if (typeof window.cambiarModoVelas === 'function') window.cambiarModoVelas('mostrar_todo');
        }
    };

    // Limpiar búsqueda global cuando el usuario cambia de tab
    _ready(function() {
        var tabBtns = document.querySelectorAll('.btn-modo-velas');
        tabBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var input = document.getElementById('inputBusquedaGlobal');
                if (input && input.value.trim()) {
                    input.value = '';
                    document.getElementById('btnLimpiarGlobal').style.display = 'none';
                    var infoEl = document.getElementById('resultadosGlobalInfo');
                    if (infoEl) infoEl.style.display = 'none';
                    document.body.classList.remove('busqueda-global-activa');
                }
            });
        });

        // Enter en la barra también ejecuta búsqueda
        var input = document.getElementById('inputBusquedaGlobal');
        if (input) {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') limpiarBusquedaGlobal();
            });
        }
    });
})();

// ══════════════════════════════════════════════════════════════════
// PANEL BUSCA POR EVENTO — colapsar / expandir
// ══════════════════════════════════════════════════════════════════
window.togglePanelEventos = function() {
    var panel = document.getElementById('panelEventoCarrusel');
    var icono = document.getElementById('iconToggleEventos');
    if (!panel) return;
    var visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : 'block';
    if (icono) icono.textContent = visible ? '▼' : '▲';
};

window.togglePanelFormas = function() {
    var panel = document.getElementById('panelFormaCarrusel');
    var icono = document.getElementById('iconToggleFormas');
    if (!panel) return;
    var visible = panel.style.display !== 'none';
    panel.style.display = visible ? 'none' : 'block';
    if (icono) icono.textContent = visible ? '▼' : '▲';
};

// Filtro de forma global usando columna EtiquetaPrincipal (data-tipos, col G)
var formaCarruselActiva = 'todos';

window.seleccionarFormaCarrusel = function(btn, forma) {
    formaCarruselActiva = forma;
    // Marcar activo
    document.querySelectorAll('.btn-forma-carrusel').forEach(function(b) {
        b.classList.remove('activo-evento');
        b.style.background = '';
        b.style.color = '';
        b.style.borderColor = '';
    });
    btn.classList.add('activo-evento');
    if (forma === 'todos') {
        btn.style.background = '#1a1a1a';
        btn.style.color = '#fff';
        btn.style.borderColor = '#1a1a1a';
    }
    // Aplicar filtro a todas las cards visibles
    aplicarFiltroFormaCarrusel();
};

function aplicarFiltroFormaCarrusel() {
    document.querySelectorAll('.card-dinamica').forEach(function(card) {
        if (formaCarruselActiva === 'todos') {
            card.classList.remove('oculto-forma-carrusel');
        } else {
            // Usa tieneTipo() para aprovechar las variantes definidas (col G / data-tipos)
            var coincide = tieneTipo(card, formaCarruselActiva);
            card.classList.toggle('oculto-forma-carrusel', !coincide);
        }
    });
    // Limpiar hash de página para que actualizarPaginacion arranque siempre desde la 1
    if (window.history && window.history.replaceState) {
        var hashLimpio = (window.location.hash || '').replace(/#?pagina=\d+/, '').replace(/^#?&/, '').replace(/^#/, '');
        window.history.replaceState(null, '', hashLimpio ? '#' + hashLimpio : window.location.pathname);
    }
    if (typeof window.actualizarPaginacion === 'function') window.actualizarPaginacion();
}



// ══════════════════════════════════════════════════════════════════
// _reordenarBuscadorArreglos eliminada — el orden se mantiene directamente en cambiarModoVelas.
