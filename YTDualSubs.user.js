// ==UserScript==
// @name         Dual Subs - YouTube Dual Subtitles
// @namespace    https://github.com/StringManolo/userscripts
// @version      1.1
// @description  Muestra subtítulos duales en YouTube: idioma original y traducción.
// @author       StringManolo
// @license      GPL-3.0-or-later
// @homepageURL  https://github.com/StringManolo/userscripts
// @supportURL   https://github.com/StringManolo/userscripts/issues
// @match        https://*.youtube.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ------------------------------------------------------------------
    // Configuración
    // ------------------------------------------------------------------
    const ALL_PRIMARY_LANGS = [
        'ru', 'zh', 'de', 'it', 'pt', 'fr', 'ar', 'ja', 'ko', 'pl', 'nl', 'tr',
        'sv', 'fi', 'cs', 'el', 'hu', 'ro', 'bg', 'hr', 'sk', 'sl', 'et', 'lv',
        'lt', 'th', 'vi', 'id', 'ms', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'kn',
        'ml', 'pa', 'ur', 'fa', 'he', 'es', 'en', 'zh-CN', 'zh-TW'
    ];
    const ALL_SECONDARY_LANGS = [
        'es', 'en', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi',
        'tr', 'pl', 'nl', 'sv', 'fi', 'cs', 'el', 'hu', 'ro', 'bg', 'hr', 'sk',
        'sl', 'et', 'lv', 'lt', 'th', 'vi', 'id', 'ms', 'bn', 'ta', 'te', 'mr',
        'gu', 'kn', 'ml', 'pa', 'ur', 'fa', 'he'
    ];

    const config = {
        primaryLangs: ['ru', 'zh', 'de', 'it', 'pt', 'fr', 'ar'],
        secondaryLang: 'es'
    };

    // ------------------------------------------------------------------
    // Estado global
    // ------------------------------------------------------------------
    let panelVisible = false;
    let panel = null;
    let btn = null;
    let subtitleContainer = null;
    let primaryDiv = null;
    let secondaryDiv = null;
    let currentVideo = null;
    let currentPrimaryCues = [];
    let currentSecondaryCues = [];
    let lastPrimaryIndex = -1;
    let lastSecondaryIndex = -1;
    let isProcessing = false;
    let checkPlayInterval = null;
    let firstPotUrl = null;
    let isInterceptionActive = false;

    // ------------------------------------------------------------------
    // Intercepción de red para capturar el parámetro "pot"
    // ------------------------------------------------------------------
    function startInterception() {
        if (isInterceptionActive) return;
        isInterceptionActive = true;

        const originalFetch = window.fetch;
        window.fetch = function (url, options) {
            const urlStr = typeof url === 'string' ? url : (url && url.url) || '';
            if (urlStr.includes('timedtext') && urlStr.includes('&pot=') && !firstPotUrl) {
                firstPotUrl = urlStr;
            }
            return originalFetch.apply(this, arguments);
        };

        const originalXHROpen = XMLHttpRequest.prototype.open;
        const originalXHRSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
            this._url = url;
            return originalXHROpen.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function (body) {
            if (this._url && this._url.includes('timedtext') && this._url.includes('&pot=') && !firstPotUrl) {
                firstPotUrl = this._url;
            }
            return originalXHRSend.apply(this, arguments);
        };
    }

    // ------------------------------------------------------------------
    // Utilidades DOM
    // ------------------------------------------------------------------
    function getVideoElement() {
        let video = document.querySelector('video');
        if (video) return video;

        const player = document.querySelector('#movie_player');
        if (player && player.shadowRoot) {
            video = player.shadowRoot.querySelector('video');
            if (video) return video;
        }
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
            if (el.shadowRoot) {
                video = el.shadowRoot.querySelector('video');
                if (video) return video;
            }
        }
        return null;
    }

    function getSubtitleButton() {
        return document.querySelector('.ytmClosedCaptioningButtonButton') ||
               document.querySelector('.ytp-subtitles-button');
    }

    function forceSubtitleToggle(callback) {
        const btnSub = getSubtitleButton();
        if (!btnSub) {
            if (callback) callback();
            return;
        }
        if (btnSub.getAttribute('aria-pressed') !== 'true') btnSub.click();
        setTimeout(() => {
            btnSub.click(); // apagar
            setTimeout(() => {
                btnSub.click(); // encender
                if (callback) callback();
            }, 300);
        }, 300);
    }

    // ------------------------------------------------------------------
    // Parseo de VTT
    // ------------------------------------------------------------------
    function parseTimestamp(ts) {
        const parts = ts.split(':');
        let hours = 0, minutes = 0, seconds = 0;
        if (parts.length === 3) {
            hours = parseFloat(parts[0]) || 0;
            minutes = parseFloat(parts[1]) || 0;
            seconds = parseFloat(parts[2]) || 0;
        } else if (parts.length === 2) {
            minutes = parseFloat(parts[0]) || 0;
            seconds = parseFloat(parts[1]) || 0;
        } else {
            seconds = parseFloat(parts[0]) || 0;
        }
        return hours * 3600 + minutes * 60 + seconds;
    }

    function parseVTT(vttText) {
        const lines = vttText.split(/\r?\n/);
        const cues = [];
        let i = 0;
        while (i < lines.length && lines[i].trim() === '') i++;
        if (lines[i] && lines[i].startsWith('WEBVTT')) i++;

        while (i < lines.length) {
            while (i < lines.length && lines[i].trim() === '') i++;
            if (i >= lines.length) break;
            const timeLine = lines[i];
            if (timeLine.includes('-->')) {
                const times = timeLine.split('-->');
                const startStr = times[0].trim().split(' ')[0];
                const endStr = times[1].trim().split(' ')[0];
                const start = parseTimestamp(startStr);
                const end = parseTimestamp(endStr);
                i++;
                const textLines = [];
                while (i < lines.length && lines[i].trim() !== '') {
                    textLines.push(lines[i]);
                    i++;
                }
                let text = textLines.join('\n');
                text = text.replace(/<\d{2}:\d{2}:\d{2}\.\d+>/g, '')
                           .replace(/<[^>]+>/g, '')
                           .replace(/[ \t]+/g, ' ')
                           .trim();
                cues.push({ start, end, text });
            } else {
                i++;
            }
        }
        return cues;
    }

    // ------------------------------------------------------------------
    // Descarga de subtítulos
    // ------------------------------------------------------------------
    function downloadSubtitle(url, callback, retryCount = 0) {
        fetch(url, { credentials: 'same-origin' })
            .then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            })
            .then(text => {
                if (text && text.includes('WEBVTT')) callback(text);
                else callback(null);
            })
            .catch(error => {
                const statusMatch = error.message.match(/HTTP (\d+)/);
                if (statusMatch) {
                    const code = statusMatch[1];
                    if ((code === '429' || code === '503') && retryCount < 3) {
                        const delay = 3000 * Math.pow(2, retryCount);
                        setTimeout(() => downloadSubtitle(url, callback, retryCount + 1), delay);
                        return;
                    }
                }
                callback(null);
            });
    }

    // ------------------------------------------------------------------
    // Overlay de subtítulos
    // ------------------------------------------------------------------
    function createSubtitleOverlay() {
        if (subtitleContainer) return;

        const container = document.createElement('div');
        container.id = 'dual-subs-overlay-container';
        container.style.position = 'fixed';
        container.style.bottom = '10%';
        container.style.left = '5%';
        container.style.width = '90%';
        container.style.textAlign = 'center';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '1000';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'flex-end';
        container.style.fontSize = '1.2em';
        container.style.fontWeight = 'bold';
        container.style.textShadow = '2px 2px 4px black';

        primaryDiv = document.createElement('div');
        primaryDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
        primaryDiv.style.padding = '4px 8px';
        primaryDiv.style.margin = '2px 0';
        primaryDiv.style.borderRadius = '4px';
        primaryDiv.style.color = 'white';
        primaryDiv.style.display = 'none';

        secondaryDiv = document.createElement('div');
        secondaryDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
        secondaryDiv.style.padding = '4px 8px';
        secondaryDiv.style.margin = '2px 0';
        secondaryDiv.style.borderRadius = '4px';
        secondaryDiv.style.color = '#ffff00';
        secondaryDiv.style.display = 'none';

        container.appendChild(primaryDiv);
        container.appendChild(secondaryDiv);
        document.body.appendChild(container);
        subtitleContainer = container;
    }

    function positionOverlay() {
        const player = document.querySelector('#movie_player');
        if (!player || !subtitleContainer) return;
        const rect = player.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        subtitleContainer.style.left = (rect.left + rect.width * 0.05) + 'px';
        subtitleContainer.style.top = (rect.top + rect.height * 0.75) + 'px';
        subtitleContainer.style.width = (rect.width * 0.9) + 'px';
        subtitleContainer.style.bottom = 'auto';
        subtitleContainer.style.right = 'auto';
    }

    function updateSubtitles() {
        if (!currentVideo || !primaryDiv || !secondaryDiv) return;
        const time = currentVideo.currentTime;
        const idx = findActiveCue(currentPrimaryCues, time);
        if (idx !== lastPrimaryIndex) {
            lastPrimaryIndex = idx;
            if (idx >= 0) {
                primaryDiv.textContent = currentPrimaryCues[idx].text;
                primaryDiv.style.display = 'block';
            } else {
                primaryDiv.style.display = 'none';
            }
        }
        const idx2 = findActiveCue(currentSecondaryCues, time);
        if (idx2 !== lastSecondaryIndex) {
            lastSecondaryIndex = idx2;
            if (idx2 >= 0) {
                secondaryDiv.textContent = currentSecondaryCues[idx2].text;
                secondaryDiv.style.display = 'block';
            } else {
                secondaryDiv.style.display = 'none';
            }
        }
    }

    function findActiveCue(cues, time) {
        if (!cues || cues.length === 0) return -1;
        for (let i = 0; i < cues.length; i++) {
            if (time >= cues[i].start && time <= cues[i].end) return i;
        }
        return -1;
    }

    function removeOverlay() {
        if (subtitleContainer) {
            subtitleContainer.remove();
            subtitleContainer = null;
            primaryDiv = null;
            secondaryDiv = null;
        }
        currentPrimaryCues = [];
        currentSecondaryCues = [];
        lastPrimaryIndex = -1;
        lastSecondaryIndex = -1;
        if (currentVideo) {
            currentVideo.removeEventListener('timeupdate', updateSubtitles);
            currentVideo = null;
        }
        firstPotUrl = null;
        isProcessing = false;
        if (checkPlayInterval) {
            clearTimeout(checkPlayInterval);
            checkPlayInterval = null;
        }
    }

    function resetAndReprocess() {
        removeOverlay();
        forceSubtitleToggle(() => processVideo(true));
    }

    // ------------------------------------------------------------------
    // Procesamiento principal
    // ------------------------------------------------------------------
    function processVideo(forceToggle) {
        if (isProcessing) return;
        isProcessing = true;
        startInterception();
        waitForPlayer(player => {
            if (!player) {
                isProcessing = false;
                return;
            }
            const tracks = getCaptionTracks(player);
            if (!tracks || tracks.length === 0) {
                isProcessing = false;
                return;
            }
            let selectedLang = null;
            for (const primary of config.primaryLangs) {
                for (const track of tracks) {
                    if (track.languageCode.includes(primary)) {
                        selectedLang = track.languageCode;
                        break;
                    }
                }
                if (selectedLang) break;
            }
            if (!selectedLang) {
                isProcessing = false;
                return;
            }

            const waitLoop = (attempts = 0) => {
                if (!firstPotUrl) {
                    attempts++;
                    if (attempts > 120) { // 60 segundos
                        isProcessing = false;
                        return;
                    }
                    checkPlayInterval = setTimeout(() => waitLoop(attempts), 500);
                } else {
                    startDownload(selectedLang);
                }
            };
            waitLoop();
        });
    }

    function startDownload(selectedLang) {
        if (!firstPotUrl) {
            isProcessing = false;
            return;
        }
        const potUrl = new URL(firstPotUrl);
        potUrl.searchParams.set('fmt', 'vtt');
        potUrl.searchParams.set('lang', selectedLang);
        potUrl.searchParams.delete('tlang');
        const primaryUrl = potUrl.toString();

        downloadSubtitle(primaryUrl, primaryVtt => {
            if (!primaryVtt) {
                isProcessing = false;
                return;
            }
            const secondaryUrl = new URL(firstPotUrl);
            secondaryUrl.searchParams.set('fmt', 'vtt');
            secondaryUrl.searchParams.set('lang', selectedLang);
            secondaryUrl.searchParams.set('tlang', config.secondaryLang);

            downloadSubtitle(secondaryUrl.toString(), secondaryVtt => {
                if (!secondaryVtt) {
                    isProcessing = false;
                    return;
                }
                currentPrimaryCues = parseVTT(primaryVtt);
                currentSecondaryCues = parseVTT(secondaryVtt);
                if (currentPrimaryCues.length === 0 || currentSecondaryCues.length === 0) {
                    isProcessing = false;
                    return;
                }
                createSubtitleOverlay();
                const video = getVideoElement();
                if (!video) {
                    isProcessing = false;
                    return;
                }
                currentVideo = video;
                video.addEventListener('timeupdate', updateSubtitles);
                window.addEventListener('resize', positionOverlay);
                positionOverlay();

                // Desactivar subtítulos nativos
                const btnSub = getSubtitleButton();
                if (btnSub && btnSub.getAttribute('aria-pressed') === 'true') {
                    btnSub.click();
                }
                isProcessing = false;
            });
        });
    }

    function waitForPlayer(callback) {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            const player = document.querySelector('#movie_player');
            if (player) {
                clearInterval(interval);
                callback(player);
            } else if (attempts > 100) {
                clearInterval(interval);
                callback(null);
            }
        }, 100);
    }

    function getCaptionTracks(player) {
        try {
            if (typeof player.getPlayerResponse !== 'function') return null;
            const response = player.getPlayerResponse();
            if (!response) return null;
            const captions = response.captions && response.captions.playerCaptionsTracklistRenderer;
            if (!captions) return null;
            return captions.captionTracks;
        } catch (e) {
            return null;
        }
    }

    function getTrackName(track) {
        if (typeof track.name === 'string') return track.name;
        if (track.name && track.name.simpleText) return track.name.simpleText;
        if (track.name && track.name.runs && track.name.runs[0]) return track.name.runs[0].text;
        return 'desconocido';
    }

    // ------------------------------------------------------------------
    // Navegación SPA
    // ------------------------------------------------------------------
    let lastUrl = location.href;
    setInterval(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            removeOverlay();
            setTimeout(() => processVideo(false), 1000);
        }
    }, 1000);

    // ------------------------------------------------------------------
    // UI de configuración (simple y robusta)
    // ------------------------------------------------------------------
    function createUI() {
        // Botón flotante con texto
        btn = document.createElement('button');
        btn.textContent = '⚙ Dual Subs';
        btn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999998;
            padding: 8px 12px;
            background: #1f2937;
            color: #e5e7eb;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            font-size: 14px;
            font-family: Arial, sans-serif;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        document.body.appendChild(btn);

        // Panel simple
        panel = document.createElement('div');
        panel.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            width: 250px;
            background: #ffffff;
            color: #1f2937;
            font-family: Arial, sans-serif;
            font-size: 14px;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.25);
            z-index: 999999;
            padding: 16px;
            display: none;
        `;
        document.body.appendChild(panel);

        // Título
        const title = document.createElement('div');
        title.textContent = 'Configuración Dual Subs';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '12px';
        panel.appendChild(title);

        // Selector de idioma secundario
        const secLabel = document.createElement('label');
        secLabel.textContent = 'Traducir a:';
        secLabel.style.display = 'block';
        secLabel.style.marginBottom = '4px';
        panel.appendChild(secLabel);

        const secSelect = document.createElement('select');
        secSelect.style.cssText = `
            width: 100%;
            padding: 6px;
            border: 1px solid #ccc;
            border-radius: 6px;
            margin-bottom: 12px;
        `;
        for (const lang of ALL_SECONDARY_LANGS) {
            const opt = document.createElement('option');
            opt.value = lang;
            opt.textContent = lang;
            if (lang === config.secondaryLang) opt.selected = true;
            secSelect.appendChild(opt);
        }
        secSelect.onchange = () => {
            config.secondaryLang = secSelect.value;
            resetAndReprocess();
        };
        panel.appendChild(secSelect);

        // Lista de idiomas originales (colapsable)
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Idiomas originales';
        summary.style.cursor = 'pointer';
        summary.style.marginBottom = '8px';
        details.appendChild(summary);

        const langsContainer = document.createElement('div');
        langsContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4px;
            max-height: 150px;
            overflow-y: auto;
        `;
        for (const lang of ALL_PRIMARY_LANGS) {
            const label = document.createElement('label');
            label.style.cssText = `
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                cursor: pointer;
            `;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = lang;
            checkbox.checked = config.primaryLangs.includes(lang);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (!config.primaryLangs.includes(lang)) config.primaryLangs.push(lang);
                } else {
                    const idx = config.primaryLangs.indexOf(lang);
                    if (idx !== -1) config.primaryLangs.splice(idx, 1);
                }
                resetAndReprocess();
            });
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(lang));
            langsContainer.appendChild(label);
        }
        details.appendChild(langsContainer);
        panel.appendChild(details);

        // Botón para cerrar
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Cerrar';
        closeBtn.style.cssText = `
            margin-top: 12px;
            padding: 6px 12px;
            background: #e5e7eb;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            float: right;
        `;
        closeBtn.onclick = () => {
            panel.style.display = 'none';
            panelVisible = false;
        };
        panel.appendChild(closeBtn);

        // Mostrar/ocultar panel
        btn.onclick = () => {
            if (panelVisible) {
                panel.style.display = 'none';
                panelVisible = false;
            } else {
                panel.style.display = 'block';
                panelVisible = true;
            }
        };
    }

    // ------------------------------------------------------------------
    // Inicialización
    // ------------------------------------------------------------------
    function waitForBody(callback) {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            if (document.body) {
                clearInterval(interval);
                callback();
            } else if (attempts > 100) {
                clearInterval(interval);
            }
        }, 100);
    }

    waitForBody(() => {
        createUI();
        processVideo(false);
    });
})();
