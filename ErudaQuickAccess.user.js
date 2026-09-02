// ==UserScript==
// @name         Eruda Quick Access
// @namespace    https://github.com/StringManolo/userscripts
// @version      1.0
// @description  Abre/cierra la consola Eruda con un gesto: toca con 1 dedo, espera un momento, luego toca con 2 dedos. Sin iconos molestos.
// @author       StringManolo
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/StringManolo/userscripts
// @supportURL   https://github.com/StringManolo/userscripts/issues
// @match        *://*/*
// @noframes
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ================================================================
  // CONFIGURACIÓN
  // ================================================================
  const MIN_DELAY = 150;          // Tiempo mínimo (ms) entre toque con 1 dedo y toque con 2 dedos
  const MAX_DELAY = 500;          // Tiempo máximo (ms) para completar el gesto
  const RESET_TIMEOUT = 700;      // Tiempo tras el cual se reinicia el estado si no se completa el gesto

  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!isTouchDevice) {
    console.log('[Eruda] 💻 Dispositivo no táctil. El gesto no está disponible.');
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
  function loadEruda() {
    if (erudaLoaded) return;
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    script.onload = function () {
      erudaLoaded = true;
      eruda.init({
        tool: ['console'],
        defaults: { display: 'none' }
      });
      erudaVisible = false;
      showToast('Eruda listo');
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
      showToast('Eruda desactivado');
    } else {
      eruda.init();
      erudaVisible = true;
      showToast('Eruda activado');
    }
  }

  // ================================================================
  // TOAST NOTIFICACIÓN (estilo minimalista)
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
  // GESTOS: 1 dedo → esperar → 2 dedos
  // ================================================================
  function resetGesture() {
    gestureActive = false;
    lastSingleTapTime = 0;
    clearTimeout(resetTimer);
    resetTimer = null;
  }

  function handleTouchStart(e) {
    const target = e.target;
    if (target.closest('a') || target.closest('button') || target.closest('input') || target.closest('textarea')) {
      return;
    }

    const touches = e.touches;
    const now = Date.now();

    if (touches.length === 0 || touches.length > 2) {
      return;
    }

    // --- TOQUE CON 1 DEDO ---
    if (touches.length === 1) {
      // Si ya estamos esperando 2 dedos, ignoramos cualquier toque con 1 dedo
      if (gestureActive) {
        return;
      }

      // Iniciamos el gesto
      lastSingleTapTime = now;
      gestureActive = true;

      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        resetGesture();
      }, RESET_TIMEOUT);
      return;
    }

    // --- TOQUE CON 2 DEDOS ---
    if (touches.length === 2) {
      if (!gestureActive) {
        return;
      }

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
  // REGISTRO DEL EVENTO
  // ================================================================
  document.addEventListener('touchstart', handleTouchStart, { passive: false });

  console.log('[Eruda] 🚀 Cargado. Gesto: 1 dedo → (150-500ms) → 2 dedos.');
})();
