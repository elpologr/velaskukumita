// PROYECTO: Velas Kukúmita · Ruta: pwa-velas.js (raíz del repo de Velas). Se carga DESPUÉS de app.js.
// Registra el service worker y agrega el botón «📲 Instalar app» en el menú lateral (drawer). No toca nada de administración.
(function () {
    'use strict';

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('sw-velas.js', { scope: './' }).catch(function () { });
        });
    }

    var yaEnApp = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
    var evento = (window.__pwa && window.__pwa.evento) || null;
    addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); evento = e; });
    addEventListener('appinstalled', function () { evento = null; aviso('✅ Listo: busca «Velas Kukúmita» en tu pantalla de inicio.'); ocultarBoton(); });

    function aviso(m) { if (typeof mostrarToast === 'function') mostrarToast(m); }
    var boton = null;
    function ocultarBoton() { if (boton) boton.style.display = 'none'; }

    function ayuda(texto) {
        var fondo = document.createElement('div');
        fondo.style.cssText = 'position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;';
        var caja = document.createElement('div');
        caja.setAttribute('role', 'dialog'); caja.setAttribute('aria-modal', 'true');
        caja.style.cssText = 'background:#fff;color:#3b2f27;max-width:360px;width:100%;border-radius:16px;padding:18px 18px 14px;font:15px/1.45 system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35);';
        var p = document.createElement('p'); p.style.margin = '0 0 14px'; p.textContent = texto;
        var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Entendido';
        b.style.cssText = 'width:100%;padding:11px;border:none;border-radius:10px;background:#5c4d43;color:#fff;font-weight:700;font-size:15px;cursor:pointer;';
        function cerrar() { fondo.remove(); }
        b.addEventListener('click', cerrar);
        fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar(); });
        caja.appendChild(p); caja.appendChild(b); fondo.appendChild(caja); document.body.appendChild(fondo);
    }

    async function instalar() {
        if (evento) { var e = evento; evento = null; e.prompt(); try { await e.userChoice; } catch (x) { } return; }
        var ua = navigator.userAgent || '';
        var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        var otraApp = /FBAN|FBAV|Instagram|WhatsApp|Line\/|Messenger/i.test(ua);
        ayuda(ios ? 'En iPhone/iPad: abre esta página en Safari, toca Compartir (el cuadro con la flecha) y luego «Agregar a pantalla de inicio».'
            : otraApp ? 'Estás en el navegador interno de otra app (WhatsApp, Facebook, Instagram…) y ahí no se puede instalar. Toca ⋮ y elige «Abrir en Chrome».'
            : 'Abre el menú de Chrome (⋮) y elige «Instalar aplicación» o «Agregar a la pantalla de inicio». Si no aparece, revisa que no estés en modo incógnito y que Chrome esté actualizado.');
    }

    function montarBoton() {
        if (yaEnApp) return;                                  // ya dentro de la app instalada no tiene sentido ofrecerlo
        var drawer = document.getElementById('drawer');
        if (!drawer || document.getElementById('btnInstalarApp')) return;
        boton = document.createElement('button');
        boton.type = 'button'; boton.id = 'btnInstalarApp'; boton.textContent = '📲 Instalar app';
        boton.style.cssText = 'display:block;width:calc(100% - 32px);margin:12px 16px;padding:12px;border:none;border-radius:12px;background:#5c4d43;color:#fff;font-size:15px;font-weight:700;cursor:pointer;';
        boton.addEventListener('click', instalar);
        var esp = drawer.querySelector('.drawer-espaciador');
        if (esp) drawer.insertBefore(boton, esp); else drawer.appendChild(boton);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montarBoton); else montarBoton();
})();
