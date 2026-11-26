// ══════════════════════════════════════════════════════════════════════════════
// VELAS KUKÚMITA — «Fijar precio» de los productos marcados «Sin precio» (solo administradores)
// Se carga DESPUÉS de app.js (usa ADMIN_ENDPOINT, auth, _esAdminUI, mostrarToast y cargarDesdeGoogleSheets).
//
//   Desde la franja roja de la tarjeta o desde el submenú del producto, un administrador (correos de ADMIN_EMAILS)
//   abre esta ventana, escribe el precio (y el de mayoreo, opcional) y se guarda en la hoja con la acción «fijarprecio»
//   del Apps Script. El servidor vuelve a verificar el token y el correo; aquí solo se evita mostrar la ventana a otras personas.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
    'use strict';

    var capa = null, ocupado = false;

    function el(tag, cls, texto) { var e = document.createElement(tag); if (cls) e.className = cls; if (texto !== undefined) e.textContent = texto; return e; }
    function aviso(m) { if (typeof mostrarToast === 'function') mostrarToast(m); }
    function cerrar() { if (capa && !ocupado) { capa.remove(); capa = null; document.removeEventListener('keydown', alTeclear); } }
    function alTeclear(e) { if (e.key === 'Escape') cerrar(); }

    window.abrirFijarPrecio = function (card) {
        var user = (typeof auth !== 'undefined') ? auth.currentUser : null;
        if (!user || typeof _esAdminUI !== 'function' || !_esAdminUI(user)) { aviso('Tu sesión no está autorizada.'); return; }
        if (!card) return;
        var fila = card.getAttribute('data-sheet-row') || '';
        var nombre = (card.getAttribute('data-nombre') || '').trim();
        if (!fila || !nombre) { aviso('No se pudo identificar este producto.'); return; }
        cerrar();

        capa = el('div', 'fp-fondo');
        var caja = el('div', 'fp-caja'); caja.setAttribute('role', 'dialog'); caja.setAttribute('aria-modal', 'true');
        caja.appendChild(el('h4', 'fp-titulo', '⚠️ Fijar precio'));
        caja.appendChild(el('div', 'fp-producto', nombre));

        function campo(etiqueta, ph) {
            var l = el('label', 'fp-campo'); l.appendChild(el('span', '', etiqueta));
            var i = document.createElement('input');
            i.type = 'number'; i.min = '0'; i.step = 'any'; i.placeholder = ph; i.setAttribute('inputmode', 'decimal');
            l.appendChild(i); caja.appendChild(l); return i;
        }
        var iPrecio = campo('Precio (MXN)', 'Ej. 150');
        var iMay = campo('Precio de mayoreo (opcional)', 'Opcional');
        var msg = el('div', 'fp-msg');
        var acc = el('div', 'fp-acciones');
        var bGuardar = el('button', 'fp-guardar', '💾 Guardar precio'); bGuardar.type = 'button';
        var bCancelar = el('button', 'fp-cancelar', 'Cancelar'); bCancelar.type = 'button';
        acc.appendChild(bGuardar); acc.appendChild(bCancelar);
        caja.appendChild(msg); caja.appendChild(acc);
        capa.appendChild(caja);
        document.body.appendChild(capa);
        document.addEventListener('keydown', alTeclear);
        capa.addEventListener('click', function (e) { if (e.target === capa) cerrar(); });
        bCancelar.addEventListener('click', cerrar);
        setTimeout(function () { iPrecio.focus(); }, 50);

        function error(t) { msg.textContent = t; msg.className = 'fp-msg error'; }
        iPrecio.addEventListener('keydown', function (e) { if (e.key === 'Enter') bGuardar.click(); });

        bGuardar.addEventListener('click', async function () {
            if (ocupado) return;
            var precio = iPrecio.value.trim(), may = iMay.value.trim();
            if (precio === '' || isNaN(Number(precio)) || Number(precio) <= 0) return error('Escribe un precio mayor a 0.');
            if (may !== '' && (isNaN(Number(may)) || Number(may) < 0)) return error('El precio de mayoreo no es válido.');
            ocupado = true; bGuardar.disabled = true; bCancelar.disabled = true;
            msg.className = 'fp-msg'; msg.textContent = 'Guardando en la hoja…';
            try {
                var u = auth.currentUser;
                if (!u || !_esAdminUI(u)) throw new Error('Tu sesión no está autorizada.');
                var idToken = await u.getIdToken(true);
                var resp = await fetch(ADMIN_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // evita el preflight CORS que Apps Script no responde
                    body: JSON.stringify({ accion: 'fijarprecio', idToken: idToken, filaEditar: fila, nombreActual: nombre, precio: precio, precioMayoreo: may })
                });
                var data = await resp.json();
                if (!data.ok) throw new Error(data.error || 'Error del servidor');
                ocupado = false; cerrar();
                aviso('✅ Precio fijado: $' + precio + ' MXN');
                var cerrarMP = (typeof cerrarModalProducto === 'function') ? cerrarModalProducto : window.cerrarModalProducto;
                if (typeof cerrarMP === 'function') { try { cerrarMP(); } catch (e) { } }
                if (typeof cargarDesdeGoogleSheets === 'function') setTimeout(cargarDesdeGoogleSheets, 1200);
            } catch (err) {
                ocupado = false; bGuardar.disabled = false; bCancelar.disabled = false;
                error('❌ ' + (err && err.message ? err.message : 'No se pudo guardar'));
            }
        });
    };
})();
