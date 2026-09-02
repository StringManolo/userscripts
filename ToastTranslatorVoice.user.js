// ==UserScript==
// @name         ToastTranslatorVoice
// @namespace    https://github.com/StringManolo/userscripts
// @version      1.0
// @description  Traduce al español el texto seleccionado. Toca el toast para escuchar la pronunciación (nativa si está en Wiktionary, o sintética de Google).
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
  // Configuración
  // ------------------------------------------------------------------
  const TARGET_LANG = 'es';
  const SELECTION_DEBOUNCE = 400;
  const TOAST_DURATION = 6000;
  const MAX_TEXT_LENGTH = 300;

  let selectionTimer = null;
  let lastSelectedText = '';
  let currentRequestId = 0;
  let lastOriginalText = '';
  let lastTranslatedText = '';
  let lastDetectedLang = 'en';
  let hideTimer = null;
  let audioCache = new Map();

  // ------------------------------------------------------------------
  // Estilos (toast)
  // ------------------------------------------------------------------
  GM_addStyle(`
    #qt-toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%) translateY(16px);
      max-width: 88vw;
      background: rgba(20, 20, 22, 0.95);
      color: #fff;
      padding: 12px 16px;
      border-radius: 14px;
      font-size: 16px;
      line-height: 1.4;
      box-shadow: 0 6px 20px rgba(0,0,0,0.35);
      z-index: 2147483647;
      opacity: 0;
      pointer-events: none;
      transition: opacity .18s ease, transform .18s ease;
      font-family: -apple-system, Roboto, Arial, sans-serif;
      cursor: pointer;
    }
    #qt-toast.qt-visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
      pointer-events: auto;
    }
    #qt-toast b { font-weight: 600; }
    #qt-toast .qt-hint {
      display: block;
      margin-top: 4px;
      font-size: 11px;
      opacity: .65;
    }
    #qt-toast.qt-loading .qt-hint {
      opacity: .9;
    }
  `);

  // ------------------------------------------------------------------
  // Toast UI
  // ------------------------------------------------------------------
  const toast = document.createElement('div');
  toast.id = 'qt-toast';
  document.documentElement.appendChild(toast);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function renderToast(main, hint, { loading = false } = {}) {
    toast.innerHTML = `<b>${escapeHtml(main)}</b><span class="qt-hint">${hint}</span>`;
    toast.classList.toggle('qt-loading', loading);
    toast.classList.add('qt-visible');
    clearTimeout(hideTimer);
    if (!loading) {
      hideTimer = setTimeout(() => toast.classList.remove('qt-visible'), TOAST_DURATION);
    }
  }

  // ------------------------------------------------------------------
  // Traducción (Google Translate)
  // ------------------------------------------------------------------
  function translateText(text) {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' +
      TARGET_LANG + '&dt=t&q=' + encodeURIComponent(text);
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
  // WIKTIONARY (fuente nativa)
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

  // ------------------------------------------------------------------
  // Pronunciación
  // ------------------------------------------------------------------
  function playGoogleTTS(word, lang) {
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' +
      encodeURIComponent(word) + '&tl=' + lang + '&client=tw-ob';
    const audio = new Audio(url);
    audio.play().catch(() => {});
  }

  async function pronounce(word, lang) {
    renderToast(lastTranslatedText, 'Buscando pronunciación…', { loading: true });

    let result = null;
    try {
      result = await getWiktionaryAudio(word, lang);
    } catch (e) {
      // Silently fallback
    }

    if (result) {
      try {
        const audio = new Audio(result.url);
        await audio.play();
        renderToast(
          lastTranslatedText,
          `${lang} → ${TARGET_LANG} · ${result.source} (nativo) · toca para repetir`
        );
        return;
      } catch (e) {
        // Fallback to TTS
      }
    }

    playGoogleTTS(word, lang);
    renderToast(
      lastTranslatedText,
      `${lang} → ${TARGET_LANG} · Google TTS (sintético) · toca para repetir`
    );
  }

  // ------------------------------------------------------------------
  // Flujo principal
  // ------------------------------------------------------------------
  async function handleText(text) {
    text = (text || '').trim();
    if (!text || text.length > MAX_TEXT_LENGTH) return;

    const reqId = ++currentRequestId;
    renderToast(text, 'Traduciendo…', { loading: true });

    try {
      const { translated, detectedLang } = await translateText(text);
      if (reqId !== currentRequestId) return;
      lastOriginalText = text;
      lastTranslatedText = translated;
      lastDetectedLang = normalizeLang(detectedLang);
      renderToast(translated, `${detectedLang} → ${TARGET_LANG} · toca para escuchar`);
    } catch (e) {
      if (reqId !== currentRequestId) return;
      renderToast(text, 'Error de traducción.');
    }
  }

  // ------------------------------------------------------------------
  // Eventos
  // ------------------------------------------------------------------
  document.addEventListener('selectionchange', () => {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      if (toast.contains(sel.anchorNode)) return;

      const text = sel.toString().trim();
      if (!text || text === lastSelectedText) return;
      lastSelectedText = text;
      handleText(text);
    }, SELECTION_DEBOUNCE);
  });

  toast.addEventListener('click', () => {
    if (!lastOriginalText) return;
    pronounce(lastOriginalText, lastDetectedLang);
  });
})();
