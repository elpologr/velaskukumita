// ══════════════════════════════════════════════════════════════════════════════
// VELAS KUKÚMITA — Botón «atrás» del navegador / del teléfono en TODAS las pantallas y ventanas
// Se carga al FINAL (después de app.js y de todos los demás archivos).
//
//   PROBLEMA: varias ventanas (Mesas, su catálogo lateral, Cuadrícula, Configuración, Fechas especiales, submenú de «Revisar precios»,
//   Bazar, Compartir página/QR, información de etiquetas, imágenes en grande, recuadros…) se abrían SIN guardar una entrada en el
//   historial del navegador. Al presionar «atrás» no había nada que cerrar y el navegador salía de la página.
//
//   SOLUCIÓN: este archivo vigila cuáles de esas ventanas están abiertas. Al abrirse una, guarda una entrada en el historial; al presionar
//   «atrás» la cierra (la de más arriba primero) y NO sale de la página. Si la ventana se cierra con su propio botón (✕, Cancelar…),
//   la entrada se retira sola. Las ventanas que ya manejaba app.js (producto, carrito, favoritos, menú, perfil, agregar/editar producto…)
//   no se tocan: siguen igual, pero ahora conviven con las nuevas en el orden correcto (cada una se cierra en el orden en que se abrió).
//
//   Para agregar una ventana nueva en el futuro basta con sumarla a la lista VENTANAS de abajo.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    // ── 1. Cada entrada del historial lleva un número de «profundidad» (kDepth). Así se sabe qué ventanas quedaron «por encima»
    //      de la entrada a la que se regresó, aunque app.js y este archivo guarden entradas a la vez. ──
    var empujar = history.pushState.bind(history), reemplazar = history.replaceState.bind(history);
    function profundidad() { var s = history.state; return (s && typeof s.kDepth === 'number') ? s.kDepth : 0; }
    history.pushState = function (estado, titulo, url) {
        var s = (estado && typeof estado === 'object') ? Object.assign({}, estado) : {};
        s.kDepth = profundidad() + 1;
        return (url === undefined) ? empujar(s, titulo) : empujar(s, titulo, url);
    };
    history.replaceState = function (estado, titulo, url) {
        var s = (estado && typeof estado === 'object') ? Object.assign({}, estado) : {};
        s.kDepth = profundidad();   // reemplazar el estado no cambia el lugar que ocupa en el historial
        return (url === undefined) ? reemplazar(s, titulo) : reemplazar(s, titulo, url);
    };

    // ── 2. Ventanas que NO guardaban historial por su cuenta ──
    function q(sel) { return document.querySelector(sel); }
    function clic(sel) { var e = q(sel); if (e) e.click(); }
    function visible(e) { return !!e && e.style.display !== 'none' && e.style.visibility !== 'hidden' && !e.hidden; }

    var VENTANAS = [
        // Mesas
        { id: 'mesas-cat', abierta: function () { return !!q('#mesasCat.abierta'); },
          cerrar: function () { var a = q('#mesasCatAtras'); if (a && a.offsetParent !== null) a.click(); else clic('#mesasCatCerrar'); } },
        { id: 'mesas', abierta: function () { return !!q('#pantallaMesas.abierta'); },
          cerrar: function () { if (typeof window.cerrarMesas === 'function') window.cerrarMesas(); } },
        // Administración
        { id: 'cuadricula', abierta: function () { return !!q('#pantallaCuadricula.abierta'); },
          cerrar: function () {
              var bs = document.querySelectorAll('#pantallaCuadricula button');
              for (var i = 0; i < bs.length; i++) if (/Cerrar/.test(bs[i].textContent)) { bs[i].click(); return; }
          } },
        { id: 'config-portada', abierta: function () { return !!q('#modalConfigPortada.abierto'); }, cerrar: function () { clic('#cfgPortadaCancelar'); } },
        { id: 'fechas-botones', abierta: function () { return !!q('#modalFestividades.abierto'); }, cerrar: function () { clic('#modalFestividades .mf-cancelar'); } },
        { id: 'fechas-destacados', abierta: function () { return !!q('#modalDestacados.abierto'); }, cerrar: function () { clic('#modalDestacados .md-cancelar'); } },
        { id: 'lista-precios', abierta: function () { return !!q('#submenuListaPrecios.abierto'); },
          cerrar: function () { var a = q('#submenuListaPrecios .slp-atras'); if (a && a.style.visibility === 'visible') a.click(); else clic('#submenuListaPrecios .slp-cerrar'); } },
        { id: 'fijar-precio', abierta: function () { return !!q('.fp-fondo'); }, cerrar: function () { clic('.fp-fondo .fp-cancelar'); } },
        { id: 'recuadros', abierta: function () { return visible(q('.zi-barra')); },
          cerrar: function () {
              var bs = document.querySelectorAll('.zi-barra .zi-b');
              for (var i = 0; i < bs.length; i++) if (/^\s*Cancelar\s*$/.test(bs[i].textContent)) { bs[i].click(); return; }
          } },
        // Imágenes en grande
        { id: 'visor-lista', abierta: function () { return !!q('.slp-visor'); }, cerrar: function () { clic('.slp-visor'); } },
        { id: 'visor-completo', abierta: function () { return !!q('.visor-img-completa'); }, cerrar: function () { clic('.visor-img-completa .vic-cerrar'); } },
        { id: 'lightbox', abierta: function () { var l = q('#lightboxFB'); return !!l && !!l.style.display && l.style.display !== 'none'; },
          cerrar: function () { var l = q('#lightboxFB'); if (l) l.style.display = 'none'; if (typeof window._desbloquearScrollBody === 'function') window._desbloquearScrollBody(); } },
        // Ventanas de app.js que se abrían sin historial
        { id: 'bazar', abierta: function () { var m = q('#modalBazar'); return !!m && (m.style.display === 'flex' || m.classList.contains('abierto')); },
          cerrar: function () { if (typeof window.cerrarModalBazar === 'function') window.cerrarModalBazar(); } },
        { id: 'admin-bazar', abierta: function () { var m = q('#modalAdminBazar'); return !!m && m.style.display === 'flex'; },
          cerrar: function () { if (typeof window.cerrarPantallaAdminBazar === 'function') window.cerrarPantallaAdminBazar(); else { var m = q('#modalAdminBazar'); if (m) m.style.display = 'none'; } } },
        { id: 'qr', abierta: function () { return !!q('#modalQR.abierto'); },
          cerrar: function () { if (typeof window.cerrarModalQR === 'function') window.cerrarModalQR(); else { var m = q('#modalQR'); if (m) m.classList.remove('abierto'); } } },
        { id: 'info-etiqueta', abierta: function () { return !!q('#modalInfoEtiqueta.abierto'); },
          cerrar: function () { if (typeof window.cerrarModalInfoEtiqueta === 'function') window.cerrarModalInfoEtiqueta(); } }
    ];

    var pila = [];          // ventanas abiertas que ya tienen su entrada: { v: ventana, d: profundidad }
    var silencio = 0;       // popstates provocados por este archivo (no deben cerrar nada más)
    var silencioHasta = 0;

    function enPila(v) { for (var i = 0; i < pila.length; i++) if (pila[i].v === v) return i; return -1; }

    // ── 3. Vigilar cuáles ventanas están abiertas ──
    function sincronizar() {
        VENTANAS.forEach(function (v) {
            var abierta = false;
            try { abierta = !!v.abierta(); } catch (e) { }
            var i = enPila(v);
            if (abierta && i < 0) {
                history.pushState({ kukuVentana: v.id }, '');
                pila.push({ v: v, d: profundidad() });
            } else if (!abierta && i >= 0) {
                var o = pila.splice(i, 1)[0];
                // Se cerró con su propio botón: si su entrada es la última del historial, se retira para que «atrás» no tenga que gastarse en vano
                if (profundidad() === o.d) {
                    silencio++; silencioHasta = Date.now() + 1500;
                    history.back();
                }
            }
        });
    }
    var pendiente = false;
    function programar() {
        if (pendiente) return;
        pendiente = true;
        requestAnimationFrame(function () { pendiente = false; try { sincronizar(); } catch (e) { console.warn('[historial-atras]', e); } });
    }
    new MutationObserver(programar).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'hidden'], childList: true, subtree: true });
    setInterval(programar, 1500);   // red de seguridad

    // ── 4. Botón «atrás»: cierra las ventanas cuya entrada quedó atrás (en fase de captura, para ir antes que el listener de app.js) ──
    window.addEventListener('popstate', function (e) {
        if (silencio > 0) {
            if (Date.now() > silencioHasta) silencio = 0;
            else { silencio--; e.stopImmediatePropagation(); return; }
        }
        var d = profundidad();
        var cerrar = pila.filter(function (o) { return o.d > d; }).sort(function (a, b) { return b.d - a.d; });
        if (!cerrar.length) return;   // no es de ninguna ventana de este archivo: lo maneja app.js como siempre
        cerrar.forEach(function (o) {
            var i = pila.indexOf(o); if (i >= 0) pila.splice(i, 1);
            try { o.v.cerrar(); } catch (err) { console.warn('[historial-atras]', err); }
        });
        e.stopImmediatePropagation();   // para que app.js no cierre además otra pantalla que esté debajo
        programar();                    // si la ventana no se dejó cerrar (por ejemplo, un aviso de cambios sin guardar), vuelve a guardar su entrada
    }, true);

    programar();
})();
