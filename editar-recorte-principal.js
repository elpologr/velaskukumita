// ══════════════════════════════════════════════════════════════════════════════
// VELAS KUKÚMITA — «Editar producto»: recuadro movible sobre la imagen principal (solo administradores)
// Se carga DESPUÉS de app.js (usa _editImagenesExistentes, _editEnfoquesExistentes y _editImagenesNuevas, que ya existen en app.js).
//
//   Igual que en «Agregar producto»: arriba de las miniaturas se muestra la imagen principal (la primera) completa, con un
//   recuadro cuadrado encima que se arrastra con el mouse o el dedo (hacia los lados y hacia arriba/abajo) para elegir qué parte
//   se ve en las tarjetas del catálogo. El resultado se guarda en el mismo enfoque que ya usa el botón ⋮, así que se publica
//   al presionar «Guardar cambios» sin tocar nada más.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    var pant = document.getElementById('pantallaEditarProducto');
    if (!pant) return;
    var campo = pant.querySelector('.campo-admin-producto');
    var etiqueta = campo ? campo.querySelector('.panel-nombre-label') : null;
    if (!campo || !etiqueta) return;

    // ── Estructura (reutiliza las clases de «Agregar producto») ──
    var wrap = document.createElement('div');
    wrap.className = 'miniatura-principal-wrap';
    wrap.id = 'miniaturaPrincipalWrapEdit';
    wrap.style.display = 'none';
    wrap.style.marginBottom = '8px';
    var cont = document.createElement('div');
    cont.className = 'miniatura-principal';
    cont.id = 'miniaturaPrincipalEdit';
    var img = document.createElement('img');
    img.alt = 'Imagen principal del producto'; img.draggable = false;
    var cuadro = document.createElement('div');
    cuadro.className = 'recorte-cuadro';
    cont.appendChild(img); cont.appendChild(cuadro);
    var hint = document.createElement('span');
    hint.className = 'miniatura-principal-hint';
    hint.textContent = 'Arrastra el cuadro para elegir lo que se ve en el catálogo (imagen principal)';
    wrap.appendChild(cont); wrap.appendChild(hint);
    etiqueta.insertAdjacentElement('afterend', wrap);

    // ── Imagen principal actual: la primera de las guardadas o, si no hay, la primera de las nuevas ──
    function principal() {
        var ex = (typeof _editImagenesExistentes !== 'undefined') ? _editImagenesExistentes : [];
        var nu = (typeof _editImagenesNuevas !== 'undefined') ? _editImagenesNuevas : [];
        if (ex.length) {
            if (typeof _editEnfoquesExistentes !== 'undefined' && !_editEnfoquesExistentes[0]) _editEnfoquesExistentes[0] = { x: 50, y: 0 };
            var e = _editEnfoquesExistentes[0];
            return { src: ex[0], get x() { return e.x; }, get y() { return e.y; }, poner: function (x, y) { e.x = x; e.y = y; } };
        }
        if (nu.length) {
            var n = nu[0];
            return {
                src: n.dataUrl,
                get x() { return typeof n.enfoqueX === 'number' ? n.enfoqueX : 50; },
                get y() { return typeof n.enfoqueY === 'number' ? n.enfoqueY : 50; },
                poner: function (x, y) { n.enfoqueX = x; n.enfoqueY = y; }
            };
        }
        return null;
    }

    // ── Medidas de la imagen dentro del recuadro (object-fit: contain deja franjas vacías) ──
    function limites() {
        if (!img.naturalWidth || !img.naturalHeight) return null;
        var r = cont.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        var esc = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
        var w = img.naturalWidth * esc, h = img.naturalHeight * esc;
        return { w: w, h: h, ox: (r.width - w) / 2, oy: (r.height - h) / 2, lado: Math.min(w, h), rect: r };
    }
    function colocar() {
        var p = principal(), L = limites();
        if (!p || !L) return;
        cuadro.style.width = L.lado + 'px';
        cuadro.style.height = L.lado + 'px';
        var mx = Math.max(0, L.w - L.lado), my = Math.max(0, L.h - L.lado);
        cuadro.style.left = (L.ox + (p.x / 100) * mx) + 'px';
        cuadro.style.top = (L.oy + (p.y / 100) * my) + 'px';
    }
    img.addEventListener('load', colocar);

    // ── Arrastrar ──
    var arrastrando = false;
    function mover(cx, cy) {
        var p = principal(), L = limites();
        if (!p || !L) return;
        var mx = Math.max(0, L.w - L.lado), my = Math.max(0, L.h - L.lado);
        var izq = Math.max(0, Math.min(mx, cx - L.rect.left - L.lado / 2 - L.ox));
        var arr = Math.max(0, Math.min(my, cy - L.rect.top - L.lado / 2 - L.oy));
        p.poner(mx > 0 ? Math.round(izq / mx * 100) : 50, my > 0 ? Math.round(arr / my * 100) : 50);
        cuadro.style.left = (L.ox + izq) + 'px';
        cuadro.style.top = (L.oy + arr) + 'px';
        firma = texto(p);   // para que el vigilante no lo vuelva a dibujar
    }
    cont.addEventListener('pointerdown', function (e) {
        if (!principal()) return;
        arrastrando = true;
        try { cont.setPointerCapture(e.pointerId); } catch (x) { }
        mover(e.clientX, e.clientY);
        e.preventDefault();
    });
    cont.addEventListener('pointermove', function (e) { if (arrastrando) { mover(e.clientX, e.clientY); e.preventDefault(); } });
    function soltar() { arrastrando = false; }
    cont.addEventListener('pointerup', soltar);
    cont.addEventListener('pointercancel', soltar);

    // ── Mantenerlo al día (cuando cambian las imágenes, se quita una, se usa el botón ⋮ o se abre otro producto) ──
    var firma = '';
    function texto(p) { return p ? (p.src.length + ':' + p.src.slice(-40) + '|' + p.x + ',' + p.y) : ''; }
    function revisar() {
        if (!pant.classList.contains('activo')) return;
        var p = principal();
        if (!p) { wrap.style.display = 'none'; firma = ''; return; }
        var f = texto(p);
        if (f === firma && wrap.style.display !== 'none') return;
        if (img.getAttribute('src') !== p.src) img.src = p.src;
        wrap.style.display = 'flex';
        firma = f;
        colocar();
    }
    setInterval(revisar, 400);
    window.addEventListener('resize', colocar);
    new MutationObserver(function () { if (pant.classList.contains('activo')) { firma = ''; revisar(); } })
        .observe(pant, { attributes: true, attributeFilter: ['class'] });
})();
