// UI 顯示系統管理器
// 自動檢測設備和瀏覽器類型，並應用相應的 UI 顯示配置

class UIDisplayManager {
    constructor() {
        this.deviceType = null;
        this.browserType = null;
        this.currentUISystem = null;
        this.uiSystems = {};
        
        // 檢測設備和瀏覽器
        this.detectDevice();
        this.detectBrowser();
        
        // 初始化所有 UI 系統
        this.initializeUISystems();
        
        // 自動應用適合的 UI 系統
        this.applyUISystem();
        
        // 監聽視窗大小變化，自動調整
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    // 檢測設備類型（與輸入系統管理器相同的邏輯）
    detectDevice() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        
        const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || 
                        (touchSupport && (screenWidth < 768 || screenHeight < 768));
        
        const isTablet = /iPad|Android/i.test(userAgent) && !/Mobile/i.test(userAgent) ||
                         (touchSupport && screenWidth >= 768 && screenWidth < 1024);
        
        if (isMobile) {
            this.deviceType = 'mobile';
        } else if (isTablet) {
            this.deviceType = 'tablet';
        } else {
            this.deviceType = 'desktop';
        }
        
        console.log('[UI] 檢測到設備類型:', this.deviceType);
    }
    
    // 檢測瀏覽器類型
    detectBrowser() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        
        if (userAgent.indexOf('Chrome') > -1 && userAgent.indexOf('Edg') === -1) {
            this.browserType = 'chrome';
        } else if (userAgent.indexOf('Firefox') > -1) {
            this.browserType = 'firefox';
        } else if (userAgent.indexOf('Safari') > -1 && userAgent.indexOf('Chrome') === -1) {
            this.browserType = 'safari';
        } else if (userAgent.indexOf('Edg') > -1) {
            this.browserType = 'edge';
        } else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) {
            this.browserType = 'opera';
        } else {
            this.browserType = 'unknown';
        }
        
        console.log('[UI] 檢測到瀏覽器類型:', this.browserType);
    }
    
    // 初始化所有 UI 系統
    initializeUISystems() {
        // 系統1: 桌面 UI 配置（主要系統）
        this.uiSystems.desktop = new DesktopUISystem();
        
        // 系統2: 移動設備 UI 配置（主要系統）
        this.uiSystems.mobile = new MobileUISystem();
        
        // 系統3: 精簡 UI 模式（代入系統1）
        this.uiSystems.minimal = new MinimalUISystem();
        
        // 系統4: 全屏沉浸模式（代入系統2）
        this.uiSystems.immersive = new ImmersiveUISystem();
    }
    
    // 自動應用適合的 UI 系統
    applyUISystem() {
        // 根據設備類型選擇主要系統
        if (this.deviceType === 'mobile' || this.deviceType === 'tablet') {
            this.currentUISystem = this.uiSystems.mobile;
            console.log('[UI] 已應用: 移動設備 UI 配置');
        } else {
            this.currentUISystem = this.uiSystems.desktop;
            console.log('[UI] 已應用: 桌面 UI 配置');
        }
        
        // 啟用選中的系統
        if (this.currentUISystem) {
            this.currentUISystem.enable();
        }
    }
    
    // 切換到指定的 UI 系統
    switchUISystem(systemName) {
        // 禁用當前系統
        if (this.currentUISystem) {
            this.currentUISystem.disable();
        }
        
        // 啟用新系統
        if (this.uiSystems[systemName]) {
            this.currentUISystem = this.uiSystems[systemName];
            this.currentUISystem.enable();
            console.log('[UI] 已切換到 UI 系統:', systemName);
            return true;
        }
        
        console.warn('[UI] 找不到 UI 系統:', systemName);
        return false;
    }
    
    // 處理視窗大小變化
    handleResize() {
        // 重新檢測設備類型（可能從桌面切換到移動設備或反之）
        const previousDeviceType = this.deviceType;
        this.detectDevice();
        
        // 如果設備類型改變，切換 UI 系統
        if (previousDeviceType !== this.deviceType) {
            console.log('[UI] 設備類型改變，從', previousDeviceType, '切換到', this.deviceType);
            this.applyUISystem();
        } else if (this.currentUISystem) {
            // 否則只更新當前系統
            this.currentUISystem.handleResize();
        }
    }
    
    // 獲取當前設備信息
    getDeviceInfo() {
        return {
            deviceType: this.deviceType,
            browserType: this.browserType,
            currentSystem: this.currentUISystem ? this.currentUISystem.name : null
        };
    }
}

