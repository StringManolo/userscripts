// ==UserScript==
// @name         GoogleSearchAudioDownloader
// @namespace    https://github.com/StringManolo/userscripts
// @version      1.0
// @description  Downloads the pronunciation audio from Google Search results as MP3 without opening the player.
// @author       StringManolo
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/StringManolo/userscripts
// @supportURL   https://github.com/StringManolo/userscripts/issues
// @match        https://www.google.com/*
// @match        https://www.google.*/*
// @match        https://google.com/*
// @match        https://google.*/*
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM.download
// @grant        GM_download
// @connect      translate.google.com
// @connect      translate.googleapis.com
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let modalOpen = false;
    let lastShownUrl = '';
    let lastShownTime = 0;
    const originalFetch = window.fetch.bind(window);

    function isDirectAudioUrl(url) {
        return /\.(mp3|ogg|wav|m4a|aac)(\?|$)|gstatic\.com\/dictionary\/static\/sounds/i.test(url);
    }

    function isTtsAsyncUrl(url) {
        return /translate_tts|async\/translate_tts/i.test(url);
    }

    function buildDirectTtsUrl(url) {
        try {
            const urlObj = new URL(url, window.location.origin);
            const params = urlObj.searchParams;
            const ttsp = params.get('ttsp') || '';
            const tlMatch = ttsp.match(/tl:([^,]+)/);
            const txtMatch = ttsp.match(/txt:([^,]+)/);
            if (tlMatch && txtMatch) {
                const tl = tlMatch[1];
                const txtEncoded = txtMatch[1];
                const txtDecoded = decodeURIComponent(txtEncoded);
                const directUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(txtDecoded)}`;
                return { url: directUrl, tl, text: txtDecoded };
            }
        } catch (e) {}
        return null;
    }

    function sanitizeFilename(name) {
        return name.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
    }

    function generateFilename(tl, text) {
        return `tts_${tl}_${sanitizeFilename(text)}.mp3`;
    }

    async function downloadFile(url, filename) {
        // Intento con fetch original (puede fallar por CORS)
        try {
            const response = await originalFetch(url, { mode: 'cors' });
            if (!response.ok) throw new Error('HTTP ' + response.status);
            const blob = await response.blob();
            triggerBlobDownload(blob, filename);
            return true;
        } catch (error) {
            console.warn('fetch falló, intentando GM_xmlhttpRequest:', error);
            // Fallback con GM_xmlhttpRequest (sin CORS)
            if (typeof GM_xmlhttpRequest === 'function') {
                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: url,
                        responseType: 'blob',
                        onload: function(res) {
                            if (res.status >= 200 && res.status < 300) {
                                const blob = res.response;
                                triggerBlobDownload(blob, filename);
                                resolve(true);
                            } else {
                                reject(new Error('GM_xhr status ' + res.status));
                            }
                        },
                        onerror: function(err) {
                            reject(err);
                        }
                    });
                });
            }
            throw error;
        }
    }

    function triggerBlobDownload(blob, filename) {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            link.remove();
        }, 1000);
    }

    function showModal(url, filename) {
        const now = Date.now();
        if (url === lastShownUrl && now - lastShownTime < 3000) return;
        lastShownUrl = url;
        lastShownTime = now;

        if (modalOpen) {
            const modal = document.getElementById('audio-download-modal');
            if (modal) {
                modal.querySelector('input.url-input').value = url;
                const btn = modal.querySelector('#download-btn');
                btn.dataset.url = url;
                btn.dataset.filename = filename || 'audio.mp3';
                btn.disabled = false;
                btn.textContent = 'Descargar MP3';
            }
            return;
        }

        modalOpen = true;
        const modal = document.createElement('div');
        modal.id = 'audio-download-modal';
        modal.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            padding: 15px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 100000;
            width: 90%;
            max-width: 400px;
            font-family: system-ui, sans-serif;
            color: #202124;
        `;
        modal.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <span style="font-weight:500;">Audio listo</span>
                <span style="flex:1;"></span>
                <button id="close-modal-btn" style="background:none; border:none; font-size:1.2em; cursor:pointer;">&times;</button>
            </div>
            <input type="text" value="${url}" readonly class="url-input"
                style="width:100%; padding:8px; border:1px solid #dadce0; border-radius:6px; font-size:0.85em; box-sizing:border-box;">
            <div style="margin-top:10px; display:flex; gap:10px;">
                <button id="download-btn"
                    data-url="${url}"
                    data-filename="${filename || 'audio.mp3'}"
                    style="flex:1; text-align:center; padding:8px 12px; background:#1a73e8; color:white; border:none; border-radius:6px; font-weight:500; cursor:pointer;">
                    Descargar MP3
                </button>
                <button id="copy-url-btn"
                    style="padding:8px 12px; background:#f1f3f4; border:none; border-radius:6px; cursor:pointer;">
                    Copiar
                </button>
            </div>
            <div id="download-status" style="margin-top:8px; font-size:0.8em; color:#5f6368;"></div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#close-modal-btn').addEventListener('click', () => {
            modal.remove();
            modalOpen = false;
        });

        modal.querySelector('#copy-url-btn').addEventListener('click', () => {
            const input = modal.querySelector('.url-input');
            input.select();
            input.setSelectionRange(0, 99999);
            document.execCommand('copy');
            const btn = modal.querySelector('#copy-url-btn');
            const original = btn.textContent;
            btn.textContent = '¡Copiada!';
            setTimeout(() => btn.textContent = original, 1500);
        });

        modal.querySelector('#download-btn').addEventListener('click', async function(e) {
            e.preventDefault();
            const url = this.dataset.url;
            const filename = this.dataset.filename || 'audio.mp3';
            const statusDiv = modal.querySelector('#download-status');
            const btn = this;
            btn.disabled = true;
            btn.textContent = 'Descargando...';
            statusDiv.textContent = 'Obteniendo archivo...';

            try {
                await downloadFile(url, filename);
                statusDiv.textContent = 'Descarga completada.';
                btn.textContent = 'Descargar de nuevo';
                btn.disabled = false;
            } catch (err) {
                console.error(err);
                statusDiv.textContent = 'Error: ' + err.message;
                btn.textContent = 'Reintentar';
                btn.disabled = false;
            }
        });
    }

    // Interceptar fetch sin bloquear
    window.fetch = function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '');
        if (isDirectAudioUrl(url)) {
            showModal(url, 'audio.mp3');
        } else if (isTtsAsyncUrl(url)) {
            const result = buildDirectTtsUrl(url);
            if (result) showModal(result.url, generateFilename(result.tl, result.text));
        }
        return originalFetch.apply(this, args);
    };

    // Interceptar XMLHttpRequest
    const origXHROpen = XMLHttpRequest.prototype.open;
    const origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this._audioUrl = isDirectAudioUrl(url) ? url : (isTtsAsyncUrl(url) ? buildDirectTtsUrl(url) : null);
        return origXHROpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(body) {
        if (this._audioUrl) {
            if (typeof this._audioUrl === 'string') {
                showModal(this._audioUrl, 'audio.mp3');
            } else {
                showModal(this._audioUrl.url, generateFilename(this._audioUrl.tl, this._audioUrl.text));
            }
        }
        return origXHRSend.call(this, body);
    };

    // Observar creación de elementos <audio>
    const origCreateElement = document.createElement.bind(document);
    document.createElement = function(tag, options) {
        const el = origCreateElement(tag, options);
        if (tag.toLowerCase() === 'audio') {
            const srcObserver = new MutationObserver(() => {
                const src = el.src || el.getAttribute('src');
                if (src) {
                    if (isDirectAudioUrl(src)) {
                        showModal(src, 'audio.mp3');
                    } else if (isTtsAsyncUrl(src)) {
                        const result = buildDirectTtsUrl(src);
                        if (result) showModal(result.url, generateFilename(result.tl, result.text));
                    }
                }
            });
            srcObserver.observe(el, {attributes: true, attributeFilter: ['src']});
        }
        return el;
    };

    // Interceptar play()
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() {
        const src = this.src || this.currentSrc;
        if (src) {
            if (isDirectAudioUrl(src)) {
                showModal(src, 'audio.mp3');
            } else if (isTtsAsyncUrl(src)) {
                const result = buildDirectTtsUrl(src);
                if (result) showModal(result.url, generateFilename(result.tl, result.text));
            }
        }
        return origPlay.call(this);
    };

})();
