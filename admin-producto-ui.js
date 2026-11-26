// ══════════════════════════════════════════════════════════════════════════════
// VELAS KUKÚMITA — Mejoras de los formularios «Agregar producto» y «Editar producto» (solo administradores)
// Se carga DESPUÉS de app.js (usa procesarImagenProducto, procesarImagenProductoEdit y mostrarToast).
//
//   1. Arrastrar imágenes desde la carpeta de tu computadora y soltarlas sobre la zona de imágenes
//      (el botón de siempre sigue funcionando igual).
//   2. «Etiqueta principal» y «Etiqueta de evento» se muestran como dos botones: al presionar uno se despliegan sus
//      opciones y se pliegan las del otro (nunca están abiertas las dos a la vez). Cada botón muestra cuántas hay marcadas.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    function aviso(m) { if (typeof mostrarToast === 'function') mostrarToast(m); else console.log(m); }
    function traeArchivos(e) {
        var t = e.dataTransfer && e.dataTransfer.types;
        if (!t) return false;
        for (var i = 0; i < t.length; i++) if (t[i] === 'Files') return true;   // así se ignoran los arrastres internos (reordenar miniaturas)
        return false;
    }
    function formularioAbierto() { return !!document.querySelector('#pantallaAdminProductos.activo, #pantallaEditarProducto.activo'); }

    // ── 1. Arrastrar y soltar imágenes ──
    [
        { input: 'inputImagenProducto', fn: 'procesarImagenProducto' },
        { input: 'inputImagenProductoEdit', fn: 'procesarImagenProductoEdit' }
    ].forEach(function (z) {
        var inp = document.getElementById(z.input);
        var campo = inp && inp.closest ? inp.closest('.campo-admin-producto') : null;
        if (!campo) return;
        campo.classList.add('zona-soltar');
        var hint = document.createElement('div');
        hint.className = 'zona-soltar-hint';
        hint.textContent = '⬇️ …o arrastra aquí tus imágenes desde tus archivos';
        var wrap = campo.querySelector('.selector-imagen-wrap');
        if (wrap) wrap.insertAdjacentElement('afterend', hint); else campo.appendChild(hint);

        var profundidad = 0;
        function quitar() { profundidad = 0; campo.classList.remove('arrastrando-archivos'); }
        campo.addEventListener('dragenter', function (e) { if (!traeArchivos(e)) return; e.preventDefault(); profundidad++; campo.classList.add('arrastrando-archivos'); });
        campo.addEventListener('dragover', function (e) { if (!traeArchivos(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
        campo.addEventListener('dragleave', function (e) { if (!traeArchivos(e)) return; profundidad = Math.max(0, profundidad - 1); if (!profundidad) quitar(); });
        campo.addEventListener('drop', function (e) {
            if (!traeArchivos(e)) return;
            e.preventDefault(); e.stopPropagation(); quitar();
            var todos = Array.prototype.slice.call(e.dataTransfer.files || []);
            var imgs = todos.filter(function (f) { return /^image\//.test(f.type); });
            if (!imgs.length) { aviso('Solo se pueden soltar imágenes (JPG, PNG, WebP…).'); return; }
            if (imgs.length < todos.length) aviso('Se ignoraron ' + (todos.length - imgs.length) + ' archivo(s) que no son imágenes.');
            var f = window[z.fn];
            if (typeof f === 'function') f({ target: { files: imgs, value: '' } });   // mismo camino que el botón «Elegir de la galería»
        });
    });
    // Si se suelta un archivo fuera de la zona, el navegador no debe abrirlo y sacar al administrador del formulario
    document.addEventListener('dragover', function (e) { if (formularioAbierto() && traeArchivos(e)) e.preventDefault(); });
    document.addEventListener('drop', function (e) { if (formularioAbierto() && traeArchivos(e)) e.preventDefault(); });

    // ── 2. Etiquetas como dos botones desplegables ──
    function montarAcordeon(pantallaId) {
        var pant = document.getElementById(pantallaId); if (!pant) return;
        var pr = pant.querySelector('.campo-zona-etiqueta'), ev = pant.querySelector('.campo-zona-etiqueta-evento');
        if (!pr || !ev || !pr.parentNode) return;

        function boton(texto, cls) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'acordeon-btn ' + cls; b.setAttribute('aria-expanded', 'false');
            var t = document.createElement('span'); t.className = 'ac-texto'; t.textContent = texto;
            var c = document.createElement('span'); c.className = 'ac-cuenta'; c.hidden = true;
            var f = document.createElement('span'); f.className = 'ac-flecha'; f.textContent = '▾'; f.setAttribute('aria-hidden', 'true');
            b.appendChild(t); b.appendChild(c); b.appendChild(f);
            return b;
        }
        var bp = boton('🏷️ Etiqueta principal', 'ac-principal'), be = boton('🎉 Etiqueta de evento', 'ac-evento');
        var fila = document.createElement('div'); fila.className = 'acordeon-etiquetas';
        fila.appendChild(bp); fila.appendChild(be);
        pr.parentNode.insertBefore(fila, pr);
        pr.classList.add('acordeon-panel'); ev.classList.add('acordeon-panel');

        var abierto = null;   // 'pr' | 'ev' | null
        function mostrar(cual) {
            abierto = cual;
            pr.hidden = cual !== 'pr'; ev.hidden = cual !== 'ev';
            bp.setAttribute('aria-expanded', cual === 'pr' ? 'true' : 'false');
            be.setAttribute('aria-expanded', cual === 'ev' ? 'true' : 'false');
        }
        function cuenta(b, n) { var c = b.querySelector('.ac-cuenta'); c.textContent = String(n); c.hidden = !n; }
        function contar() {
            var np = pr.querySelectorAll('input[type="checkbox"]:checked').length;
            var otro = ev.querySelector('input[type="text"]');
            var ne = ev.querySelectorAll('input[type="checkbox"]:checked').length + ((otro && otro.value.trim()) ? 1 : 0);
            cuenta(bp, np); cuenta(be, ne);
        }
        bp.addEventListener('click', function () { mostrar(abierto === 'pr' ? null : 'pr'); });
        be.addEventListener('click', function () { mostrar(abierto === 'ev' ? null : 'ev'); });
        ['change', 'input'].forEach(function (n) { pant.addEventListener(n, contar); });
        pant.addEventListener('click', function () { setTimeout(contar, 0); });   // «Seleccionar todas»

        mostrar(null); contar();
        // Cada vez que se abre el formulario empieza con las dos plegadas y con los contadores al día
        // (al editar, app.js marca las casillas justo antes de abrir la pantalla).
        new MutationObserver(function () { if (pant.classList.contains('activo')) { mostrar(null); contar(); } })
            .observe(pant, { attributes: true, attributeFilter: ['class'] });
        setInterval(function () { if (pant.classList.contains('activo')) contar(); }, 700);   // por si algo limpia el formulario sin eventos
    }
    montarAcordeon('pantallaAdminProductos');
    montarAcordeon('pantallaEditarProducto');
})();