// 桌面 UI 系統
class DesktopUISystem {
    constructor() {
        this.name = 'Desktop UI';
        this.enabled = false;
    }
    
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.applyStyles();
        console.log('[UI] ✓ 桌面 UI 已啟用');
    }
    
    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        console.log('[UI] ✗ 桌面 UI 已停用');
    }
    
    applyStyles() {
        const style = document.createElement('style');
        style.id = 'desktop-ui-styles';
        style.textContent = `
            /* 桌面 UI 樣式 */
            header {
                padding: 20px 30px;
            }
            
            header h1 {
                font-size: 28px;
            }
            
            .header-tools {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            
            .search-container {
                min-width: 300px;
                max-width: 400px;
            }
            
            .controls {
                display: flex;
                gap: 10px;
            }
            
            .btn {
                padding: 10px 20px;
                font-size: 14px;
            }
            
            /* 隱藏觸控控制按鈕 */
            .touch-controls {
                display: none !important;
            }
            
            /* 顯示地圖控制按鈕 */
            .map-controls-floating {
                display: flex;
            }
            
            /* 資訊面板位置 */
            .photo-info-panel {
                width: 400px;
                right: 20px;
            }
            
            /* 響應式調整 */
            @media (max-width: 1200px) {
                .photo-info-panel {
                    width: 350px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    handleResize() {
        // 桌面模式下不需要特別處理
    }
}

// 移動設備 UI 系統
class MobileUISystem {
    constructor() {
        this.name = 'Mobile UI';
        this.enabled = false;
    }
    
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.applyStyles();
        console.log('[UI] ✓ 移動設備 UI 已啟用');
    }
    
    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        console.log('[UI] ✗ 移動設備 UI 已停用');
    }
    
    applyStyles() {
        const style = document.createElement('style');
        style.id = 'mobile-ui-styles';
        style.textContent = `
            /* 移動設備 UI 樣式 */
            header {
                padding: 15px 20px;
            }
            
            header h1 {
                font-size: 20px;
            }
            
            .header-tools {
                display: flex;
                flex-direction: column;
                align-items: stretch;
                gap: 10px;
                width: 100%;
            }
            
            .search-container {
                width: 100%;
                min-width: 0;
                max-width: 100%;
            }
            
            .controls {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                width: 100%;
            }
            
            .btn {
                padding: 8px 16px;
                font-size: 13px;
                flex: 1;
                min-width: 80px;
            }
            
            /* 顯示觸控控制按鈕 */
            .touch-controls {
                display: flex !important;
            }
            
            /* 調整觸控按鈕大小 */
            .touch-btn {
                min-width: 70px;
                height: 45px;
                font-size: 13px;
            }
            
            /* 地圖控制按鈕調整 */
            .map-controls-floating {
                right: 15px;
                bottom: 15px;
            }
            
            .map-ctrl-btn {
                width: 36px;
                height: 36px;
                font-size: 16px;
            }
            
            /* 資訊面板全屏化 */
            .photo-info-panel {
                width: calc(100% - 40px);
                right: 20px;
                left: 20px;
                max-width: none;
                top: 50%;
                transform: translateY(-50%);
            }
            
            /* 觸控控制按鈕位置調整 */
            .touch-controls {
                left: 15px;
                bottom: 15px;
            }
            
            /* 響應式調整 */
            @media (max-width: 480px) {
                header h1 {
                    font-size: 18px;
                }
                
                .btn {
                    font-size: 12px;
                    padding: 6px 12px;
                }
                
                .touch-btn {
                    min-width: 60px;
                    height: 40px;
                    font-size: 12px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    handleResize() {
        // 移動設備模式下可能需要重新計算佈局
    }
}

// 代入系統1: 精簡 UI 模式
class MinimalUISystem {
    constructor() {
        this.name = 'Minimal UI';
        this.enabled = false;
    }
    
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.applyStyles();
        console.log('[UI] ✓ 精簡 UI 模式已啟用');
    }
    
    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this.removeStyles();
        console.log('[UI] ✗ 精簡 UI 模式已停用');
    }
    
    applyStyles() {
        const style = document.createElement('style');
        style.id = 'minimal-ui-styles';
        style.textContent = `
            /* 精簡 UI 樣式 - 最小化 UI 元素 */
            header {
                padding: 10px 20px;
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                z-index: 1000;
                background: rgba(102, 126, 234, 0.9);
                backdrop-filter: blur(10px);
            }
            
            header h1 {
                font-size: 20px;
            }
            
            .header-tools {
                gap: 10px;
            }
            
            .search-container {
                min-width: 200px;
                max-width: 300px;
            }
            
            .controls {
                display: none; /* 隱藏大部分控制按鈕 */
            }
            
            .map-controls-floating {
                display: flex;
            }
            
            .touch-controls {
                display: none !important;
            }
            
            .photo-info-panel {
                width: 350px;
            }
        `;
        document.head.appendChild(style);
    }
    
    removeStyles() {
        const style = document.getElementById('minimal-ui-styles');
        if (style) {
            style.remove();
        }
    }
    
    handleResize() {
        // 精簡模式下不需要特別處理
    }
}

