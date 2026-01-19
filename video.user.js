// ==UserScript==
// @name         Universal HLS Hunter
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  通用 HLS 视频嗅探与纯净播放工具，支持 M3U8 嗅探、试看版推演、页内覆盖播放
// @author       Video Grabber 91
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // 配置
    // ============================================
    const CONFIG = {
        // 嗅探间隔 (ms)
        SNIFF_INTERVAL: 1000,
        // 试看版 URL 特征及其完整版转换规则
        PREVIEW_PATTERNS: [
            { pattern: /_0001\.m3u8/, replace: '.m3u8' },
            { pattern: /_preview\.m3u8/, replace: '.m3u8' },
            { pattern: /_trial\.m3u8/, replace: '.m3u8' },
            { pattern: /\/preview\//, replace: '/full/' },
        ],
        // 排除的 URL 关键词 (广告等)
        EXCLUDE_KEYWORDS: ['googlevideo', 'doubleclick', 'adsense', 'advertisement'],
    };

    // ============================================
    // 状态管理
    // ============================================
    const state = {
        m3u8List: [],           // 嗅探到的 M3U8 列表
        snifferTimer: null,     // 嗅探定时器
        isDragging: false,      // 是否正在拖拽
        dragStartY: 0,          // 拖拽起始 Y
        dragStartTop: 0,        // 拖拽起始 top
    };

    // ============================================
    // 工具函数
    // ============================================

    /**
     * HTML 转义，防止 XSS
     */
    const escapeHtml = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    /**
     * 检查 URL 是否应该被排除
     */
    const shouldExclude = (url) => {
        const lowerUrl = url.toLowerCase();
        return CONFIG.EXCLUDE_KEYWORDS.some(kw => lowerUrl.includes(kw));
    };

    /**
     * 尝试推演完整版 URL
     */
    const deduceFullVersion = (url) => {
        for (const rule of CONFIG.PREVIEW_PATTERNS) {
            if (rule.pattern.test(url)) {
                return {
                    original: url,
                    deduced: url.replace(rule.pattern, rule.replace),
                    isDeduced: true,
                };
            }
        }
        return { original: url, deduced: url, isDeduced: false };
    };

    /**
     * 从 Performance API 嗅探 M3U8
     */
    const sniffM3U8FromPerformance = () => {
        const resources = performance.getEntriesByType('resource');
        const m3u8Urls = resources
            .map(r => r.name)
            .filter(url => url.includes('.m3u8') && !shouldExclude(url));
        return [...new Set(m3u8Urls)];
    };

    /**
     * 从页面 video 标签获取视频源
     */
    const sniffFromVideoTags = () => {
        const videos = document.querySelectorAll('video');
        const sources = [];
        
        videos.forEach(v => {
            // 直接 src
            if (v.src && !v.src.startsWith('blob:')) {
                sources.push(v.src);
            }
            // currentSrc
            if (v.currentSrc && !v.currentSrc.startsWith('blob:')) {
                sources.push(v.currentSrc);
            }
            // source 子标签
            v.querySelectorAll('source').forEach(s => {
                if (s.src && !s.src.startsWith('blob:')) {
                    sources.push(s.src);
                }
            });
        });
        
        return sources.filter(url => url.includes('.m3u8') && !shouldExclude(url));
    };

    /**
     * 综合嗅探
     */
    const sniffAll = () => {
        const fromPerf = sniffM3U8FromPerformance();
        const fromTags = sniffFromVideoTags();
        const all = [...new Set([...fromPerf, ...fromTags])];
        
        // 处理每个 URL，尝试推演完整版
        const processed = all.map(url => deduceFullVersion(url));
        
        // 收集所有 URL（原始 + 推演）
        const result = [];
        const seen = new Set();
        
        processed.forEach(item => {
            if (!seen.has(item.original)) {
                seen.add(item.original);
                result.push({ url: item.original, type: 'original' });
            }
            if (item.isDeduced && !seen.has(item.deduced)) {
                seen.add(item.deduced);
                result.push({ url: item.deduced, type: 'deduced' });
            }
        });
        
        return result;
    };

    // ============================================
    // UI 组件
    // ============================================

    /**
     * 创建 Shadow DOM 隔离的 UI
     */
    const createUI = () => {
        // 宿主容器
        const host = document.createElement('div');
        host.id = 'universal-hls-hunter-host';
        host.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647;pointer-events:none;';
        document.body.appendChild(host);

        // Shadow DOM
        const shadow = host.attachShadow({ mode: 'closed' });

        // 样式
        const style = document.createElement('style');
        style.textContent = `
            * { box-sizing: border-box; }
            
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

            .fab {
                width: 44px;
                height: 44px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50% 0 0 50%;
                color: white;
                display: flex;
                justify-content: center;
                align-items: center;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                cursor: pointer;
                user-select: none;
                font-weight: bold;
                font-size: 14px;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .fab:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
            }
            
            .fab .count {
                position: absolute;
                top: -5px;
                left: -5px;
                background: #ff3b30;
                color: white;
                font-size: 10px;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .fab .count.hidden { display: none; }

            .menu {
                background: rgba(255, 255, 255, 0.98);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-radius: 12px 0 12px 12px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                padding: 12px;
                margin-top: 8px;
                display: none;
                flex-direction: column;
                gap: 8px;
                width: 280px;
                max-height: 400px;
                overflow-y: auto;
            }
            
            .menu.show { display: flex; }
            
            .menu-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-bottom: 8px;
                border-bottom: 1px solid #e5e5ea;
                margin-bottom: 4px;
            }
            
            .menu-title {
                font-size: 14px;
                font-weight: 600;
                color: #1c1c1e;
            }
            
            .menu-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #8e8e93;
                padding: 0;
                line-height: 1;
            }
            
            .empty-tip {
                color: #8e8e93;
                font-size: 13px;
                text-align: center;
                padding: 20px 0;
            }
            
            .m3u8-item {
                background: #f2f2f7;
                border-radius: 8px;
                padding: 10px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            
            .m3u8-item.deduced {
                background: #e8f5e9;
                border-left: 3px solid #4caf50;
            }
            
            .m3u8-url {
                font-size: 11px;
                color: #666;
                word-break: break-all;
                line-height: 1.4;
            }
            
            .m3u8-tag {
                font-size: 10px;
                color: #4caf50;
                font-weight: 500;
            }
            
            .m3u8-actions {
                display: flex;
                gap: 6px;
            }

            .btn {
                flex: 1;
                background: #007AFF;
                border: none;
                padding: 8px 10px;
                border-radius: 6px;
                color: white;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .btn:active { background: #0056b3; }
            
            .btn-secondary {
                background: #8e8e93;
            }
            
            .btn-secondary:active { background: #636366; }
            
            .overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: #000;
                z-index: 2147483647;
                display: flex;
                flex-direction: column;
            }
            
            .overlay-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 15px;
                background: rgba(0,0,0,0.8);
            }
            
            .overlay-title {
                color: white;
                font-size: 14px;
            }
            
            .overlay-close {
                background: rgba(255,255,255,0.2);
                border: none;
                color: white;
                padding: 8px 16px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
            }
            
            .overlay-video {
                flex: 1;
                width: 100%;
                background: #000;
            }
        `;
        shadow.appendChild(style);

        // 容器
        const container = document.createElement('div');
        container.className = 'container';

        // 悬浮球
        const fab = document.createElement('div');
        fab.className = 'fab';
        fab.innerHTML = '<span class="count hidden">0</span>M3U8';

        // 菜单
        const menu = document.createElement('div');
        menu.className = 'menu';
        menu.innerHTML = `
            <div class="menu-header">
                <span class="menu-title">HLS Hunter</span>
                <button class="menu-close">&times;</button>
            </div>
            <div class="m3u8-list">
                <div class="empty-tip">正在嗅探 M3U8 资源...</div>
            </div>
        `;

        container.append(fab, menu);
        shadow.appendChild(container);

        return { shadow, container, fab, menu };
    };

    /**
     * 更新 M3U8 列表 UI
     */
    const updateM3U8List = (ui) => {
        const listContainer = ui.menu.querySelector('.m3u8-list');
        const countBadge = ui.fab.querySelector('.count');
        
        const m3u8List = sniffAll();
        state.m3u8List = m3u8List;
        
        // 更新计数
        if (m3u8List.length > 0) {
            countBadge.textContent = m3u8List.length;
            countBadge.classList.remove('hidden');
        } else {
            countBadge.classList.add('hidden');
        }
        
        // 更新列表
        if (m3u8List.length === 0) {
            listContainer.innerHTML = '<div class="empty-tip">正在嗅探 M3U8 资源...</div>';
            return;
        }
        
        listContainer.innerHTML = m3u8List.map((item, index) => `
            <div class="m3u8-item ${item.type === 'deduced' ? 'deduced' : ''}">
                ${item.type === 'deduced' ? '<span class="m3u8-tag">推演完整版</span>' : ''}
                <div class="m3u8-url">${escapeHtml(item.url)}</div>
                <div class="m3u8-actions">
                    <button class="btn" data-action="play" data-index="${index}">播放</button>
                    <button class="btn btn-secondary" data-action="copy" data-index="${index}">复制</button>
                </div>
            </div>
        `).join('');
    };

    /**
     * 创建纯净播放器覆盖层
     */
    const createPlayerOverlay = (url) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:2147483647;display:flex;flex-direction:column;';
        
        // 头部
        const header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:10px 15px;background:rgba(0,0,0,0.8);';
        
        const title = document.createElement('span');
        title.style.cssText = 'color:white;font-size:14px;font-family:sans-serif;';
        title.textContent = 'HLS Hunter Player';
        
        const closeBtn = document.createElement('button');
        closeBtn.style.cssText = 'background:rgba(255,255,255,0.2);border:none;color:white;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;';
        closeBtn.textContent = '关闭';
        closeBtn.onclick = () => {
            overlay.remove();
            // 恢复页面滚动
            document.body.style.overflow = '';
        };
        
        header.append(title, closeBtn);
        
        // 视频容器
        const videoContainer = document.createElement('div');
        videoContainer.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;';
        
        const video = document.createElement('video');
        video.style.cssText = 'max-width:100%;max-height:100%;';
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        
        // 检测是否需要 HLS.js
        const needsHlsJs = url.includes('.m3u8') && !video.canPlayType('application/vnd.apple.mpegurl');
        
        if (needsHlsJs) {
            // 动态加载 HLS.js
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
            script.onload = () => {
                if (window.Hls && window.Hls.isSupported()) {
                    const hls = new window.Hls();
                    hls.loadSource(url);
                    hls.attachMedia(video);
                    hls.on(window.Hls.Events.ERROR, (event, data) => {
                        console.error('[HLS Hunter] HLS.js error:', data);
                        if (data.fatal) {
                            title.textContent = '播放失败: ' + data.type;
                        }
                    });
                } else {
                    title.textContent = '浏览器不支持 HLS 播放';
                }
            };
            script.onerror = () => {
                title.textContent = 'HLS.js 加载失败';
            };
            document.head.appendChild(script);
        } else {
            // Safari 原生支持或非 M3U8
            video.src = url;
        }
        
        videoContainer.appendChild(video);
        overlay.append(header, videoContainer);
        
        // 禁止页面滚动
        document.body.style.overflow = 'hidden';
        
        // 暂停原页面视频
        document.querySelectorAll('video').forEach(v => {
            try { v.pause(); } catch(e) {}
        });
        
        document.body.appendChild(overlay);
    };

    /**
     * 复制到剪贴板
     */
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            // Fallback: prompt
            prompt('请手动复制以下链接:', text);
            return false;
        }
    };

    // ============================================
    // 事件绑定
    // ============================================

    const bindEvents = (ui) => {
        const { container, fab, menu } = ui;
        
        // 拖拽 - Touch
        fab.addEventListener('touchstart', (e) => {
            state.isDragging = false;
            state.dragStartY = e.touches[0].clientY;
            state.dragStartTop = container.getBoundingClientRect().top;
        }, { passive: true });

        fab.addEventListener('touchmove', (e) => {
            state.isDragging = true;
            e.preventDefault();
            const deltaY = e.touches[0].clientY - state.dragStartY;
            container.style.top = `${state.dragStartTop + deltaY}px`;
        }, { passive: false });

        fab.addEventListener('touchend', () => {
            // 延迟重置，让 click 事件能判断
            setTimeout(() => { state.isDragging = false; }, 100);
        });

        // 拖拽 - Mouse
        let mouseStartY = 0;
        let mouseStartTop = 0;
        let isMouseDragging = false;

        fab.addEventListener('mousedown', (e) => {
            isMouseDragging = false;
            mouseStartY = e.clientY;
            mouseStartTop = container.getBoundingClientRect().top;
            
            const onMouseMove = (e) => {
                isMouseDragging = true;
                const deltaY = e.clientY - mouseStartY;
                container.style.top = `${mouseStartTop + deltaY}px`;
            };
            
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                setTimeout(() => { isMouseDragging = false; }, 100);
            };
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // 点击悬浮球
        fab.addEventListener('click', (e) => {
            if (state.isDragging || isMouseDragging) return;
            menu.classList.toggle('show');
            if (menu.classList.contains('show')) {
                updateM3U8List(ui);
            }
        });

        // 关闭菜单
        menu.querySelector('.menu-close').addEventListener('click', () => {
            menu.classList.remove('show');
        });

        // 列表按钮点击 (事件委托)
        menu.querySelector('.m3u8-list').addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            const action = btn.dataset.action;
            const index = parseInt(btn.dataset.index, 10);
            const item = state.m3u8List[index];
            
            if (!item) return;
            
            if (action === 'play') {
                menu.classList.remove('show');
                createPlayerOverlay(item.url);
            } else if (action === 'copy') {
                const success = await copyToClipboard(item.url);
                if (success) {
                    const originalText = btn.textContent;
                    btn.textContent = '已复制';
                    setTimeout(() => { btn.textContent = originalText; }, 1500);
                }
            }
        });
    };

    // ============================================
    // 初始化
    // ============================================

    const init = () => {
        // 避免在 iframe 中重复初始化
        if (window.self !== window.top) return;
        
        // 等待 body 存在
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', init);
            return;
        }

        const ui = createUI();
        bindEvents(ui);

        // 启动嗅探定时器
        state.snifferTimer = setInterval(() => {
            updateM3U8List(ui);
        }, CONFIG.SNIFF_INTERVAL);

        // 首次嗅探
        updateM3U8List(ui);

        console.log('[HLS Hunter] Initialized');
    };

    init();
})();
