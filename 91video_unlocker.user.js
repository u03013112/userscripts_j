// ==UserScript==
// @name         Video Unlocker
// @description  绕过91视频播放限制
// @match        *://*.cloudfront.net/*
// @match        *://k5j7u.com/*
// ==/UserScript==
(function() {
    if (!location.href.includes('movieDetails')) return;
    
    const observer = new MutationObserver(() => {
        const video = document.querySelector('video');
        if (video && video.pause.toString().includes('[native code]')) {
            video.pause = function() { return; };
            console.log('[Unlocker] 播放限制已绕过');
        }
        
        // 自动关闭广告
        const closeBtn = document.querySelector('.timer_close');
        if (closeBtn) closeBtn.click();
        
        // 移除弹窗
        document.querySelectorAll('.van-overlay, .van-popup').forEach(el => el.remove());
    });
