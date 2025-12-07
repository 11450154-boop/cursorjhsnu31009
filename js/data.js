// 地標資料管理系統
class MarkerDataManager {
    constructor() {
        this.markers = [];
        this.loadFromStorage();
    }

    // 添加地標
    addMarker(marker) {
        if (!marker.id) {
            marker.id = Date.now().toString();
        }
        this.markers.push(marker);
        this.saveToStorage();
        return marker;
    }

    // 更新地標
    updateMarker(id, updates) {
        const index = this.markers.findIndex(m => m.id === id);
        if (index !== -1) {
            this.markers[index] = { ...this.markers[index], ...updates };
            this.saveToStorage();
            return this.markers[index];
        }
        return null;
    }

    // 刪除地標
    deleteMarker(id) {
        const index = this.markers.findIndex(m => m.id === id);
        if (index !== -1) {
            const marker = this.markers[index];
            this.markers.splice(index, 1);
            this.saveToStorage();
            return marker;
        }
        return null;
    }

    // 取得所有地標
    getAllMarkers() {
        return this.markers;
    }

    // 根據 ID 取得地標
    getMarker(id) {
        return this.markers.find(m => m.id === id);
    }

    // 儲存到本地儲存
    saveToStorage() {
        try {
            const dataToSave = this.markers.map(marker => ({
                id: marker.id,
                name: marker.name,
                description: marker.description,
                position: marker.position,
                imageData: marker.imageData // 儲存 base64 圖片
            }));
            
            const jsonString = JSON.stringify(dataToSave);
            const sizeInMB = new Blob([jsonString]).size / (1024 * 1024);
            
            // 檢查大小（localStorage 通常限制約 5-10MB）
            if (sizeInMB > 8) {
                console.warn(`資料大小 ${sizeInMB.toFixed(2)}MB，接近 localStorage 限制，建議匯出備份`);
            }
            
            localStorage.setItem('mapMarkers', jsonString);
            console.log(`已儲存 ${this.markers.length} 個地標到 localStorage (${sizeInMB.toFixed(2)}MB)`);
        } catch (e) {
            console.error('儲存資料失敗:', e);
            if (e.name === 'QuotaExceededError') {
                alert('儲存空間不足！\n\n請使用「匯出地標」功能將資料儲存到檔案，或刪除一些地標圖片以減少資料大小。');
            } else {
                alert('儲存失敗：' + e.message);
            }
        }
    }

    // 從本地儲存載入
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('mapMarkers');
            if (saved) {
                this.markers = JSON.parse(saved);
                console.log(`已從 localStorage 載入 ${this.markers.length} 個地標`);
                
                // 驗證資料完整性
                if (!Array.isArray(this.markers)) {
                    console.warn('載入的資料格式不正確，重置為空陣列');
                    this.markers = [];
                    this.saveToStorage();
                }
            }
        } catch (e) {
            console.error('載入資料失敗:', e);
            this.markers = [];
            // 如果載入失敗，清除損壞的資料
            try {
                localStorage.removeItem('mapMarkers');
            } catch (clearError) {
                console.error('清除損壞資料失敗:', clearError);
            }
        }
    }

    // 清除所有資料
    clearAll() {
        this.markers = [];
        this.saveToStorage();
    }

    // 匯出資料
    exportData() {
        const dataStr = JSON.stringify(this.markers, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'map-markers.json';
        link.click();
        URL.revokeObjectURL(url);
    }

    // 匯入資料
    importData(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            if (Array.isArray(data)) {
                this.markers = data;
                this.saveToStorage();
                return true;
            }
            return false;
        } catch (e) {
            console.error('匯入資料失敗:', e);
            return false;
        }
    }
}

// 圖片處理工具
class ImageUtils {
    // 將檔案轉換為 base64
    static fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // 驗證圖片檔案
    static validateImage(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            return { valid: false, error: '不支援的圖片格式，請使用 JPG、PNG、GIF 或 WebP' };
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB
            return { valid: false, error: '圖片檔案太大，請使用小於 5MB 的圖片' };
        }
        return { valid: true };
    }
}

// 建立全域資料管理器實例
const markerDataManager = new MarkerDataManager();







