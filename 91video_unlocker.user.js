// ==UserScript==
// @name         Video Unlocker
// @description  绕过视频播放限制
// @match        *://*/*
// ==/UserScript==
(function() {
    'use strict';
    
    if (!location.href.includes('movieDetails')) return;
    
    console.log('[VideoUnlocker] 脚本已注入');
    
    const observer = new MutationObserver(() => {
        const video = document.querySelector('video');
        
        // 覆盖 pause 方法
        if (video && video.pause.toString().includes('[native code]')) {
            video.pause = function() { 
                console.log('[VideoUnlocker] pause 已拦截');
                return; 
            };
            console.log('[VideoUnlocker] 播放限制已绕过');
        }
        
        // 移除付费弹窗
        const tipBox = document.querySelector('.tipBox');
        if (tipBox) {
            tipBox.remove();
            console.log('[VideoUnlocker] 付费弹窗已移除');
        }
        
        // 移除遮罩
        document.querySelectorAll('.van-overlay, .van-popup').forEach(el => el.remove());
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
})();
