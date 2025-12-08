// 圖片標誌位置設定器
class PhotoMarkerEditor {
    constructor() {
        this.isSelectingPosition = false;
        this.currentEditingMarkerId = null;
        this.selectPositionCallback = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateMarkerList();
    }

    setupEventListeners() {
        // 設定位置按鈕
        const setupBtn = document.getElementById('setupMarkerPosBtn');
        if (setupBtn) {
            // 使用 addEventListener 避免被覆蓋
            setupBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('設定按鈕被點擊');
                this.openEditor();
            }, { once: false, passive: false });
            console.log('設定按鈕事件監聽器已設置，按鈕:', setupBtn);
        } else {
            console.error('找不到 setupMarkerPosBtn 按鈕');
        }

        // 關閉編輯器按鈕
        const closeBtn = document.getElementById('closeMarkerEditorBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeEditor();
            });
        }

        // 取消按鈕
        const cancelBtn = document.getElementById('cancelMarkerEditorBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeEditor();
            });
        }

        // 在地圖上選擇位置按鈕
        const selectPosBtn = document.getElementById('selectMarkerPositionBtn');
        if (selectPosBtn) {
            selectPosBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.startSelectPosition();
            });
        }

        // 手動輸入座標按鈕
        const saveManualBtn = document.getElementById('saveManualPositionBtn');
        if (saveManualBtn) {
            saveManualBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveManualPosition();
            });
        }
    }

    // 開啟編輯器
    openEditor() {
        console.log('開啟標誌位置編輯器');
        const modal = document.getElementById('markerPositionEditorModal');
        if (modal) {
            modal.classList.remove('hidden');
            console.log('模態框已顯示');
            // 使用 setTimeout 確保 DOM 已更新
            setTimeout(() => {
                this.updateMarkerList();
            }, 0);
        } else {
            console.error('找不到 markerPositionEditorModal 元素');
        }
    }

    // 關閉編輯器
    closeEditor() {
        const modal = document.getElementById('markerPositionEditorModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('selecting-position');
        }
        this.isSelectingPosition = false;
        this.currentEditingMarkerId = null;
        this.selectPositionCallback = null;
        
        if (window.map3D && window.map3D.stopSelectPosition) {
            window.map3D.stopSelectPosition();
        }
    }

    // 更新標誌列表
    updateMarkerList() {
        const container = document.getElementById('markerListContainer');
        if (!container) return;

        if (!window.photoMarkerManager) {
            container.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">標誌管理器尚未初始化</p>';
            return;
        }

        const markers = window.photoMarkerManager.getAllMarkers();
        const previouslySelectedId = this.currentEditingMarkerId; // 保存之前選擇的 ID
        
        container.innerHTML = '';

        if (markers.length === 0) {
            container.innerHTML = '<p style="color: #6c757d; text-align: center; padding: 20px;">尚無標誌</p>';
            return;
        }

        markers.forEach(marker => {
            const item = document.createElement('div');
            item.className = 'marker-list-item';
            
            // 如果這是之前選擇的標誌，添加 active 類
            if (previouslySelectedId === marker.id) {
                item.classList.add('active');
            }
            
            item.innerHTML = `
                <div class="marker-list-item-name">📷 ${marker.name.replace(/\.(jpg|jpeg|png)$/i, '')}</div>
                <div class="marker-list-item-status">
                    ${marker.position ? 
                        `<span style="color: #28a745;">✓ 已設定</span> (${marker.position.x.toFixed(1)}, ${marker.position.y.toFixed(1)}, ${marker.position.z.toFixed(1)})` : 
                        '<span style="color: #dc3545;">✗ 未設定</span>'
                    }
                </div>
            `;
            
            // 使用閉包保存 marker 的引用
            const markerId = marker.id;
            const markerName = marker.name;
            const editor = this; // 保存 this 引用
            
            // 使用 onclick 和 addEventListener 雙重綁定確保事件觸發
            item.onclick = function(e) {
                e.stopPropagation();
                e.preventDefault();
                console.log('點擊標誌 (onclick):', markerName, 'ID:', markerId);
                editor.selectMarker(markerId);
            };
            
            item.addEventListener('click', function(e) {
                // 阻止事件冒泡，避免觸發其他點擊事件
                e.stopPropagation();
                e.preventDefault();
                
                console.log('點擊標誌 (addEventListener):', markerName, 'ID:', markerId);
                
                // 移除其他項目的 active 類
                document.querySelectorAll('.marker-list-item').forEach(el => {
                    el.classList.remove('active');
                });
                item.classList.add('active');
                
                editor.selectMarker(markerId);
            }, { capture: false, once: false });
            
            container.appendChild(item);
        });
        
        // 如果之前有選擇的標誌，重新選擇它（更新顯示）
        if (previouslySelectedId) {
            // 使用 setTimeout 確保 DOM 已更新
            setTimeout(() => {
                this.selectMarker(previouslySelectedId);
            }, 0);
        }
    }

    // 選擇標誌
    selectMarker(markerId) {
        console.log('selectMarker 被調用，markerId:', markerId);
        this.currentEditingMarkerId = markerId;
        const marker = window.photoMarkerManager.getMarker(markerId);
        
        if (!marker) {
            console.error('找不到標誌，ID:', markerId);
            return;
        }
        
        console.log('找到標誌:', marker.name, '位置:', marker.position);
        
        // 更新座標輸入框
        const xInput = document.getElementById('markerXInput');
        const yInput = document.getElementById('markerYInput');
        const zInput = document.getElementById('markerZInput');
        
        if (xInput && yInput && zInput) {
            if (marker.position) {
                xInput.value = marker.position.x.toFixed(2);
                yInput.value = marker.position.y.toFixed(2);
                zInput.value = marker.position.z.toFixed(2);
            } else {
                xInput.value = '';
                yInput.value = '';
                zInput.value = '';
            }
        } else {
            console.error('找不到座標輸入框');
        }

        // 更新當前標誌名稱顯示
        const currentMarkerName = document.getElementById('currentMarkerName');
        if (currentMarkerName) {
            const displayName = marker.name.replace(/\.(jpg|jpeg|png)$/i, '');
            currentMarkerName.textContent = displayName;
            console.log('更新當前標誌名稱:', displayName);
        } else {
            console.error('找不到 currentMarkerName 元素');
        }
    }

    // 開始選擇位置
    startSelectPosition() {
        if (!this.currentEditingMarkerId) {
            alert('請先選擇一個標誌');
            return;
        }

        if (!window.map3D) {
            alert('地圖尚未初始化');
            return;
        }

        const modal = document.getElementById('markerPositionEditorModal');
        if (modal) {
            modal.classList.add('selecting-position');
        }

        // 啟用選擇位置模式
        window.map3D.startSelectPosition((point) => {
            // 位置已選擇
            const position = {
                x: point.x,
                y: point.y,
                z: point.z
            };

            // 更新座標輸入框
            const xInput = document.getElementById('markerXInput');
            const yInput = document.getElementById('markerYInput');
            const zInput = document.getElementById('markerZInput');
            
            if (xInput && yInput && zInput) {
                xInput.value = position.x.toFixed(2);
                yInput.value = position.y.toFixed(2);
                zInput.value = position.z.toFixed(2);
            }

            // 保存位置
            this.savePosition(position);

            // 移除選擇位置模式樣式
            if (modal) {
                modal.classList.remove('selecting-position');
            }

            // 顯示成功提示
            this.showMessage('位置已設定！', 'success');
        });

        // 顯示提示
        this.showMessage('請點擊 3D 地圖上的位置來設定標誌座標', 'info');
    }

    // 保存手動輸入的位置
    saveManualPosition() {
        if (!this.currentEditingMarkerId) {
            alert('請先選擇一個標誌');
            return;
        }

        const xInput = document.getElementById('markerXInput');
        const yInput = document.getElementById('markerYInput');
        const zInput = document.getElementById('markerZInput');

        if (!xInput || !yInput || !zInput) {
            alert('找不到座標輸入框');
            return;
        }

        const x = parseFloat(xInput.value);
        const y = parseFloat(yInput.value);
        const z = parseFloat(zInput.value);

        if (isNaN(x) || isNaN(y) || isNaN(z)) {
            alert('請輸入有效的座標數值');
            return;
        }

        const position = { x, y, z };
        this.savePosition(position);
        this.showMessage('位置已儲存！', 'success');
    }

    // 保存位置
    savePosition(position) {
        if (!this.currentEditingMarkerId) return;

        // 更新標誌管理器中的位置
        window.photoMarkerManager.updateMarkerPosition(this.currentEditingMarkerId, position);

        // 如果標誌已存在於地圖上，更新它；否則創建新的
        if (!window.map3D) {
            console.error('map3D 尚未初始化');
            return;
        }

        const existingMarker = window.map3D.photoMarkers.find(m => m.id === this.currentEditingMarkerId);
        if (existingMarker) {
            // 更新現有標誌位置
            existingMarker.group.position.set(position.x, position.y, position.z);
        } else {
            // 創建新標誌
            const marker = window.photoMarkerManager.getMarker(this.currentEditingMarkerId);
            if (marker) {
                window.map3D.addPhotoMarker(marker);
            }
        }

        // 更新列表
        this.updateMarkerList();
    }

    // 顯示訊息
    showMessage(text, type = 'info') {
        const message = document.createElement('div');
        message.textContent = text;
        message.style.cssText = `
            position: fixed;
            top: 20px;
            ${type === 'info' ? 'left: 50%; transform: translateX(-50%);' : 'right: 20px;'}
            background: ${type === 'success' ? '#28a745' : '#2196F3'};
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 14px;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(message);
        setTimeout(() => {
            message.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => message.remove(), 300);
        }, 3000);
    }
}

// 初始化編輯器
let photoMarkerEditor = null;
let isInitializing = false;
let initAttempts = 0;
const maxInitAttempts = 50;

function initPhotoMarkerEditor() {
    // 防止重複初始化
    if (photoMarkerEditor || isInitializing) {
        return;
    }

    isInitializing = true;
    initAttempts++;

    // 確保 DOM 已載入
    if (document.readyState === 'loading') {
        isInitializing = false;
        document.addEventListener('DOMContentLoaded', initPhotoMarkerEditor);
        return;
    }

    // 檢查按鈕是否存在
    const setupBtn = document.getElementById('setupMarkerPosBtn');
    if (!setupBtn) {
        console.warn(`找不到 setupMarkerPosBtn 按鈕，延遲初始化 (嘗試 ${initAttempts}/${maxInitAttempts})`);
        isInitializing = false;
        if (initAttempts < maxInitAttempts) {
            setTimeout(initPhotoMarkerEditor, 100);
        } else {
            console.error('初始化失敗：超過最大嘗試次數');
        }
        return;
    }

    // 檢查 photoMarkerManager 是否已初始化
    if (!window.photoMarkerManager) {
        console.warn(`photoMarkerManager 尚未初始化，延遲初始化 (嘗試 ${initAttempts}/${maxInitAttempts})`);
        isInitializing = false;
        if (initAttempts < maxInitAttempts) {
            setTimeout(initPhotoMarkerEditor, 100);
        } else {
            console.error('初始化失敗：photoMarkerManager 未初始化');
        }
        return;
    }

    // 初始化編輯器
    try {
        photoMarkerEditor = new PhotoMarkerEditor();
        window.photoMarkerEditor = photoMarkerEditor; // 設置為全域變數
        console.log('PhotoMarkerEditor 初始化完成');
        isInitializing = false;
    } catch (error) {
        console.error('PhotoMarkerEditor 初始化失敗:', error);
        isInitializing = false;
    }
}

// 立即嘗試初始化（如果 DOM 已載入）
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initPhotoMarkerEditor();
} else {
    document.addEventListener('DOMContentLoaded', initPhotoMarkerEditor);
}

