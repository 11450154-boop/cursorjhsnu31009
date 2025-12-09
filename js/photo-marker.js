// 圖片標誌管理系統
class PhotoMarkerManager {
    constructor() {
        this.markers = [];
        this.imageExtensions = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG'];
        this.loadFromStorage();
        this.scanImages();
    }

    // 掃描圖片檔案
    scanImages() {
        // 定義已知的圖片檔案列表（因為瀏覽器無法直接掃描資料夾）
        const knownImages = [
            '中正樓.jpg',
            '中興堂.jpg',
            '南樓.jpg',
            '司令台.jpg',
            '國中部.jpg',
            '圖書館.jpg',
            '技藝館.jpg',
            '操場.jpg',
            '新北樓.jpg',
            '東樓.jpg',
            '校門.jpg',
            '樂教館.jpg',
            '淡水信義線第二出口.jpeg',
            '舊北樓.jpg',
            '西樓.jpg',
            '體育教學館.jpg',
            '體育館.jpg'
        ];

        knownImages.forEach(imageName => {
            // 檢查是否已存在（根據名稱匹配）
            const existing = this.markers.find(m => m.name === imageName);
            if (!existing) {
                const marker = {
                    id: this.generateId(imageName),
                    name: imageName,
                    imagePath: imageName,
                    position: null // 初始位置為 null，不顯示在地圖上
                };
                this.markers.push(marker);
            } else {
                // 如果已存在但 ID 可能已改變，更新 ID（保留位置資料）
                const newId = this.generateId(imageName);
                if (existing.id !== newId) {
                    console.log(`更新標誌 ID: ${existing.name} 從 ${existing.id} 改為 ${newId}`);
                    existing.id = newId;
                }
            }
        });

        this.saveToStorage();
    }

    // 生成唯一 ID（使用檔名確保唯一性）
    generateId(name) {
        // 使用檔名的 hash 值來生成唯一 ID
        // 簡單的 hash 函數
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            const char = name.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 轉換為 32 位整數
        }
        // 將負數轉為正數並轉為 16 進位
        const hashStr = Math.abs(hash).toString(16);
        return 'photo_' + hashStr;
    }

    // 取得所有標誌
    getAllMarkers() {
        return this.markers;
    }

    // 根據 ID 取得標誌
    getMarker(id) {
        return this.markers.find(m => m.id === id);
    }

    // 更新標誌位置
    updateMarkerPosition(id, position) {
        const marker = this.markers.find(m => m.id === id);
        if (marker) {
            marker.position = position;
            this.saveToStorage();
            return true;
        }
        return false;
    }

    // 儲存到本地儲存
    saveToStorage() {
        try {
            const dataToSave = this.markers.map(marker => ({
                id: marker.id,
                name: marker.name,
                imagePath: marker.imagePath,
                position: marker.position
            }));
            
            const jsonStr = JSON.stringify(dataToSave);
            localStorage.setItem('photoMarkers', jsonStr);
            console.log(`已儲存 ${this.markers.length} 個圖片標誌到 localStorage`);
            
            // 驗證儲存是否成功
            const saved = localStorage.getItem('photoMarkers');
            if (saved === jsonStr) {
                console.log('✓ 儲存驗證成功');
            } else {
                console.warn('⚠ 儲存驗證失敗，可能 LocalStorage 空間不足或被禁用');
                alert('警告：資料可能未正確儲存。請檢查瀏覽器設定或清除部分資料。');
            }
        } catch (e) {
            console.error('儲存標誌資料失敗:', e);
            if (e.name === 'QuotaExceededError') {
                alert('錯誤：LocalStorage 空間不足。請清除部分瀏覽器資料或使用匯出功能備份資料。');
            } else {
                alert('儲存失敗：' + e.message);
            }
        }
    }

    // 從本地儲存載入
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('photoMarkers');
            if (saved) {
                const data = JSON.parse(saved);
                // 遷移舊的 ID 到新的 ID 格式
                this.markers = data.map(marker => {
                    const newId = this.generateId(marker.name);
                    if (marker.id !== newId) {
                        console.log(`遷移標誌 ID: ${marker.name} 從 ${marker.id} 改為 ${newId}`);
                        marker.id = newId;
                    }
                    return marker;
                });
                console.log(`已從 localStorage 載入 ${this.markers.length} 個圖片標誌`);
            }
        } catch (e) {
            console.error('載入標誌資料失敗:', e);
            this.markers = [];
        }
    }
}

// 建立全域標誌管理器實例
const photoMarkerManager = new PhotoMarkerManager();
window.photoMarkerManager = photoMarkerManager; // 設置為全域變數

