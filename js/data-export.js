// 資料匯出/匯入功能
class DataExport {
    constructor() {
        this.init();
    }

    init() {
        this.setupExportButton();
    }

    // 設置匯出按鈕（已禁用）
    setupExportButton() {
        // 匯出功能已移除，不再創建按鈕
        return;
    }


    // 匯出資料
    exportData() {
        try {
            if (!window.photoMarkerManager) {
                alert('標誌管理器尚未初始化');
                return;
            }

            const markers = window.photoMarkerManager.getAllMarkers();
            const dataToExport = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                markers: markers.map(marker => ({
                    id: marker.id,
                    name: marker.name,
                    imagePath: marker.imagePath,
                    position: marker.position
                }))
            };

            const jsonStr = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `地圖標誌資料_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert(`已匯出 ${markers.length} 個標誌資料`);
        } catch (error) {
            console.error('匯出失敗:', error);
            alert('匯出失敗：' + error.message);
        }
    }


    // 手動備份到 LocalStorage（確保資料已儲存）
    forceSave() {
        if (window.photoMarkerManager) {
            window.photoMarkerManager.saveToStorage();
            return true;
        }
        return false;
    }

}

// 初始化匯出/匯入功能
let dataExport = null;

function initDataExport() {
    if (dataExport) return;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDataExport);
        return;
    }

    try {
        dataExport = new DataExport();
        window.dataExport = dataExport; // 設置為全域變數
        console.log('DataExport 初始化完成');
    } catch (error) {
        console.error('DataExport 初始化失敗:', error);
    }
}

// 立即嘗試初始化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initDataExport();
} else {
    document.addEventListener('DOMContentLoaded', initDataExport);
}

