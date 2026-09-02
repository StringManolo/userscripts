// ==UserScript==
// @name         Eruda Quick Access
// @namespace    https://github.com/StringManolo/userscripts
// @version      1.0
// @description  Abre/cierra la consola Eruda con un gesto: toca con 1 dedo, espera, y luego toca con 2 dedos. Persistencia entre páginas con GM_setValue.
// @author       StringManolo
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/StringManolo/userscripts
// @supportURL   https://github.com/StringManolo/userscripts/issues
// @match        *://*/*
// @noframes
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ================================================================
  // CONFIGURACIÓN
  // ================================================================
  const MIN_DELAY = 150;          // Tiempo mínimo (ms) entre el toque con 1 dedo y el de 2 dedos
  const MAX_DELAY = 500;          // Tiempo máximo (ms) para completar el gesto
  const RESET_TIMEOUT = 700;      // Tiempo tras el cual se reinicia el estado
  const STORAGE_KEY = 'eruda_active';

  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!isTouchDevice) {
    console.log('[Eruda] 💻 No táctil: gesto no disponible.');
    return;
  }

  // ================================================================
  // ESTADO
  // ================================================================
  let erudaLoaded = false;
  let erudaVisible = false;
  let lastSingleTapTime = 0;
  let gestureActive = false;
  let resetTimer = null;

  // ================================================================
  // ERUDA
  // ================================================================
  const TOOLS = [
    'console',
    'elements',
    'network',
    'resources',
    'sources',
    'info',
    'snippets'
  ];

  function loadEruda() {
    if (erudaLoaded) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    script.onload = function () {
      erudaLoaded = true;
      eruda.init({
        tool: TOOLS,
        defaults: { display: 'all' }
      });
      erudaVisible = true;
      GM_setValue(STORAGE_KEY, true);
      console.log('[Eruda] ✅ Cargado con todas las herramientas.');
      showToast('Eruda activado');
    };
    script.onerror = function () {
      console.error('[Eruda] ❌ Error al cargar.');
    };
    document.head.appendChild(script);
  }

  function toggleEruda() {
    if (!erudaLoaded) {
      loadEruda();
      return;
    }
    if (erudaVisible) {
      eruda.destroy();
      erudaVisible = false;
      GM_setValue(STORAGE_KEY, false);
      console.log('[Eruda] 🔒 Oculto');
      showToast('Eruda desactivado');
    } else {
      eruda.init();
      erudaVisible = true;
      GM_setValue(STORAGE_KEY, true);
      console.log('[Eruda] 🔓 Visible');
      showToast('Eruda activado');
    }
  }

  // ================================================================
  // TOAST
  // ================================================================
  let toastTimer = null;
  function showToast(msg) {
    const old = document.getElementById('eruda-toast');
    if (old) old.remove();
    clearTimeout(toastTimer);

    const el = document.createElement('div');
    el.id = 'eruda-toast';
    el.textContent = msg;
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(20,20,22,0.9)',
      color: '#fff',
      padding: '8px 16px',
      borderRadius: '20px',
      fontSize: '14px',
      fontFamily: '-apple-system, Roboto, Arial, sans-serif',
      zIndex: 2147483647,
      boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
      opacity: 0,
      transition: 'opacity 0.2s',
      pointerEvents: 'none'
    });
    document.documentElement.appendChild(el);
    requestAnimationFrame(() => el.style.opacity = '1');
    toastTimer = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 1500);
  }

  // ================================================================
  // GESTOS
  // ================================================================
  function resetGesture() {
    gestureActive = false;
    lastSingleTapTime = 0;
    clearTimeout(resetTimer);
    resetTimer = null;
  }

  function handleTouchStart(e) {
    const target = e.target;
    // Ignorar toques en elementos interactivos
    if (target.closest('a') || target.closest('button') || target.closest('input') || target.closest('textarea')) {
      return;
    }

    const touches = e.touches;
    const now = Date.now();

    if (touches.length === 0 || touches.length > 2) return;

    // --- TOQUE CON 1 DEDO ---
    if (touches.length === 1) {
      if (gestureActive) return; // Ignorar durante espera
      lastSingleTapTime = now;
      gestureActive = true;
      clearTimeout(resetTimer);
      resetTimer = setTimeout(resetGesture, RESET_TIMEOUT);
      return;
    }

    // --- TOQUE CON 2 DEDOS ---
    if (touches.length === 2) {
      if (!gestureActive) return;
      const elapsed = now - lastSingleTapTime;
      if (elapsed >= MIN_DELAY && elapsed <= MAX_DELAY) {
        e.preventDefault();
        toggleEruda();
        resetGesture();
      } else {
        resetGesture();
      }
    }
  }

  // ================================================================
  // RESTAURAR ESTADO AL CARGAR LA PÁGINA
  // ================================================================
  function restoreErudaState() {
    const stored = GM_getValue(STORAGE_KEY, false);
    if (stored) {
      console.log('[Eruda] 🔄 Restaurando estado activo de página anterior...');
      if (document.readyState === 'complete') {
        loadEruda();
      } else {
        window.addEventListener('load', loadEruda);
      }
    } else {
      console.log('[Eruda] 📴 Inactivo por defecto.');
    }
  }

  // ================================================================
  // REGISTRO DE EVENTOS
  // ================================================================
  document.addEventListener('touchstart', handleTouchStart, { passive: false });
  restoreErudaState();

  console.log('[Eruda] 🖐️ Gesto: 1 dedo → esperar (150-500ms) → 2 dedos. Persistencia con GM_setValue.');
})();