// 代入系統2: 全屏沉浸模式
class ImmersiveUISystem {
    constructor() {
        this.name = 'Immersive UI';
        this.enabled = false;
        this.uiVisible = true;
    }
    
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.applyStyles();
        this.setupToggle();
        console.log('[UI] ✓ 全屏沉浸模式已啟用');
    }
    
    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this.removeStyles();
        this.removeToggle();
        console.log('[UI] ✗ 全屏沉浸模式已停用');
    }
    
    applyStyles() {
        const style = document.createElement('style');
        style.id = 'immersive-ui-styles';
        style.textContent = `
            /* 全屏沉浸模式樣式 */
            header {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 1000;
                transform: translateY(0);
                transition: transform 0.3s ease;
            }
            
            header.ui-hidden {
                transform: translateY(-100%);
            }
            
            .ui-toggle-btn {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1001;
                width: 50px;
                height: 50px;
                border-radius: 50%;
                background: rgba(102, 126, 234, 0.9);
                border: 2px solid white;
                color: white;
                font-size: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                transition: all 0.3s ease;
            }
            
            .ui-toggle-btn:hover {
                background: rgba(102, 126, 234, 1);
                transform: scale(1.1);
            }
            
            .map-controls-floating {
                position: fixed;
                bottom: 20px;
                right: 20px;
            }
            
            .touch-controls {
                position: fixed;
                bottom: 20px;
                left: 20px;
            }
        `;
        document.head.appendChild(style);
    }
    
    setupToggle() {
        // 創建 UI 切換按鈕
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'ui-toggle-btn';
        toggleBtn.id = 'uiToggleBtn';
        toggleBtn.innerHTML = '☰';
        toggleBtn.title = '切換 UI 顯示';
        
        toggleBtn.addEventListener('click', () => {
            this.toggleUI();
        });
        
        document.body.appendChild(toggleBtn);
    }
    
    removeToggle() {
        const toggleBtn = document.getElementById('uiToggleBtn');
        if (toggleBtn) {
            toggleBtn.remove();
        }
    }
    
    toggleUI() {
        this.uiVisible = !this.uiVisible;
        const header = document.querySelector('header');
        if (header) {
            if (this.uiVisible) {
                header.classList.remove('ui-hidden');
            } else {
                header.classList.add('ui-hidden');
            }
        }
    }
    
    removeStyles() {
        const style = document.getElementById('immersive-ui-styles');
        if (style) {
            style.remove();
        }
    }
    
    handleResize() {
        // 沉浸模式下不需要特別處理
    }
}

// 導出到全域
window.UIDisplayManager = UIDisplayManager;

