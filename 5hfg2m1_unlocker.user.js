// ==UserScript==
// @name         5hfg2m1 Video Unlocker
// @namespace    https://github.com/video_grabber_91
// @version      1.2
// @description  Unlock full video on 5hfg2m1.com by replacing m3u8 url
// @author       video_grabber_91
// @match        *://*.5hfg2m1.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    if (!location.href.includes('/play/')) return;

    console.log('[Unlocker] Script started (Polling mode)');

    const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    let hasUnlocked = false;

    // Helper: Load HLS.js
    function loadHlsJs() {
        return new Promise((resolve, reject) => {
            if (typeof Hls !== 'undefined') {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = HLS_CDN;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // Helper: Shorten URL for logging
    function shortUrl(url) {
        try {
            return '...' + url.split('?')[0].slice(-35);
        } catch (e) {
            return url.slice(-20);
        }
    }

    // Helper: Hide trial popup and click skip button
    function handleUI() {
        // 1. Hide popup container
        const tipBox = document.querySelector('.buy-payType-list');
        if (tipBox) {
            // Find the container that blocks the video
            const container = tipBox.closest('.video-palyer > div') || tipBox.parentElement;
            if (container) {
                container.style.display = 'none';
                console.log('[Unlocker] Hidden popup container');
            }
        }

        // 2. Click "Skip Preview" button
        const skipBtn = [...document.querySelectorAll('*')].find(el => 
            el.innerText && el.innerText.includes('跳过预览') && el.offsetWidth > 0
        );
        if (skipBtn) {
            skipBtn.click();
            console.log('[Unlocker] Clicked skip button');
        }
    }

    // Main Unlock Function
    async function doUnlock(video) {
        // 1. Get the latest M3U8 URL
        const resources = performance.getEntriesByType('resource');
        const m3u8s = resources.filter(r => r.name.includes('.m3u8'));
        
        if (m3u8s.length === 0) {
            console.log('[Unlocker] No M3U8 found, retrying...');
            hasUnlocked = false; // Reset lock to retry
            return;
        }

        // Use the last one (newest)
        const lastM3u8 = m3u8s[m3u8s.length - 1];
        console.log(`[Unlocker] Selected M3U8: ${shortUrl(lastM3u8.name)}`);

        // 2. Construct full URL (remove _0001)
        const fullUrl = lastM3u8.name.replace('_0001.m3u8', '.m3u8');
        
        // 3. Load HLS and play
        try {
            await loadHlsJs();

            if (!Hls.isSupported()) {
                console.log('[Unlocker] Browser does not support HLS.js');
                return;
            }

            const hls = new Hls();
            hls.loadSource(fullUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log(`[Unlocker] Full video loaded. Duration: ${(video.duration / 60).toFixed(2)} min`);
                handleUI();
                video.play();
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    console.log('[Unlocker] HLS Fatal Error:', data.type, data.details);
                }
            });

        } catch (e) {
            console.log('[Unlocker] Error:', e);
            hasUnlocked = false;
        }
    }

    // Polling Loop (Every 1s)
    setInterval(() => {
        // If already unlocked, just ensure UI is handled (in case popup reappears)
        if (hasUnlocked) {
            handleUI();
            return;
        }

        const video = document.querySelector('video');
        
        // Check if video exists and metadata is loaded
        if (!video || !video.duration) return;

        // Check if it is a trial video (< 60s)
        // Note: isFinite check is to exclude live streams
        if (video.duration > 60 || !isFinite(video.duration)) {
            return;
        }

        console.log(`[Unlocker] Trial video detected (${video.duration}s), unlocking...`);
        hasUnlocked = true; // Lock immediately to prevent double execution
        doUnlock(video);

    }, 1000);

})();
