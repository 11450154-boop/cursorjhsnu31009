// 地圖 UI 控制（模仿 Google Map 右下角的縮放與羅盤按鈕）

document.addEventListener('DOMContentLoaded', () => {
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const northResetBtn = document.getElementById('northResetBtn');

    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            if (window.map3D) {
                // 正值代表往前拉近
                map3D.applyZoom(8);
            }
        });
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            if (window.map3D) {
                // 負值代表往後拉遠
                map3D.applyZoom(-8);
            }
        });
    }

    if (northResetBtn) {
        northResetBtn.addEventListener('click', () => {
            if (window.map3D) {
                // 使用既有的 resetView 當作「回到預設視角」
                map3D.resetView();
            }
        });
    }
});






