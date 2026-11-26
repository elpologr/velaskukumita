// ══════════════════════════════════════════════════════════════════════════════
// VELAS KUKÚMITA — Galería de la lista «Revisar precios» (pública)
// Se carga DESPUÉS de app.js. app.js la llama desde abrirModalProducto(card) con window.mostrarGaleriaRevisarPrecios(card).
//
//   En los productos con botón «Revisar precios», justo debajo de la descripción se muestra una imagen de los artículos de la lista
//   con una flecha negra grande en el borde derecho de la imagen para pasar al siguiente. También se puede deslizar con el dedo (a ambos lados) y tocar la imagen
//   para verla en grande. Cada imagen muestra el nombre y el precio de su artículo.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    function el(tag, cls, texto) { var e = document.createElement(tag); if (cls) e.className = cls; if (texto !== undefined) e.textContent = texto; return e; }

    window.mostrarGaleriaRevisarPrecios = function (card) {
        var anterior = document.getElementById('glpGaleria');
        if (anterior) anterior.remove();
        var zona = document.getElementById('modalDescripcionZona');
        if (!card || !zona || !zona.parentNode) return;
        if (typeof _esRevisarPrecios !== 'function' || !_esRevisarPrecios(card)) return;

        var items = _listaPreciosCard(card).filter(function (it) { return it && /^https:\/\//i.test(it.img || ''); });
        if (!items.length) return;

        var g = el('div', 'glp'); g.id = 'glpGaleria';
        var marco = el('div', 'glp-marco');
        var img = document.createElement('img'); img.className = 'glp-img'; img.alt = ''; img.draggable = false;
        var cuenta = el('div', 'glp-cuenta');
        marco.appendChild(img); marco.appendChild(cuenta);

        var nombre = el('div', 'glp-nombre'), precio = el('div', 'glp-precio');
        var info = el('div', 'glp-info'); info.appendChild(nombre); info.appendChild(precio);

        // Flecha grande y negra en el borde derecho de la imagen (siguiente)
        var sig = el('button', 'glp-flecha'); sig.type = 'button'; sig.setAttribute('aria-label', 'Siguiente imagen');
        sig.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M8 3l9 9-9 9" fill="none" stroke="#000" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        if (items.length > 1) marco.appendChild(sig);

        g.appendChild(marco); g.appendChild(info);

        var i = 0;
        function pintar() {
            var it = items[i];
            img.src = it.img; img.alt = it.nombre || '';
            nombre.textContent = it.nombre || '';
            precio.textContent = it.sinPrecio ? 'Precio por consultar' : ((typeof _formatoPrecio === 'function') ? _formatoPrecio(it.precio) : ('$' + it.precio));
            cuenta.textContent = (i + 1) + ' / ' + items.length;
            cuenta.style.display = items.length > 1 ? '' : 'none';
            // Precarga la siguiente para que el cambio sea instantáneo
            if (items.length > 1) { var pre = new Image(); pre.src = items[(i + 1) % items.length].img; }
        }
        function ir(d) { i = (i + d + items.length) % items.length; pintar(); }
        sig.addEventListener('click', function () { ir(1); });
        img.addEventListener('click', function () { if (typeof abrirVisorImagenLista === 'function') abrirVisorImagenLista(items[i].img, items[i].nombre); });

        // Deslizar con el dedo
        var x0 = null;
        marco.addEventListener('touchstart', function (e) { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
        marco.addEventListener('touchend', function (e) {
            if (x0 === null || items.length < 2) return;
            var dx = e.changedTouches[0].clientX - x0; x0 = null;
            if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
        }, { passive: true });

        pintar();
        zona.insertAdjacentElement('afterend', g);
    };
})();
