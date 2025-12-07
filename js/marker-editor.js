// 標記編輯器功能
class MarkerEditor {
    constructor() {
        this.currentEditingMarker = null;
        this.isEditMode = false;
        this.imagePreview = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateMarkerList();
    }

    setupEventListeners() {
        // 添加地標按鈕
        document.getElementById('addMarkerBtn').addEventListener('click', () => {
            this.openEditor();
        });

        // 重置視角按鈕
        document.getElementById('resetViewBtn').addEventListener('click', () => {
            if (map3D) {
                map3D.resetView();
            }
        });

        // 關閉資訊面板
        document.getElementById('closeInfoBtn').addEventListener('click', () => {
            if (map3D) {
                map3D.hideInfoPanel();
            }
        });

        // 編輯資訊按鈕
        document.getElementById('editInfoBtn').addEventListener('click', () => {
            if (map3D && map3D.currentMarkerId) {
                this.openEditor(map3D.currentMarkerId);
            }
        });

        // 刪除資訊按鈕
        document.getElementById('deleteInfoBtn').addEventListener('click', () => {
            if (map3D && map3D.currentMarkerId) {
                this.deleteMarker(map3D.currentMarkerId);
            }
        });

        // 模態框相關
        document.getElementById('closeModalBtn').addEventListener('click', () => {
            this.closeEditor();
        });

        document.getElementById('cancelMarkerBtn').addEventListener('click', () => {
            this.closeEditor();
        });

        // 儲存標記按鈕
        document.getElementById('saveMarkerBtn').addEventListener('click', () => {
            this.saveMarker();
        });

        // 選擇位置按鈕
        document.getElementById('selectPositionBtn').addEventListener('click', () => {
            this.startSelectPosition();
        });

        // 圖片上傳
        document.getElementById('markerImage').addEventListener('change', (e) => {
            this.handleImageUpload(e.target.files[0]);
        });

        // 匯出地標按鈕
        document.getElementById('exportMarkersBtn').addEventListener('click', () => {
            this.exportMarkers();
        });

        // 匯入地標按鈕
        document.getElementById('importMarkersBtn').addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });

        // 檔案選擇事件
        document.getElementById('importFileInput').addEventListener('change', (e) => {
            this.handleImportFile(e.target.files[0]);
        });
    }

    // 開啟編輯器
    openEditor(markerId = null) {
        const modal = document.getElementById('markerEditorModal');
        const title = document.getElementById('modalTitle');
        
        if (markerId) {
            // 編輯模式
            this.currentEditingMarker = markerId;
            title.textContent = '編輯地標';
            this.loadMarkerData(markerId);
        } else {
            // 新增模式
            this.currentEditingMarker = null;
            title.textContent = '添加地標';
            this.clearForm();
        }
        
        modal.classList.remove('hidden');
    }

    // 關閉編輯器
    closeEditor() {
        const modal = document.getElementById('markerEditorModal');
        modal.classList.add('hidden');
        modal.classList.remove('selecting-position'); // 移除選擇位置模式樣式
        this.currentEditingMarker = null;
        this.clearForm();
        
        if (map3D) {
            map3D.stopSelectPosition();
        }
    }

    // 清除表單
    clearForm() {
        document.getElementById('markerName').value = '';
        document.getElementById('markerDescription').value = '';
        document.getElementById('markerX').value = '';
        document.getElementById('markerY').value = '';
        document.getElementById('markerZ').value = '';
        document.getElementById('markerImage').value = '';
        document.getElementById('imagePreview').innerHTML = '';
        this.imagePreview = null;
    }

    // 載入標記資料
    loadMarkerData(markerId) {
        const marker = markerDataManager.getMarker(markerId);
        if (marker) {
            document.getElementById('markerName').value = marker.name || '';
            document.getElementById('markerDescription').value = marker.description || '';
            document.getElementById('markerX').value = marker.position.x || '';
            document.getElementById('markerY').value = marker.position.y || '';
            document.getElementById('markerZ').value = marker.position.z || '';
            
            if (marker.imageData) {
                this.imagePreview = marker.imageData;
                this.updateImagePreview();
            }
        }
    }

    // 處理圖片上傳
    async handleImageUpload(file) {
        if (!file) return;

        const validation = ImageUtils.validateImage(file);
        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        try {
            this.imagePreview = await ImageUtils.fileToBase64(file);
            this.updateImagePreview();
        } catch (error) {
            console.error('圖片處理失敗:', error);
            alert('圖片處理失敗，請重試');
        }
    }

    // 更新圖片預覽
    updateImagePreview() {
        const preview = document.getElementById('imagePreview');
        if (this.imagePreview) {
            preview.innerHTML = `<img src="${this.imagePreview}" alt="預覽圖片">`;
        } else {
            preview.innerHTML = '';
        }
    }

    // 開始選擇位置
    startSelectPosition() {
        if (!map3D) return;
        
        // 將模態框切換到選擇位置模式樣式
        const modal = document.getElementById('markerEditorModal');
        if (modal) {
            modal.classList.add('selecting-position');
        }
        
        // 先啟用選擇位置模式
        map3D.startSelectPosition((point) => {
            document.getElementById('markerX').value = point.x.toFixed(2);
            document.getElementById('markerY').value = point.y.toFixed(2);
            document.getElementById('markerZ').value = point.z.toFixed(2);
            
            // 移除選擇位置模式樣式
            if (modal) {
                modal.classList.remove('selecting-position');
            }
            
            // 顯示成功提示
            const successMsg = document.createElement('div');
            successMsg.textContent = '位置已設定！';
            successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 15px 20px; border-radius: 5px; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.3);';
            document.body.appendChild(successMsg);
            setTimeout(() => {
                successMsg.remove();
            }, 2000);
        });
        
        // 使用非阻塞方式顯示提示
        setTimeout(() => {
            const hintMsg = document.createElement('div');
            hintMsg.textContent = '請點擊 3D 地圖上的位置來設定地標座標';
            hintMsg.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #2196F3; color: white; padding: 15px 25px; border-radius: 5px; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.3); font-size: 14px;';
            document.body.appendChild(hintMsg);
            
            // 當選擇位置模式結束時，移除提示
            const checkInterval = setInterval(() => {
                if (!map3D.isSelectingPosition) {
                    hintMsg.remove();
                    clearInterval(checkInterval);
                }
            }, 100);
        }, 100);
    }

    // 儲存標記
    async saveMarker() {
        const name = document.getElementById('markerName').value.trim();
        const description = document.getElementById('markerDescription').value.trim();
        const x = parseFloat(document.getElementById('markerX').value);
        const y = parseFloat(document.getElementById('markerY').value);
        const z = parseFloat(document.getElementById('markerZ').value);

        // 驗證
        if (!name) {
            alert('請輸入地標名稱');
            return;
        }

        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            alert('請設定地標位置（點擊「在地圖上選擇位置」）');
            return;
        }

        const markerData = {
            name,
            description,
            position: { x, y, z },
            imageData: this.imagePreview
        };

        if (this.currentEditingMarker) {
            // 更新現有標記
            const updated = markerDataManager.updateMarker(this.currentEditingMarker, markerData);
            if (updated && map3D) {
                map3D.updateMarker(this.currentEditingMarker, markerData);
                this.updateMarkerList();
                this.closeEditor();
                alert('地標已更新！');
            }
        } else {
            // 新增標記
            const newMarker = markerDataManager.addMarker(markerData);
            if (map3D) {
                map3D.addMarker(newMarker);
                this.updateMarkerList();
                this.closeEditor();
                alert('地標已添加！');
            }
        }
    }

    // 刪除標記
    deleteMarker(markerId) {
        if (!confirm('確定要刪除這個地標嗎？')) {
            return;
        }

        const deleted = markerDataManager.deleteMarker(markerId);
        if (deleted && map3D) {
            map3D.removeMarker(markerId);
            map3D.hideInfoPanel();
            this.updateMarkerList();
            alert('地標已刪除！');
        }
    }


    // 更新標記列表
    updateMarkerList() {
        const container = document.getElementById('markerListItems');
        const markers = markerDataManager.getAllMarkers();
        
        container.innerHTML = '';
        
        if (markers.length === 0) {
            container.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">尚無地標，點擊「添加地標」開始</p>';
            return;
        }

        markers.forEach(marker => {
            const item = document.createElement('div');
            item.className = 'marker-item';
            item.innerHTML = `
                <div class="marker-item-name">📍 ${marker.name}</div>
                <div class="marker-item-desc">${marker.description || '無簡介'}</div>
            `;
            
            item.addEventListener('click', () => {
                // 移除其他項目的 active 類
                document.querySelectorAll('.marker-item').forEach(el => {
                    el.classList.remove('active');
                });
                item.classList.add('active');
                
                // 顯示資訊面板並聚焦到標記（由 map3D 處理鏡頭平滑移動）
                if (map3D) {
                    map3D.onMarkerClick(marker.id);
                }
            });
            
            container.appendChild(item);
        });
    }

    // 匯出地標到檔案
    exportMarkers() {
        const markers = markerDataManager.getAllMarkers();
        if (markers.length === 0) {
            alert('目前沒有任何地標可以匯出');
            return;
        }

        try {
            markerDataManager.exportData();
            // 顯示成功訊息
            this.showMessage('地標已成功匯出！', 'success');
        } catch (error) {
            console.error('匯出失敗:', error);
            alert('匯出失敗：' + error.message);
        }
    }

    // 處理匯入檔案
    async handleImportFile(file) {
        if (!file) return;

        if (!file.name.endsWith('.json')) {
            alert('請選擇 JSON 格式的檔案');
            return;
        }

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!Array.isArray(data)) {
                alert('檔案格式錯誤：地標資料必須是陣列格式');
                return;
            }

            // 確認是否要覆蓋現有資料
            const currentMarkers = markerDataManager.getAllMarkers();
            let shouldMerge = false;
            
            if (currentMarkers.length > 0) {
                const action = confirm(
                    `目前已有 ${currentMarkers.length} 個地標。\n\n` +
                    `點擊「確定」會覆蓋現有地標（使用匯入的資料）\n` +
                    `點擊「取消」會合併資料（保留現有地標，只添加新的）`
                );
                shouldMerge = !action; // 取消 = 合併模式
            }

            if (shouldMerge) {
                // 合併模式：只添加不重複的地標
                let addedCount = 0;
                data.forEach(marker => {
                    const existing = markerDataManager.getMarker(marker.id);
                    if (!existing) {
                        markerDataManager.addMarker(marker);
                        addedCount++;
                    }
                });
                this.showMessage(`已合併 ${addedCount} 個新地標`, 'success');
            } else {
                // 覆蓋模式：清除現有資料，載入新資料
                markerDataManager.clearAll();
                data.forEach(marker => {
                    markerDataManager.addMarker(marker);
                });
                this.showMessage(`已匯入 ${data.length} 個地標`, 'success');
            }

            // 重新載入 3D 場景中的地標
            this.reloadAllMarkers();

            // 更新列表
            this.updateMarkerList();

            // 重置檔案輸入（允許再次選擇同一個檔案）
            document.getElementById('importFileInput').value = '';

        } catch (error) {
            console.error('匯入失敗:', error);
            alert('匯入失敗：' + error.message + '\n\n請確認檔案格式正確');
        }
    }

    // 重新載入所有地標到 3D 場景
    reloadAllMarkers() {
        if (!map3D) return;

        // 清除現有的 3D 地標
        const currentMarkers = map3D.markers.slice(); // 複製陣列
        currentMarkers.forEach(marker => {
            map3D.removeMarker(marker.id);
        });

        // 從資料管理器重新載入所有地標
        const allMarkers = markerDataManager.getAllMarkers();
        allMarkers.forEach(markerData => {
            map3D.addMarker(markerData);
        });

        console.log(`已重新載入 ${allMarkers.length} 個地標到 3D 場景`);
    }

    // 顯示訊息（簡單的提示）
    showMessage(text, type = 'info') {
        const message = document.createElement('div');
        message.textContent = text;
        message.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 14px;
            animation: slideIn 0.3s ease;
        `;
        
        // 添加動畫樣式（如果還沒有）
        if (!document.getElementById('messageAnimationStyle')) {
            const style = document.createElement('style');
            style.id = 'messageAnimationStyle';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(message);
        setTimeout(() => {
            message.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => message.remove(), 300);
        }, 3000);
    }
}

// 標記點擊事件處理
window.onMarkerClick = function(marker) {
    if (markerEditor) {
        markerEditor.updateMarkerList();
    }
};

// 初始化編輯器
let markerEditor;

document.addEventListener('DOMContentLoaded', () => {
    markerEditor = new MarkerEditor();
    
    // 定期更新標記列表（當資料變更時）
    setInterval(() => {
        if (markerEditor) {
            markerEditor.updateMarkerList();
        }
    }, 1000);
});




