# 師大附中 3D 校園地圖

一個互動式的 3D 校園地圖系統，可以為建築物和地標添加簡介和照片。

## 功能特色

- 🗺️ **3D 地圖顯示**：載入並顯示 STL 格式的 3D 地圖模型
- 📍 **地標標記**：在地圖上添加標記點，標示重要建築物或地標
- 📝 **簡介功能**：為每個地標添加文字簡介
- 📷 **照片展示**：為每個地標上傳並顯示照片
- 💾 **資料儲存**：所有地標資料自動儲存在瀏覽器本地
- 🎨 **互動操作**：滑鼠拖曳旋轉、滾輪縮放、點擊查看詳情

## 檔案結構

```
map/
├── index.html          # 主頁面
├── css/
│   └── styles.css      # 樣式檔案
├── js/
│   ├── data.js         # 資料管理系統
│   ├── map3d.js        # 3D 地圖核心功能
│   ├── model-loader.js # 模型載入器
│   ├── marker-editor.js # 標記編輯器
│   ├── map-search.js   # 地圖搜尋功能
│   └── street-view.js  # 街景模式
├── models/
│   ├── building.obj    # 建築物模型
│   ├── building.mtl    # 建築物材質
│   ├── building name.obj # 建築名稱模型
│   ├── building name.mtl # 建築名稱材質
│   ├── ground.obj      # 地面模型
│   └── ground.mtl      # 地面材質
├── images/             # 地標圖片
├── docs/               # 文件資料夾
└── README.md           # 說明文件
```

## 使用方式

### 1. 基本操作

- **旋轉地圖**：按住滑鼠左鍵拖曳
- **縮放地圖**：使用滑鼠滾輪
- **查看地標**：點擊地圖上的紅色標記點
- **重置視角**：點擊「重置視角」按鈕

### 2. 添加地標

1. 點擊「添加地標」按鈕
2. 填寫地標名稱和簡介
3. （可選）上傳地標照片
4. 點擊「在地圖上選擇位置」，然後點擊 3D 地圖上的位置
5. 點擊「儲存」完成添加

### 3. 編輯地標

1. 點擊地圖上的標記點或側邊欄的地標項目
2. 在資訊面板中點擊「編輯」按鈕
3. 修改名稱、簡介或照片
4. 點擊「儲存」完成編輯

### 4. 刪除地標

1. 點擊要刪除的地標
2. 在資訊面板中點擊「刪除」按鈕
3. 確認刪除

## 技術說明

### 使用的技術

- **Three.js**：3D 圖形渲染
- **STL Loader**：載入 STL 格式的 3D 模型
- **LocalStorage**：本地資料儲存

### 瀏覽器相容性

- Chrome/Edge（推薦）
- Firefox
- Safari

### 注意事項

1. **模型檔案**：確保模型檔案（.obj 和 .mtl）位於 `models/` 目錄中
2. **圖片格式**：支援 JPG、PNG、GIF、WebP，檔案大小建議小於 5MB
3. **資料儲存**：所有資料儲存在瀏覽器本地，清除瀏覽器資料會遺失所有地標

## 自訂設定

### 調整地圖大小

在 `js/map3d.js` 的模型載入函數中，可以調整以下參數：

```javascript
const scale = 50 / maxDim; // 調整這個值來控制地圖大小
```

### 調整標記顏色

在 `js/map3d.js` 的 `addMarker()` 函數中，可以修改標記顏色：

```javascript
const markerMaterial = new THREE.MeshPhongMaterial({
    color: 0xff6b6b, // 修改這個顏色值
    emissive: 0xff6b6b,
    emissiveIntensity: 0.5
});
```

## 開發說明

### 資料格式

地標資料儲存在 LocalStorage 中，格式如下：

```json
{
  "id": "唯一識別碼",
  "name": "地標名稱",
  "description": "地標簡介",
  "position": {
    "x": 0,
    "y": 0,
    "z": 0
  },
  "imageData": "base64 編碼的圖片資料"
}
```

### 擴展功能

可以透過修改以下檔案來擴展功能：

- `js/data.js`：添加資料匯入/匯出功能
- `js/map3d.js`：添加更多 3D 互動效果
- `js/marker-editor.js`：添加更多編輯選項

## 授權

本專案僅供教學使用。








