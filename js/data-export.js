// 資料匯出/匯入功能
class DataExport {
    constructor() {
        this.init();
    }

    init() {
        this.setupExportButton();
        this.setupImportButton();
    }

    // 設置匯出按鈕（已禁用）
    setupExportButton() {
        // 匯出功能已移除，不再創建按鈕
        return;
    }

    // 設置匯入按鈕
    setupImportButton() {
        // 創建匯入按鈕（如果不存在）
        let importBtn = document.getElementById('importDataBtn');
        if (!importBtn) {
            importBtn = document.createElement('button');
            importBtn.id = 'importDataBtn';
            importBtn.className = 'btn';
            importBtn.textContent = '匯入資料';
            
            // 創建隱藏的檔案輸入
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            fileInput.style.display = 'none';
            fileInput.id = 'importFileInput';
            document.body.appendChild(fileInput);
            
            importBtn.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.importData(file);
                }
                // 重置 input，允許選擇同一個檔案
                fileInput.value = '';
            });
            
            // 插入到控制按鈕區域
            const controls = document.querySelector('.controls');
            if (controls) {
                controls.insertBefore(importBtn, controls.firstChild);
            }
        }
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

    // 匯入資料
    importData(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (!data.markers || !Array.isArray(data.markers)) {
                    alert('檔案格式錯誤：找不到標誌資料');
                    return;
                }

                if (!window.photoMarkerManager) {
                    alert('標誌管理器尚未初始化');
                    return;
                }

                // 確認匯入
                const confirmMsg = `即將匯入 ${data.markers.length} 個標誌資料，這會覆蓋現有的資料。確定要繼續嗎？`;
                if (!confirm(confirmMsg)) {
                    return;
                }

                // 更新標誌資料
                let importedCount = 0;
                data.markers.forEach(markerData => {
                    const marker = window.photoMarkerManager.getMarker(markerData.id);
                    if (marker) {
                        if (markerData.position) {
                            window.photoMarkerManager.updateMarkerPosition(markerData.id, markerData.position);
                            importedCount++;
                        }
                    } else {
                        // 如果找不到標誌，嘗試根據名稱匹配
                        const markerByName = window.photoMarkerManager.markers.find(m => m.name === markerData.name);
                        if (markerByName && markerData.position) {
                            window.photoMarkerManager.updateMarkerPosition(markerByName.id, markerData.position);
                            importedCount++;
                        }
                    }
                });

                // 強制重新掃描，確保所有地標都被掃描到
                if (window.photoMarkerManager && window.photoMarkerManager.forceRescan) {
                    window.photoMarkerManager.forceRescan();
                }

                // 重新載入標誌到地圖
                if (window.map3D) {
                    // 清除現有標誌
                    window.map3D.photoMarkers.forEach(marker => {
                        window.map3D.removePhotoMarker(marker.id);
                    });
                    // 重新載入
                    window.map3D.loadPhotoMarkers();
                }

                // 檢查是否有地標沒有座標
                const allMarkers = window.photoMarkerManager.getAllMarkers();
                const markersWithoutPosition = allMarkers.filter(m => !m.position);
                
                if (markersWithoutPosition.length > 0) {
                    // 如果有地標沒有座標，自動打開標誌位置編輯器
                    const confirmMsg = `已成功匯入 ${importedCount} 個標誌的位置資料。\n\n發現 ${markersWithoutPosition.length} 個地標尚未設定座標，是否要現在設定？`;
                    if (confirm(confirmMsg)) {
                        // 等待編輯器初始化
                        this.waitForEditorAndOpen(markersWithoutPosition);
                    } else {
                        alert(`已成功匯入 ${importedCount} 個標誌的位置資料`);
                    }
                } else {
                    alert(`已成功匯入 ${importedCount} 個標誌的位置資料`);
                }
            } catch (error) {
                console.error('匯入失敗:', error);
                alert('匯入失敗：' + error.message);
            }
        };

        reader.onerror = () => {
            alert('讀取檔案失敗');
        };

        reader.readAsText(file);
    }

    // 手動備份到 LocalStorage（確保資料已儲存）
    forceSave() {
        if (window.photoMarkerManager) {
            window.photoMarkerManager.saveToStorage();
            return true;
        }
        return false;
    }

    // 等待編輯器初始化並打開
    waitForEditorAndOpen(markersWithoutPosition, attempts = 0, maxAttempts = 50) {
        if (window.photoMarkerEditor) {
            // 編輯器已初始化，打開它
            window.photoMarkerEditor.openEditor();
            // 自動選擇第一個沒有座標的地標
            if (markersWithoutPosition.length > 0) {
                setTimeout(() => {
                    window.photoMarkerEditor.selectMarker(markersWithoutPosition[0].id);
                    // 提示用戶可以點選座標
                    window.photoMarkerEditor.showMessage('請點擊「在地圖上選擇位置」按鈕來設定座標', 'info');
                }, 100);
            }
        } else if (attempts < maxAttempts) {
            // 編輯器尚未初始化，等待後重試
            setTimeout(() => {
                this.waitForEditorAndOpen(markersWithoutPosition, attempts + 1, maxAttempts);
            }, 100);
        } else {
            // 超過最大嘗試次數，顯示錯誤訊息
            alert('標誌位置編輯器初始化超時，請手動點擊「設定標誌位置」按鈕來設定座標');
        }
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

