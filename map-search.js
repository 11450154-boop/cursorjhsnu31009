// 地標搜尋（模仿 Google Maps 上方搜尋列）

class MapSearch {
    constructor() {
        this.input = document.getElementById('searchInput');
        this.resultsContainer = document.getElementById('searchResults');
        this.activeIndex = -1; // 鍵盤上下選取用

        if (!this.input || !this.resultsContainer) return;

        this.bindEvents();
    }

    bindEvents() {
        this.input.addEventListener('input', () => {
            this.activeIndex = -1;
            this.updateResults();
        });

        this.input.addEventListener('keydown', (e) => {
            const items = Array.from(this.resultsContainer.querySelectorAll('.search-result-item'));
            if (!items.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.activeIndex = (this.activeIndex + 1) % items.length;
                this.refreshActive(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.activeIndex = (this.activeIndex - 1 + items.length) % items.length;
                this.refreshActive(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (this.activeIndex >= 0 && this.activeIndex < items.length) {
                    items[this.activeIndex].click();
                } else if (items.length > 0) {
                    items[0].click();
                }
            } else if (e.key === 'Escape') {
                this.clearResults();
                this.input.blur();
            }
        });

        // 點擊外部時關閉結果清單
        document.addEventListener('click', (e) => {
            if (!this.resultsContainer.contains(e.target) && e.target !== this.input) {
                this.clearResults();
            }
        });
    }

    getMarkers() {
        if (!window.markerDataManager) return [];
        return markerDataManager.getAllMarkers() || [];
    }

    updateResults() {
        const query = this.input.value.trim().toLowerCase();
        const markers = this.getMarkers();

        this.resultsContainer.innerHTML = '';

        if (!query || !markers.length) {
            this.resultsContainer.style.display = 'none';
            return;
        }

        const matched = markers
            .filter(m => {
                const name = (m.name || '').toLowerCase();
                const desc = (m.description || '').toLowerCase();
                return name.includes(query) || desc.includes(query);
            })
            .slice(0, 8); // 最多顯示 8 筆

        if (!matched.length) {
            this.resultsContainer.style.display = 'none';
            return;
        }

        matched.forEach(marker => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
                <div class="search-result-name">${marker.name}</div>
                <div class="search-result-desc">${marker.description || '無簡介'}</div>
            `;

            item.addEventListener('click', () => {
                this.handleSelect(marker);
            });

            this.resultsContainer.appendChild(item);
        });

        this.resultsContainer.style.display = 'block';
    }

    refreshActive(items) {
        items.forEach((el, idx) => {
            if (idx === this.activeIndex) {
                el.classList.add('active');
                el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('active');
            }
        });
    }

    handleSelect(marker) {
        this.input.value = marker.name || '';
        this.clearResults();

        if (window.map3D && marker.id) {
            map3D.onMarkerClick(marker.id);
        }
    }

    clearResults() {
        this.resultsContainer.innerHTML = '';
        this.resultsContainer.style.display = 'none';
        this.activeIndex = -1;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 等待 markerDataManager 初始化完成後再啟動搜尋
    function initWhenReady(attempts = 0) {
        if (window.markerDataManager || attempts > 50) {
            new MapSearch();
        } else {
            setTimeout(() => initWhenReady(attempts + 1), 100);
        }
    }

    initWhenReady();
});







