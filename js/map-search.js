// 地圖搜尋功能
class MapSearch {
    constructor() {
        this.searchInput = document.getElementById('searchInput');
        this.searchResults = document.getElementById('searchResults');
        this.currentResults = [];
        this.selectedIndex = -1;
        this.init();
    }

    init() {
        if (!this.searchInput || !this.searchResults) {
            console.warn('搜尋框元素不存在');
            return;
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // 輸入事件 - 即時搜尋
        this.searchInput.addEventListener('input', (e) => {
            this.performSearch(e.target.value);
        });

        // 聚焦時顯示結果
        this.searchInput.addEventListener('focus', () => {
            if (this.currentResults.length > 0) {
                this.searchResults.classList.remove('hidden');
            }
        });

        // 點擊外部時隱藏結果
        document.addEventListener('click', (e) => {
            if (!this.searchInput.contains(e.target) && !this.searchResults.contains(e.target)) {
                this.hideResults();
            }
        });

        // 鍵盤導航
        this.searchInput.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
    }

    // 執行搜尋
    performSearch(query) {
        if (!query || query.trim() === '') {
            this.hideResults();
            return;
        }

        const searchTerm = query.trim().toLowerCase();
        
        // 獲取所有標誌
        if (!window.photoMarkerManager) {
            console.warn('photoMarkerManager 尚未初始化');
            return;
        }

        const markers = window.photoMarkerManager.getAllMarkers();
        
        // 過濾標誌（只搜尋有位置的標誌）
        this.currentResults = markers
            .filter(marker => marker.position !== null)
            .filter(marker => {
                const name = marker.name.replace(/\.(jpg|jpeg|png)$/i, '').toLowerCase();
                return name.includes(searchTerm);
            })
            .slice(0, 10); // 最多顯示 10 個結果

        this.selectedIndex = -1;
        this.displayResults();
    }

    // 顯示搜尋結果
    displayResults() {
        if (this.currentResults.length === 0) {
            this.searchResults.innerHTML = '<div class="search-result-item no-results">找不到符合的地點</div>';
            this.searchResults.classList.remove('hidden');
            return;
        }

        this.searchResults.innerHTML = '';
        this.currentResults.forEach((marker, index) => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            if (index === this.selectedIndex) {
                item.classList.add('selected');
            }
            
            const displayName = marker.name.replace(/\.(jpg|jpeg|png)$/i, '');
            item.textContent = displayName;
            
            item.addEventListener('click', () => {
                this.selectMarker(marker);
            });

            item.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });

            this.searchResults.appendChild(item);
        });

        this.searchResults.classList.remove('hidden');
    }

    // 更新選中狀態
    updateSelection() {
        const items = this.searchResults.querySelectorAll('.search-result-item');
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }

    // 處理鍵盤事件
    handleKeyDown(e) {
        if (this.currentResults.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentResults.length - 1);
                this.updateSelection();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.updateSelection();
                break;
            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && this.selectedIndex < this.currentResults.length) {
                    this.selectMarker(this.currentResults[this.selectedIndex]);
                } else if (this.currentResults.length > 0) {
                    // 如果沒有選中，選擇第一個
                    this.selectMarker(this.currentResults[0]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                this.hideResults();
                this.searchInput.blur();
                break;
        }
    }

    // 選擇標誌
    selectMarker(marker) {
        if (!window.map3D) {
            console.warn('map3D 尚未初始化');
            return;
        }

        // 找到對應的標誌物件
        const markerObj = window.map3D.photoMarkers.find(m => m.id === marker.id);
        if (markerObj) {
            // 點擊標誌（顯示資訊面板並移動相機）
            window.map3D.onPhotoMarkerClick(marker.id);
        } else {
            console.warn('找不到標誌物件:', marker.name);
        }

        // 隱藏搜尋結果
        this.hideResults();
        this.searchInput.value = '';
    }

    // 隱藏搜尋結果
    hideResults() {
        this.searchResults.classList.add('hidden');
        this.selectedIndex = -1;
    }
}

// 初始化搜尋功能
let mapSearch = null;

function initMapSearch() {
    if (mapSearch) return;

    // 確保 DOM 已載入
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMapSearch);
        return;
    }

    try {
        mapSearch = new MapSearch();
        window.mapSearch = mapSearch; // 設置為全域變數
        console.log('MapSearch 初始化完成');
    } catch (error) {
        console.error('MapSearch 初始化失敗:', error);
    }
}

// 立即嘗試初始化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initMapSearch();
} else {
    document.addEventListener('DOMContentLoaded', initMapSearch);
}

