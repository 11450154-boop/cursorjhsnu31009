// 地圖 UI 控制（模仿 Google Map 右下角的縮放與羅盤按鈕）

let mapUISetup = false;

function setupMapUI() {
    // 避免重複設置
    if (mapUISetup) return;
    
    if (!window.map3D) {
        console.warn('map3D 尚未初始化，無法設置 UI 按鈕');
        return;
    }
    
    console.log('設置地圖 UI 控制按鈕...');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');

    if (zoomInBtn) {
        zoomInBtn.onclick = () => {
            console.log('點擊縮放+按鈕');
            if (window.map3D && window.map3D.applyZoom) {
                window.map3D.applyZoom(8);
            } else {
                console.error('map3D 或 applyZoom 方法不存在');
            }
        };
    } else {
        console.warn('找不到 zoomInBtn');
    }

    if (zoomOutBtn) {
        zoomOutBtn.onclick = () => {
            console.log('點擊縮放-按鈕');
            if (window.map3D && window.map3D.applyZoom) {
                window.map3D.applyZoom(-8);
            } else {
                console.error('map3D 或 applyZoom 方法不存在');
            }
        };
    } else {
        console.warn('找不到 zoomOutBtn');
    }

    if (resetViewBtn) {
        resetViewBtn.onclick = () => {
            console.log('點擊重置視角按鈕');
            if (window.map3D && window.map3D.resetView) {
                window.map3D.resetView();
            } else {
                console.error('map3D 或 resetView 方法不存在');
            }
        };
        console.log('重置視角按鈕事件監聽器已設置');
    } else {
        console.warn('找不到 resetViewBtn');
    }

    // 圖片資訊面板關閉按鈕
    const closePhotoInfoBtn = document.getElementById('closePhotoInfoBtn');
    if (closePhotoInfoBtn) {
        closePhotoInfoBtn.onclick = () => {
            if (window.map3D && window.map3D.hidePhotoInfoPanel) {
                window.map3D.hidePhotoInfoPanel();
            }
        };
    }
    
    mapUISetup = true;
    console.log('地圖 UI 控制按鈕設置完成');
}

// 監聽 map3D 準備好的事件
window.addEventListener('map3DReady', () => {
    console.log('收到 map3DReady 事件，設置 UI 按鈕');
    setupMapUI();
});

// 如果事件已經觸發，直接設置
document.addEventListener('DOMContentLoaded', () => {
    // 初始化 UI 顯示系統管理器（自動檢測設備並應用 UI）
    if (typeof UIDisplayManager !== 'undefined') {
        window.uiDisplayManager = new UIDisplayManager();
        console.log('[UI] UI 顯示系統管理器已初始化');
    } else {
        console.warn('[UI] UIDisplayManager 未載入，使用預設 UI');
    }
    
    // 先嘗試設置（如果 map3D 已經初始化）
    if (window.map3D) {
        setupMapUI();
    }
    // 同時也監聽事件（以防 map3D 稍後才初始化）
    window.addEventListener('map3DReady', setupMapUI);
});







