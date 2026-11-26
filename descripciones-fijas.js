// ══════════════════════════════════════════════════════════════════════════════
// VELAS KUKÚMITA — Descripciones fijas (solo administradores)
// Se carga DESPUÉS de app.js (usa ADMIN_ENDPOINT, SHEET_ID, auth, _esAdminUI, parsearCSV y mostrarToast).
//
//   Debajo del campo «Descripción» de «Agregar producto» y «Editar producto» hay un botón por cada descripción fija guardada
//   (ej. «Mascotas»). Al tocarlo, su texto se escribe en la descripción. Con «➕ Nueva descripción fija» se crea otra: nombre + texto.
//   Quedan guardadas para siempre en la pestaña «DescripcionesFijas» de la hoja (la crea sola el Apps Script).
//   Si existe una etiqueta principal con el mismo nombre que la descripción fija (ej. «Mascotas»), al tocar el botón también se marca esa etiqueta.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    var lista = [];          // [{ nombre, texto }]
    var montajes = [];       // un panel por formulario
    var ocupado = false;

    function el(tag, cls, texto) { var e = document.createElement(tag); if (cls) e.className = cls; if (texto !== undefined) e.textContent = texto; return e; }
    function aviso(m) { if (typeof mostrarToast === 'function') mostrarToast(m); }
    function limpiarNombre(t) { return String(t || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[=+\-@]+/, '').trim().substring(0, 40); }

    // ── Marcar la etiqueta principal que se llame igual que la descripción fija (ej. «Mascotas») ──
    function norm(t) { return String(t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' '); }
    function activarEtiqueta(ta, nombre) {
        var pant = ta.closest ? ta.closest('#pantallaAdminProductos, #pantallaEditarProducto') : null;
        if (!pant) return;
        var buscado = norm(nombre);
        var casillas = pant.querySelectorAll('.chk-etiqueta-principal-producto, .chk-etiqueta-principal-producto-edit');
        for (var i = 0; i < casillas.length; i++) {
            var chk = casillas[i];
            var sp = chk.parentNode ? chk.parentNode.querySelector('span') : null;
            if (norm(chk.value) === buscado || (sp && norm(sp.textContent) === buscado)) {
                if (!chk.checked) {
                    chk.checked = true;
                    chk.dispatchEvent(new Event('change', { bubbles: true }));   // actualiza el contador del botón «Etiqueta principal»
                }
                return;
            }
        }
    }

    // ── Escribir una descripción fija en el campo ──
    function insertar(ta, texto) {
        var actual = ta.value.trim();
        if (actual && actual.indexOf(texto) !== -1) { aviso('Esa descripción ya está en el campo.'); return; }
        var nuevo = actual ? (actual + '\n' + texto) : texto;
        if (ta.maxLength > 0 && nuevo.length > ta.maxLength) { aviso('No cabe: la descripción pasaría de ' + ta.maxLength + ' caracteres.'); return; }
        ta.value = nuevo;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
    }

    // ── Servidor ──
    async function enviar(cuerpo) {
        var user = (typeof auth !== 'undefined') ? auth.currentUser : null;
        if (!user || (typeof _esAdminUI === 'function' && !_esAdminUI(user))) throw new Error('Tu sesión no está autorizada.');
        var idToken = await user.getIdToken(true);
        cuerpo.accion = 'descfija'; cuerpo.idToken = idToken;
        var resp = await fetch(ADMIN_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(cuerpo) });
        var data = await resp.json();
        if (!data.ok) throw new Error(data.error || 'Error del servidor');
        return data;
    }

    // ── Panel debajo de cada campo de descripción ──
    function montar(idTextarea) {
        var ta = document.getElementById(idTextarea);
        if (!ta || !ta.parentNode) return;
        var panel = el('div', 'dfj');
        var fila = el('div', 'dfj-fila');
        var chips = el('div', 'dfj-chips');
        var nueva = el('button', 'dfj-btn-nueva', '➕ Nueva descripción fija'); nueva.type = 'button';
        fila.appendChild(chips); fila.appendChild(nueva);

        var form = el('div', 'dfj-form'); form.hidden = true;
        var iNom = el('input', 'panel-nombre-input'); iNom.type = 'text'; iNom.maxLength = 40; iNom.placeholder = 'Nombre del botón, ej. Mascotas';
        var iTxt = el('textarea', 'panel-nombre-input'); iTxt.rows = 4; iTxt.maxLength = 500; iTxt.placeholder = 'Texto de la descripción fija';
        var estado = el('div', 'dfj-estado');
        var acciones = el('div', 'dfj-acciones');
        var guardar = el('button', 'dfj-guardar', '💾 Guardar descripción fija'); guardar.type = 'button';
        var cancelar = el('button', 'dfj-cancelar', 'Cancelar'); cancelar.type = 'button';
        acciones.appendChild(guardar); acciones.appendChild(cancelar);
        form.appendChild(el('div', 'dfj-form-titulo', 'Nueva descripción fija (queda guardada para todos los productos)'));
        form.appendChild(iNom); form.appendChild(iTxt); form.appendChild(estado); form.appendChild(acciones);

        panel.appendChild(fila); panel.appendChild(form);
        ta.insertAdjacentElement('afterend', panel);

        nueva.addEventListener('click', function () {
            form.hidden = !form.hidden;
            if (!form.hidden) { if (!iTxt.value) iTxt.value = ta.value.trim().substring(0, 500); iNom.focus(); }   // parte de lo que ya escribiste en la descripción
        });
        cancelar.addEventListener('click', function () { form.hidden = true; estado.textContent = ''; });
        guardar.addEventListener('click', async function () {
            if (ocupado) return;
            var nombre = limpiarNombre(iNom.value), texto = iTxt.value.replace(/\r\n/g, '\n').trim();
            function error(m) { estado.textContent = m; estado.className = 'dfj-estado error'; }
            if (!nombre) return error('Escribe el nombre de la descripción (ej. Mascotas).');
            if (!texto) return error('Escribe el texto de la descripción.');
            ocupado = true; guardar.disabled = true; guardar.textContent = '⏳ Guardando…'; estado.textContent = ''; estado.className = 'dfj-estado';
            try {
                var d = await enviar({ op: 'crear', nombre: nombre, texto: texto });
                var nom = d.nombre || nombre, txt = d.texto || texto, i = -1;
                lista.forEach(function (x, k) { if (x.nombre.toLowerCase() === nom.toLowerCase()) i = k; });
                if (i >= 0) lista[i] = { nombre: nom, texto: txt }; else lista.push({ nombre: nom, texto: txt });
                iNom.value = ''; iTxt.value = ''; form.hidden = true;
                pintarTodos();
                aviso(d.actualizado ? '✅ Descripción fija actualizada' : '✅ Descripción fija guardada');
            } catch (err) { error('❌ ' + (err.message || 'No se pudo guardar')); }
            finally { ocupado = false; guardar.disabled = false; guardar.textContent = '💾 Guardar descripción fija'; }
        });

        montajes.push({ ta: ta, chips: chips });
        pintar(montajes[montajes.length - 1]);
    }

    function pintar(m) {
        m.chips.innerHTML = '';
        if (!lista.length) { m.chips.appendChild(el('span', 'dfj-vacio', 'Sin descripciones fijas todavía.')); return; }
        lista.forEach(function (d) {
            var chip = el('span', 'dfj-chip');
            var usar = el('button', 'dfj-usar', d.nombre); usar.type = 'button'; usar.title = d.texto;
            usar.addEventListener('click', function () { activarEtiqueta(m.ta, d.nombre); insertar(m.ta, d.texto); });
            var borrar = el('button', 'dfj-borrar', '✕'); borrar.type = 'button'; borrar.title = 'Borrar esta descripción fija'; borrar.setAttribute('aria-label', 'Borrar ' + d.nombre);
            borrar.addEventListener('click', async function () {
                if (ocupado) return;
                if (!window.confirm('¿Borrar la descripción fija «' + d.nombre + '»? Los productos que ya la usan no cambian.')) return;
                ocupado = true;
                try {
                    await enviar({ op: 'borrar', nombre: d.nombre });
                    lista = lista.filter(function (x) { return x.nombre !== d.nombre; });
                    pintarTodos(); aviso('Descripción fija borrada');
                } catch (err) { aviso('❌ ' + (err.message || 'No se pudo borrar')); }
                finally { ocupado = false; }
            });
            chip.appendChild(usar); chip.appendChild(borrar);
            m.chips.appendChild(chip);
        });
    }
    function pintarTodos() { montajes.forEach(pintar); }

    // ── Cargar las guardadas (pestaña «DescripcionesFijas»; si no existe todavía, simplemente no hay ninguna) ──
    function cargar() {
        if (typeof SHEET_ID === 'undefined' || typeof parsearCSV !== 'function') return;
        var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:csv&sheet=' +
            encodeURIComponent('DescripcionesFijas') + '&_=' + Date.now();
        fetch(url).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .then(function (txt) {
                var filas = parsearCSV(txt);
                // Si la pestaña no existe, Google devuelve otra hoja: se valida el encabezado para no confundirse
                if (!filas.length || (filas[0][0] || '').trim().toLowerCase() !== 'nombre' || (filas[0][1] || '').trim().toLowerCase() !== 'texto') return;
                var nuevas = [];
                for (var i = 1; i < filas.length; i++) {
                    var nombre = (filas[i][0] || '').trim(), texto = (filas[i][1] || '').replace(/\r\n/g, '\n').trim();
                    if (nombre && texto) nuevas.push({ nombre: nombre, texto: texto });
                }
                lista = nuevas; pintarTodos();
            })
            .catch(function (e) { console.warn('[Kukumita] No se pudieron cargar las descripciones fijas:', e); });
    }

    montar('inputDescripcionProducto');
    montar('inputDescripcionProductoEdit');
    cargar();
})();
