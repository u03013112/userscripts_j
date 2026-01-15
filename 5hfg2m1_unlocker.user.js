// ==UserScript==
// @name         5hfg2m1 Video Unlocker
// @namespace    https://github.com/video_grabber_91
// @version      1.1
// @description  绕过 5hfg2m1.com 视频试看限制，解锁完整视频播放
// @author       video_grabber_91
// @match        *://*.5hfg2m1.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // 仅在视频播放页执行
    if (!location.href.includes('/play/')) return;

    console.log('[5hfg2m1 Unlocker] 脚本已注入');

    // HLS.js CDN 地址
    const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@latest';

    // 加载 HLS.js 库
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

    // 获取完整版 M3U8 URL
    function getFullM3u8Url() {
        const resources = performance.getEntriesByType('resource');
        const trialM3u8 = resources.find(r => r.name.includes('.m3u8'));
        if (!trialM3u8) return null;

        // 将 _0001.m3u8 替换为 .m3u8
        return trialM3u8.name.replace('_0001.m3u8', '.m3u8');
    }

    // 加载完整版视频
    async function loadFullVideo() {
        const video = document.querySelector('video');
        if (!video) {
            console.log('[5hfg2m1 Unlocker] 未找到 video 元素');
            return false;
        }

        const fullM3u8Url = getFullM3u8Url();
        if (!fullM3u8Url) {
            console.log('[5hfg2m1 Unlocker] 未找到 M3U8 URL');
            return false;
        }

        console.log('[5hfg2m1 Unlocker] 完整版 M3U8:', fullM3u8Url);

        try {
            await loadHlsJs();

            if (!Hls.isSupported()) {
                console.log('[5hfg2m1 Unlocker] 浏览器不支持 HLS.js');
                return false;
            }

            const hls = new Hls();
            hls.loadSource(fullM3u8Url);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('[5hfg2m1 Unlocker] 完整视频已加载，时长:', (video.duration / 60).toFixed(2), '分钟');
                video.play();
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.log('[5hfg2m1 Unlocker] HLS 错误:', data.type, data.details);
            });

            return true;
        } catch (e) {
            console.log('[5hfg2m1 Unlocker] 加载失败:', e);
            return false;
        }
    }

    // 隐藏试看结束弹窗（精确定位，不影响视频播放器）
    function hideTipBox() {
        // 方法1：隐藏 .buy-payType-list 的父容器
        const videoPalyer = document.querySelector('.video-palyer');
        if (videoPalyer) {
            [...videoPalyer.children].forEach(child => {
                if (child.querySelector('.buy-payType-list')) {
                    child.style.display = 'none';
                    console.log('[5hfg2m1 Unlocker] 付费弹窗已隐藏');
                }
            });
        }

        // 方法2：点击「跳过预览」按钮
        const skipPreviewBtn = [...document.querySelectorAll('*')].find(el => 
            el.innerText?.trim() === '跳过预览' && el.offsetWidth > 0
        );
        if (skipPreviewBtn) {
            skipPreviewBtn.click();
            console.log('[5hfg2m1 Unlocker] 点击跳过预览');
        }
    }

    // 主逻辑
    let unlockAttempted = false;

    const observer = new MutationObserver(() => {
        // 检测到试看结束弹窗时触发解锁
        const hasTipBox = [...document.querySelectorAll('*')].some(el => 
            el.innerText?.includes('试看结束') && el.offsetWidth > 0
        );

        if (hasTipBox && !unlockAttempted) {
            unlockAttempted = true;
            console.log('[5hfg2m1 Unlocker] 检测到试看结束，开始解锁...');

            loadFullVideo().then(success => {
                if (success) {
                    hideTipBox();
                    console.log('[5hfg2m1 Unlocker] 解锁成功！');
                }
            });
        }

        // 持续尝试隐藏弹窗和点击跳过预览
        if (unlockAttempted) {
            hideTipBox();
        }
    });

    // 开始监听
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 页面卸载时停止监听
    window.addEventListener('beforeunload', () => {
        observer.disconnect();
    });

    console.log('[5hfg2m1 Unlocker] Observer 已启动，等待试看结束...');
})();
