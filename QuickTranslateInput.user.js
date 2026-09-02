// ==UserScript==
// @name         Quick Translate Input
// @namespace    https://github.com/StringManolo/userscripts
// @version      1.0
// @description  Traduce al idioma que elijas lo que escribas en un input flotante. Se abre con doble clic (PC) o dos toques consecutivos con 2 dedos (móvil). Persistencia del idioma, copia y pronunciación.
// @author       StringManolo
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/StringManolo/userscripts
// @supportURL   https://github.com/StringManolo/userscripts/issues
// @match        *://*/*
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      translate.googleapis.com
// @connect      wiktionary.org
// @connect      *.wiktionary.org
// @connect      upload.wikimedia.org
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // CONFIGURACIÓN
  // ------------------------------------------------------------------
  const STORAGE_KEY = 'qti_target_lang';
  const DEFAULT_LANG = 'es';
  const DOUBLE_TAP_DELAY = 500; // ms entre toques para considerar doble toque

  // Detección de dispositivo táctil (más fiable)
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  console.log(`[QTI] Dispositivo táctil: ${isTouchDevice}`);

  // ------------------------------------------------------------------
  // ESTADO
  // ------------------------------------------------------------------
  let currentTargetLang = localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
  let lastOriginalText = '';
  let lastTranslatedText = '';
  let lastDetectedLang = 'en';
  let audioCache = new Map();
  let floatInputVisible = false;
  let lastClickTime = 0;
  let toastVisible = false;

  // Variables para detección de doble toque con 2 dedos
  let twoFingerTouchCount = 0;        // número de toques completos con 2 dedos
  let twoFingerTimer = null;          // timer para reiniciar el contador
  let isTouching = false;             // si actualmente hay un toque con 2 dedos en curso
  let touchStartTime = 0;             // para depuración

  // ------------------------------------------------------------------
  // ESTILOS (igual que antes)
  // ------------------------------------------------------------------
  GM_addStyle(`
    /* TOAST */
    #qti-toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%) translateY(16px);
      max-width: 88vw;
      background: #1e1e1e;
      color: #fff;
      padding: 14px 20px;
      border-radius: 16px;
      font-size: 16px;
      line-height: 1.5;
      box-shadow: 0 8px 30px rgba(0,0,0,0.5);
      z-index: 2147483647;
      opacity: 0;
      pointer-events: none;
      transition: opacity .25s ease, transform .25s ease;
      font-family: -apple-system, Roboto, Arial, sans-serif;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid #333;
    }
    #qti-toast.qti-visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
      pointer-events: auto;
    }
    #qti-toast .qti-text {
      flex: 1;
    }
    #qti-toast .qti-text b {
      font-weight: 600;
      display: block;
    }
    #qti-toast .qti-hint {
      font-size: 11px;
      opacity: .65;
      margin-top: 2px;
    }
    #qti-toast .qti-copy-btn {
      background: transparent;
      border: none;
      color: #fff;
      border-radius: 8px;
      padding: 4px 8px;
      font-size: 18px;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      flex-shrink: 0;
      opacity: 0.7;
    }
    #qti-toast .qti-copy-btn:hover {
      background: rgba(255,255,255,0.1);
      opacity: 1;
    }
    #qti-toast .qti-copy-btn:active {
      transform: scale(0.95);
    }
    #qti-toast.qti-loading .qti-hint {
      opacity: .9;
    }

    /* INPUT FLOTANTE */
    #qti-float-container {
      position: fixed;
      background: #1e1e1e;
      border: 1px solid #444;
      border-radius: 16px;
      padding: 10px 14px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.6);
      z-index: 2147483647;
      display: none;
      align-items: center;
      gap: 10px;
      font-family: -apple-system, Roboto, Arial, sans-serif;
      backdrop-filter: blur(6px);
      background: rgba(30,30,30,0.95);
      max-width: 90vw;
    }
    #qti-float-container.qti-visible {
      display: flex;
    }

    /* Posición en escritorio (abajo a la derecha) */
    #qti-float-container {
      right: 20px;
      bottom: 30px;
    }

    /* Posición en móvil (arriba con margen) */
    @media (pointer: coarse) {
      #qti-float-container {
        right: 10px;
        top: 20px;
        bottom: auto;
        left: 10px;
        width: auto;
      }
    }

    #qti-float-input {
      background: transparent;
      border: none;
      color: #fff;
      font-size: 16px;
      padding: 6px 8px;
      outline: none;
      min-width: 140px;
      flex: 1;
      font-family: inherit;
    }
    #qti-float-input::placeholder {
      color: #888;
    }

    #qti-lang-selector {
      background: #333;
      border: none;
      color: #fff;
      border-radius: 8px;
      padding: 4px 8px;
      font-size: 13px;
      cursor: pointer;
      outline: none;
      font-family: inherit;
      flex-shrink: 0;
    }
    #qti-lang-selector option {
      background: #1e1e1e;
      color: #fff;
    }

    #qti-float-close {
      background: transparent;
      border: none;
      color: #888;
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
      line-height: 1;
      transition: color 0.2s;
      flex-shrink: 0;
    }
    #qti-float-close:hover {
      color: #fff;
    }

    /* Indicador de carga en el toast */
    .qti-spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255,255,255,0.2);
      border-top-color: #fff;
      border-radius: 50%;
      animation: qti-spin 0.8s linear infinite;
      margin-right: 8px;
    }
    @keyframes qti-spin {
      to { transform: rotate(360deg); }
    }
  `);

  // ------------------------------------------------------------------
  // UI: TOAST
  // ------------------------------------------------------------------
  const toast = document.createElement('div');
  toast.id = 'qti-toast';
  document.documentElement.appendChild(toast);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function renderToast(main, hint, { loading = false, copyText = null } = {}) {
    const copyBtn = copyText !== null
      ? `<button class="qti-copy-btn" id="qti-copy-action" title="Copiar traducción">📋</button>`
      : '';

    toast.innerHTML = `
      <div class="qti-text">
        ${loading ? '<span class="qti-spinner"></span>' : ''}
        <b>${escapeHtml(main)}</b>
        <span class="qti-hint">${hint}</span>
      </div>
      ${copyBtn}
    `;
    toast.classList.toggle('qti-loading', loading);
    toast.classList.add('qti-visible');
    toastVisible = true;

    const copyAction = document.getElementById('qti-copy-action');
    if (copyAction) {
      copyAction.addEventListener('click', (e) => {
        e.stopPropagation();
        if (copyText !== null) {
          navigator.clipboard.writeText(copyText).then(() => {
            copyAction.textContent = '✅';
            setTimeout(() => { copyAction.textContent = '📋'; }, 2000);
          }).catch(() => {
            const textArea = document.createElement('textarea');
            textArea.value = copyText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            copyAction.textContent = '✅';
            setTimeout(() => { copyAction.textContent = '📋'; }, 2000);
          });
        }
      });
    }
  }

  function hideToast() {
    toast.classList.remove('qti-visible');
    toastVisible = false;
  }

  // Cerrar toast al hacer clic/touch fuera, excluyendo input y toast
  document.addEventListener('click', (e) => {
    if (toastVisible && !toast.contains(e.target) && !container.contains(e.target)) {
      hideToast();
    }
  }, true);

  document.addEventListener('touchstart', (e) => {
    if (toastVisible && !toast.contains(e.target) && !container.contains(e.target)) {
      hideToast();
    }
  }, { passive: true });

  // ------------------------------------------------------------------
  // UI: INPUT FLOTANTE
  // ------------------------------------------------------------------
  const container = document.createElement('div');
  container.id = 'qti-float-container';
  container.innerHTML = `
    <input id="qti-float-input" type="text" placeholder="Escribe y pulsa Enter..." />
    <select id="qti-lang-selector"></select>
    <button id="qti-float-close" title="Cerrar">✕</button>
  `;
  document.documentElement.appendChild(container);

  const floatInput = document.getElementById('qti-float-input');
  const langSelector = document.getElementById('qti-lang-selector');
  const closeBtn = document.getElementById('qti-float-close');

  // Poblar selector de idiomas
  const LANG_OPTIONS = [
    { code: 'es', label: '🇪🇸 Español' },
    { code: 'en', label: '🇬🇧 Inglés' },
    { code: 'fr', label: '🇫🇷 Francés' },
    { code: 'de', label: '🇩🇪 Alemán' },
    { code: 'ru', label: '🇷🇺 Ruso' },
    { code: 'pt', label: '🇵🇹 Portugués' },
    { code: 'it', label: '🇮🇹 Italiano' },
    { code: 'ja', label: '🇯🇵 Japonés' },
    { code: 'zh', label: '🇨🇳 Chino' },
    { code: 'ar', label: '🇸🇦 Árabe' },
  ];
  LANG_OPTIONS.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.code;
    option.textContent = opt.label;
    langSelector.appendChild(option);
  });
  langSelector.value = currentTargetLang;

  function showFloatInput() {
    container.classList.add('qti-visible');
    floatInputVisible = true;
    floatInput.value = '';
    if (isTouchDevice) {
      setTimeout(() => floatInput.focus(), 100);
    } else {
      floatInput.focus();
    }
  }

  function hideFloatInput() {
    container.classList.remove('qti-visible');
    floatInputVisible = false;
  }

  // Cerrar al hacer clic/touch fuera del input
  document.addEventListener('click', (e) => {
    if (floatInputVisible && !container.contains(e.target)) {
      hideFloatInput();
    }
  }, true);

  document.addEventListener('touchstart', (e) => {
    if (floatInputVisible && !container.contains(e.target)) {
      hideFloatInput();
    }
  }, { passive: true });

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideFloatInput();
  });

  floatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideFloatInput();
  });

  // ------------------------------------------------------------------
  // GESTOS: DOBLE CLIC (PC) y DOBLE TOQUE CON 2 DEDOS (móvil)
  // ------------------------------------------------------------------

  // --- Doble clic (solo si NO es táctil) ---
  if (!isTouchDevice) {
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (target.closest('a') || target.closest('button') || target.closest('input') || target.closest('textarea')) return;
      if (container.contains(target)) return;
      if (toast.contains(target)) return;

      const now = Date.now();
      if (now - lastClickTime < DOUBLE_TAP_DELAY) {
        e.preventDefault();
        if (floatInputVisible) hideFloatInput(); else showFloatInput();
        lastClickTime = 0;
      } else {
        lastClickTime = now;
      }
    }, true);
  }

  // --- Doble toque con 2 dedos (solo si es táctil) ---
  if (isTouchDevice) {
    // Contamos los toques completos con 2 dedos
    document.addEventListener('touchstart', (e) => {
      const target = e.target;
      if (target.closest('a') || target.closest('button') || target.closest('input') || target.closest('textarea')) return;
      if (container.contains(target)) return;
      if (toast.contains(target)) return;

      const touches = e.touches;

      // Si no son 2 dedos, reiniciamos el estado
      if (touches.length !== 2) {
        if (isTouching) {
          // Si estaba en un toque con 2 dedos y ahora no, lo consideramos un toque "cancelado"
          isTouching = false;
        }
        return;
      }

      // Si ya estamos en un toque con 2 dedos, ignoramos (evita múltiples eventos)
      if (isTouching) {
        return;
      }

      // Primer toque con 2 dedos: marcamos que estamos tocando
      isTouching = true;
      touchStartTime = Date.now();
      console.log('[QTI] Inicio toque con 2 dedos');
    }, { passive: true });

    // Cuando se levantan los dedos, contamos el toque
    document.addEventListener('touchend', (e) => {
      // Solo procesamos si estábamos en un toque con 2 dedos
      if (!isTouching) return;

      // Verificar si los dedos que se levantan son 2 (puede haber más de uno)
      // Pero como solo nos interesan los toques con 2 dedos, usamos un contador simple
      isTouching = false;
      const elapsed = Date.now() - touchStartTime;

      // Incrementamos el contador de toques completos con 2 dedos
      twoFingerTouchCount++;
      console.log(`[QTI] Toque con 2 dedos completado (#${twoFingerTouchCount}) en ${elapsed}ms`);

      // Reiniciamos el timer para que el contador vuelva a 0 si pasa el tiempo
      clearTimeout(twoFingerTimer);
      twoFingerTimer = setTimeout(() => {
        console.log('[QTI] Reiniciado contador por timeout (más de 500ms sin nuevo toque)');
        twoFingerTouchCount = 0;
      }, DOUBLE_TAP_DELAY);

      // Si llegamos a 2 toques consecutivos, activamos el input
      if (twoFingerTouchCount >= 2) {
        console.log('[QTI] ✅ Doble toque con 2 dedos detectado (2 toques consecutivos)');
        // Evitamos múltiples activaciones
        twoFingerTouchCount = 0;
        clearTimeout(twoFingerTimer);
        twoFingerTimer = null;
        // Ejecutar en el siguiente ciclo para evitar conflictos con el evento actual
        setTimeout(() => {
          if (floatInputVisible) hideFloatInput(); else showFloatInput();
        }, 50);
      }
    }, { passive: true });

    // Si el toque se cancela (por ejemplo, se mueven los dedos), reiniciamos
    document.addEventListener('touchcancel', (e) => {
      if (isTouching) {
        console.log('[QTI] Toque cancelado');
        isTouching = false;
        twoFingerTouchCount = 0;
        clearTimeout(twoFingerTimer);
        twoFingerTimer = null;
      }
    }, { passive: true });
  }

  // ------------------------------------------------------------------
  // COMPORTAMIENTO DEL INPUT
  // ------------------------------------------------------------------
  floatInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const text = floatInput.value.trim();
      if (!text) return;
      const targetLang = langSelector.value;
      localStorage.setItem(STORAGE_KEY, targetLang);
      currentTargetLang = targetLang;

      try {
        const { translated, detectedLang } = await translateText(text, targetLang);
        lastOriginalText = text;
        lastTranslatedText = translated;
        lastDetectedLang = normalizeLang(detectedLang);

        renderToast(
          translated,
          `${detectedLang} → ${targetLang} · 🔊 toca para escuchar`,
          { copyText: translated }
        );
      } catch (err) {
        renderToast('Error al traducir', 'Revisa conexión.', { copyText: null });
      }
    }
  });

  langSelector.addEventListener('change', () => {
    const newLang = langSelector.value;
    localStorage.setItem(STORAGE_KEY, newLang);
    currentTargetLang = newLang;
  });

  // ------------------------------------------------------------------
  // TRADUCCIÓN
  // ------------------------------------------------------------------
  function translateText(text, targetLang = currentTargetLang) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
      targetLang + '&dt=t&q=' + encodeURIComponent(text);
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            const translated = data[0].map(seg => seg[0]).join('');
            const detectedLang = data[2] || 'en';
            resolve({ translated, detectedLang });
          } catch (e) {
            reject(e);
          }
        },
        onerror: reject,
        ontimeout: reject,
        timeout: 8000,
      });
    });
  }

  function normalizeLang(code) {
    return (code || 'en').split('-')[0].toLowerCase();
  }

  // ------------------------------------------------------------------
  // PRONUNCIACIÓN (del texto traducido en el idioma destino)
  // ------------------------------------------------------------------
  const LANG_SUBDOMAIN = {
    en: 'en', es: 'es', fr: 'fr', de: 'de', it: 'it', pt: 'pt',
    ru: 'ru', zh: 'zh', ja: 'ja', ar: 'ar', nl: 'nl', pl: 'pl',
    sv: 'sv', ko: 'ko', tr: 'tr', vi: 'vi', id: 'id', ms: 'ms',
  };

  function fetchWiktionaryParse(word, lang) {
    const sub = LANG_SUBDOMAIN[lang] || lang;
    const url = `https://${sub}.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=text&format=json&origin=*`;
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            const html = data.parse?.text?.['*'] || '';
            const audioRegex = /<source[^>]+src="([^"]+\.(?:ogg|mp3|wav))"/i;
            const match = html.match(audioRegex);
            if (match) {
              let audioUrl = match[1];
              if (audioUrl.startsWith('//')) audioUrl = 'https:' + audioUrl;
              else if (audioUrl.startsWith('/')) audioUrl = 'https://' + sub + '.wiktionary.org' + audioUrl;
              resolve(audioUrl);
            } else {
              const hrefRegex = /href="([^"]+\.(?:ogg|mp3|wav))"/i;
              const hrefMatch = html.match(hrefRegex);
              if (hrefMatch) {
                let audioUrl = hrefMatch[1];
                if (audioUrl.startsWith('//')) audioUrl = 'https:' + audioUrl;
                else if (audioUrl.startsWith('/')) audioUrl = 'https://' + sub + '.wiktionary.org' + audioUrl;
                resolve(audioUrl);
              } else {
                resolve(null);
              }
            }
          } catch (e) {
            resolve(null);
          }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
        timeout: 5000,
      });
    });
  }

  function fetchWiktionaryRaw(word, lang) {
    const sub = LANG_SUBDOMAIN[lang] || lang;
    const url = `https://${sub}.wiktionary.org/w/index.php?title=${encodeURIComponent(word)}&action=raw`;
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        onload: (res) => {
          try {
            const wikitext = res.responseText;
            const audioTemplate = /{{(?:audio|pronunciaci[óo]n|pronunciation)\s*\|([^}|]+)(?:\|[^}]*)?}}/i;
            const match = wikitext.match(audioTemplate);
            if (match) {
              let fileName = match[1].trim();
              resolve(fetchCommonsFileUrl(fileName));
              return;
            }
            const mediaLink = /\[\[Media:([^\]]+)\]\]/i;
            const mediaMatch = wikitext.match(mediaLink);
            if (mediaMatch) {
              let fileName = mediaMatch[1].trim();
              resolve(fetchCommonsFileUrl(fileName));
              return;
            }
            resolve(null);
          } catch (e) {
            resolve(null);
          }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
        timeout: 5000,
      });
    });
  }

  function fetchCommonsFileUrl(fileName) {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        onload: (res) => {
          try {
            const data = JSON.parse(res.responseText);
            const pages = data.query?.pages;
            for (const pageId in pages) {
              const info = pages[pageId]?.imageinfo?.[0];
              if (info?.url) {
                resolve(info.url);
                return;
              }
            }
            resolve(null);
          } catch (e) {
            resolve(null);
          }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
        timeout: 5000,
      });
    });
  }

  async function getWiktionaryAudio(word, lang) {
    if (!LANG_SUBDOMAIN[lang]) return null;
    const cacheKey = `${lang}:${word}`;
    if (audioCache.has(cacheKey)) return audioCache.get(cacheKey);

    let url = await fetchWiktionaryParse(word, lang);
    if (!url) url = await fetchWiktionaryRaw(word, lang);
    audioCache.set(cacheKey, url);
    return url ? { url, source: 'Wiktionary' } : null;
  }

  function playGoogleTTS(word, lang) {
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' +
      encodeURIComponent(word) + '&tl=' + lang + '&client=tw-ob';
    const audio = new Audio(url);
    audio.play().catch(() => {});
  }

  async function pronounce(text, lang) {
    renderToast(lastTranslatedText, 'Buscando pronunciación…', { loading: true, copyText: null });

    let result = null;
    try {
      result = await getWiktionaryAudio(text, lang);
    } catch (e) {}

    if (result) {
      try {
        const audio = new Audio(result.url);
        await audio.play();
        renderToast(
          lastTranslatedText,
          `${lang} (${result.source}) · toca para repetir`,
          { copyText: lastTranslatedText }
        );
        return;
      } catch (e) {}
    }

    playGoogleTTS(text, lang);
    renderToast(
      lastTranslatedText,
      `${lang} (Google TTS) · toca para repetir`,
      { copyText: lastTranslatedText }
    );
  }

  // ------------------------------------------------------------------
  // PRONUNCIACIÓN AL TOCAR EL TOAST
  // ------------------------------------------------------------------
  toast.addEventListener('click', (e) => {
    if (e.target.closest('.qti-copy-btn')) return;
    if (!lastTranslatedText || !currentTargetLang) return;
    pronounce(lastTranslatedText, currentTargetLang);
  });

  // ------------------------------------------------------------------
  // INICIALIZACIÓN
  // ------------------------------------------------------------------
  langSelector.value = currentTargetLang;
  console.log('✅ Quick Translate Input cargado. Doble clic (PC) o DOS toques consecutivos con 2 dedos (móvil) para abrir el input.');
})();
