// ==UserScript==
// @name         iOS 纯净视频助手 (无GM依赖版)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  纯原生JS实现，支持悬浮窗、拖拽、嗅探播放
// @author       You
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. 创建宿主容器 (Host)
    const host = document.createElement('div');
    // 设置极高的 z-index 防止被覆盖
    host.style.cssText = "position: fixed; top: 0; left: 0; z-index: 2147483647; pointer-events: none;";
    document.body.appendChild(host);

    // 2. 创建 Shadow DOM (隔离环境)
    const shadow = host.attachShadow({mode: 'open'});

    // 3. 注入样式 (只在 Shadow DOM 内生效，不污染网页，也不被网页污染)
    const style = document.createElement('style');
    style.textContent = `
        /* 容器：允许交互 */
        .container {
            pointer-events: auto; 
            position: fixed;
            top: 20%;
            right: 0;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        /* 悬浮球按钮 */
        .fab {
            width: 48px;
            height: 48px;
            background: #007AFF; /* iOS 蓝 */
            border-radius: 50% 0 0 50%;
            color: white;
            display: flex;
            justify-content: center;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: width 0.3s;
            user-select: none;
            font-weight: bold;
            font-size: 20px;
        }
        
        /* 菜单面板 */
        .menu {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 12px 0 12px 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            padding: 10px;
            margin-top: 10px;
            margin-right: 10px;
            display: none; /* 默认隐藏 */
            flex-direction: column;
            gap: 8px;
            width: 160px;
        }
        
        .menu.show { display: flex; }

        .btn {
            background: #f2f2f7;
            border: none;
            padding: 10px;
            border-radius: 8px;
            color: #333;
            font-size: 14px;
            text-align: center;
            cursor: pointer;
        }
        .btn:active { background: #e5e5ea; }
        .btn-primary { background: #007AFF; color: white; }
    `;
    shadow.appendChild(style);

    // 4. 构建 HTML 结构
    const container = document.createElement('div');
    container.className = 'container';
    
    // 悬浮球
    const fab = document.createElement('div');
    fab.className = 'fab';
    fab.innerText = 'V'; // 图标
    
    // 菜单
    const menu = document.createElement('div');
    menu.className = 'menu';
    
    const btnPlay = document.createElement('button');
    btnPlay.className = 'btn btn-primary';
    btnPlay.innerText = '📺 纯净播放';
    
    const btnCopy = document.createElement('button');
    btnCopy.className = 'btn';
    btnCopy.innerText = '🔗 复制链接';
    
    const btnClose = document.createElement('button');
    btnClose.className = 'btn';
    btnClose.innerText = '❌ 关闭菜单';

    menu.append(btnPlay, btnCopy, btnClose);
    container.append(fab, menu);
    shadow.appendChild(container);

    // 5. 核心逻辑：拖拽功能 (支持 Touch)
    let isDragging = false;
    let startY, startTop;

    fab.addEventListener('touchstart', (e) => {
        isDragging = false;
        startY = e.touches[0].clientY;
        startTop = container.getBoundingClientRect().top;
    });

    fab.addEventListener('touchmove', (e) => {
        isDragging = true; // 标记为正在拖动
        e.preventDefault(); // 防止屏幕跟着滚动
        const deltaY = e.touches[0].clientY - startY;
        container.style.top = `${startTop + deltaY}px`;
    });

    // 6. 核心逻辑：点击交互
    fab.addEventListener('click', () => {
        if (!isDragging) { // 只有不是拖拽的时候才响应点击
            menu.classList.toggle('show');
        }
    });
    
    btnClose.addEventListener('click', () => {
        menu.classList.remove('show');
    });

    // 7. 核心逻辑：嗅探与播放
    const getVideo = () => {
        const v = document.querySelector('video');
        if (!v) { alert('当前页面没找到视频'); return null; }
        return v.src || v.currentSrc;
    };

    btnPlay.addEventListener('click', () => {
        const src = getVideo();
        if(!src) return;
        
        // 创建全屏覆盖层播放
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:2147483647;display:flex;align-items:center;';
        overlay.innerHTML = `<video src="${src}" controls autoplay style="width:100%"></video><button style="position:absolute;top:30px;right:20px;padding:10px;background:white;border-radius:5px;">关闭</button>`;
        
        overlay.querySelector('button').onclick = () => overlay.remove();
        document.body.appendChild(overlay);
        
        // 尝试暂停原视频
        try { document.querySelector('video').pause(); } catch(e){}
    });

    btnCopy.addEventListener('click', () => {
        const src = getVideo();
        if(src) {
             // 简单的 prompt 复制，因为 iOS 脚本中 clipboard API 并不总是稳定
            prompt("视频地址如下，请全选复制：", src);
        }
    });

})();
