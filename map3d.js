// 3D 地圖核心功能
class Map3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.mapModel = null;
        this.mapModels = {}; // 儲存多個模型：{ building: obj, ground: obj, buildingName: obj }
        this.photoMarkers = []; // 儲存圖片標誌物件
        this.currentPhotoMarkerId = null; // 當前選中的圖片標誌 ID
        this.isSelectingPosition = false; // 是否正在選擇位置
        this.selectPositionCallback = null; // 位置選擇回調函數
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        // 縮放速度係數（數字越大縮放越快）
        this.zoomSpeed = 0.3; // 調整為更舒適的縮放速度
        // 鏡頭平移動畫狀態（用來做類似 Google Map 的平滑移動）
        this.cameraAnimation = null;
        // 街景模式狀態（用於禁用滑鼠控制）
        this.isStreetViewMode = false;
        
        this.init();
        this.setupEventListeners();
        this.loadModel();
    }

    init() {
        // 檢查容器是否存在
        if (!this.container) {
            console.error('找不到容器元素:', this.container);
            alert('找不到地圖容器！請確認 HTML 中有 id="canvas-container" 的元素');
            return;
        }

        // 創建場景
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a1a);

        // 創建相機
        const width = this.container.clientWidth || 800;
        const height = this.container.clientHeight || 600;
        
        if (width === 0 || height === 0) {
            console.warn('容器大小為 0，使用預設大小');
        }
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(0, 50, 100);
        // 設定相機的預設旋轉角度（向下看，不看向特定點）
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = 0; // 水平角度
        this.camera.rotation.x = -0.5; // 向下傾斜約 30 度

        // 創建渲染器
        try {
            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setSize(width, height);
            this.renderer.shadowMap.enabled = true;
            // 設定線條渲染（讓邊框更細）
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.container.appendChild(this.renderer.domElement);
            console.log('渲染器創建成功，容器大小:', width, 'x', height);
        } catch (error) {
            console.error('創建渲染器失敗:', error);
            alert('無法創建 3D 渲染器：' + error.message);
            return;
        }

        // 添加光源
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 50, 50);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // 座標軸輔助線已移除（避免畫面太雜亂）

        // 處理視窗大小變化
        window.addEventListener('resize', () => this.onWindowResize());

        // 開始動畫循環
        console.log('開始動畫循環...');
        this.animate();
    }

    // 載入模型（支援多種格式，可同時載入多個模型）
    loadModel(fallbackIndex = 0) {
        // 等待 Three.js 載入
        if (typeof THREE === 'undefined') {
            console.log('等待 Three.js 載入...');
            setTimeout(() => this.loadModel(fallbackIndex), 100);
            return;
        }
        
        // 檢查是否在 file:// 協議下運行（會有 CORS 限制）
        if (window.location.protocol === 'file:') {
            alert('⚠️ 檢測到使用 file:// 協議開啟\n\n為了正常載入模型檔案，建議使用本地伺服器：\n\n方法 1：使用 Python\n  python -m http.server 8000\n  然後訪問 http://localhost:8000\n\n方法 2：使用 VS Code Live Server 擴充功能\n\n方法 3：使用 Node.js http-server\n  npx http-server\n\n點擊確定後仍會嘗試載入，但可能會失敗。');
        }
        
        if (!this.modelLoader) {
            this.modelLoader = new ModelLoader(this);
        }
        
        // 載入所有模型檔案
        this.loadAllModels();
    }
    
    // 載入所有模型檔案
    loadAllModels() {
        const modelsToLoad = [
            { path: 'building.obj', type: 'building', name: '建築物' },
            { path: 'ground.obj', type: 'ground', name: '地板' },
            { path: 'building name.obj', type: 'buildingName', name: '建築名稱' }
        ];
        
        let loadedCount = 0;
        const totalModels = modelsToLoad.length;
        const rawModels = []; // 儲存未處理的原始模型
        
        modelsToLoad.forEach(({ path, type, name }) => {
            this.modelLoader.loadModelWithType(path, type, (rawModel) => {
                rawModels.push({ model: rawModel, type, name });
                loadedCount++;
                console.log(`已載入 ${name} (${loadedCount}/${totalModels})`);
                
                // 如果所有模型都載入完成，統一處理所有模型
                if (loadedCount === totalModels) {
                    this.processAllModelsTogether(rawModels);
                    this.adjustCameraForAllModels();
                    this.onModelLoaded();
                }
            }, (error) => {
                console.warn(`載入 ${name} 失敗:`, error);
                loadedCount++;
                // 即使失敗也繼續，不影響其他模型
                if (loadedCount === totalModels) {
                    if (rawModels.length > 0) {
                        this.processAllModelsTogether(rawModels);
                    }
                    this.adjustCameraForAllModels();
                    this.onModelLoaded();
                }
            });
        });
    }
    
    // 統一處理所有模型，保持它們的原始相對位置
    processAllModelsTogether(rawModels) {
        if (rawModels.length === 0) return;
        
        // 步驟1：計算所有模型的整體邊界（在變換之前）
        const overallBox = new THREE.Box3();
        rawModels.forEach(({ model }) => {
            if (model) {
                overallBox.expandByObject(model);
            }
        });
        
        const overallSize = overallBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(overallSize.x, overallSize.z);
        const targetSize = 180;
        const scale = targetSize / maxDim;
        
        // 步驟2：記錄每個模型的原始位置（在變換之前）
        const modelData = [];
        rawModels.forEach(({ model, type, name }) => {
            if (!model) return;
            
            // 記錄原始位置（模型物件的世界位置）
            const originalPosition = model.position.clone();
            
            modelData.push({ model, type, name, originalPosition });
        });
        
        // 步驟3：統一處理每個模型，保持原始相對位置
        modelData.forEach(({ model, type, name, originalPosition }) => {
            if (!model) return;
            
            // 設定陰影
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            // 旋轉模型（繞 X 軸 -90 度，讓 Y 軸朝上）
            // 注意：旋轉是繞著模型的原點（0,0,0），不是世界原點
            model.rotateX(-Math.PI / 2);
            
            // 縮放模型（相對於模型原點）
            model.scale.set(scale, scale, scale);
            
            // 計算旋轉後的原始位置
            // 旋轉會改變座標：X->X, Y->Z, Z->-Y
            // 所以 originalPosition(x, y, z) 旋轉後變成 (x, -z, y)
            const rotatedPosition = new THREE.Vector3(
                originalPosition.x * scale,
                -originalPosition.z * scale,  // Y 軸（向上）
                originalPosition.y * scale     // Z 軸
            );
            
            // 保持旋轉後的原始位置
            model.position.copy(rotatedPosition);
            
            // 儲存到 mapModels
            model.userData = { type: 'map', modelType: type };
            this.mapModels[type] = model;
            this.scene.add(model);
            
            console.log(`${name} 處理完成，原始位置:`, originalPosition, '旋轉後位置:', model.position);
            
            // 為建築物添加黑色邊緣線（在所有變換完成並添加到場景之後）
            if (type === 'building' || type === 'buildingName') {
                // 使用 setTimeout 確保模型完全載入後再添加邊緣線
                setTimeout(() => {
                    model.traverse((child) => {
                        if (child.isMesh) {
                            console.log('為建築物添加邊緣線:', child, '類型:', type);
                            this.addEdgeLines(child);
                        }
                    });
                }, 100);
            }
        });
    }
    
    // 為網格添加黑色邊緣線
    addEdgeLines(mesh) {
        if (!mesh.geometry) {
            console.warn('網格沒有幾何體');
            return;
        }
        
        try {
            // 確保網格的矩陣世界已更新
            mesh.updateMatrixWorld(true);
            
            // 克隆幾何體以避免修改原始幾何體
            const geometry = mesh.geometry.clone();
            
            // 確保幾何體有索引
            if (!geometry.index) {
                console.warn('幾何體沒有索引，嘗試計算...');
                geometry.computeVertexNormals();
            }
            
            // 創建邊緣幾何體（角度閾值設為1度，顯示所有邊緣）
            const edges = new THREE.EdgesGeometry(geometry, 1);
            
            // 檢查邊緣幾何體是否有效
            if (!edges.attributes || !edges.attributes.position) {
                console.warn('邊緣幾何體無效');
                return;
            }
            
            // 創建邊緣線材質（黑色邊框，細線）
            const edgeMaterial = new THREE.LineBasicMaterial({
                color: 0x000000, // 黑色邊框
                linewidth: 1,    // 線條寬度（WebGL 限制，大多數瀏覽器只支援 1）
                depthTest: true,
                depthWrite: true,
                transparent: true,  // 使用透明以獲得更細的視覺效果
                opacity: 0.8        // 稍微降低不透明度，讓邊框看起來更細
            });
            
            // 創建邊緣線物件
            const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
            
            // 將邊緣線作為原始網格的子物件，這樣會自動跟隨變換
            mesh.add(edgeLines);
            
            // 儲存邊緣線引用，以便後續管理
            if (!mesh.userData) {
                mesh.userData = {};
            }
            mesh.userData.edgeLines = edgeLines;
            
            const edgeCount = edges.attributes.position.count / 2;
            console.log('✓ 已為網格添加邊緣線，邊緣數量:', edgeCount, '網格位置:', mesh.position);
            
            // 強制更新矩陣
            mesh.updateMatrixWorld(true);
            edgeLines.updateMatrixWorld(true);
            
        } catch (error) {
            console.error('✗ 添加邊緣線失敗:', error, '網格:', mesh);
        }
    }
    
    // 為所有模型調整相機位置
    adjustCameraForAllModels() {
        // 計算所有模型的邊界
        const box = new THREE.Box3();
        let hasModels = false;
        
        Object.values(this.mapModels).forEach(model => {
            if (model) {
                box.expandByObject(model);
                hasModels = true;
            }
        });
        
        if (!hasModels) return;
        
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z);
        const distance = maxSize * 0.6; // 調遠視角（改為 0.6 倍）
        
        this.camera.position.set(
            center.x,
            center.y + maxSize * 0.1, // 保持高度不變
            center.z + distance
        );
        // 不強制看向中心，設定相機的固定角度
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = 0; // 水平角度
        this.camera.rotation.x = -0.5; // 向下傾斜約 30 度
    }
    
    // 控制模型的顯示/隱藏（用於街景模式）
    setModelVisibility(type, visible) {
        if (this.mapModels[type]) {
            this.mapModels[type].visible = visible;
        }
    }
    
    // 設定街景模式的模型顯示狀態
    setStreetViewMode(isStreetView) {
        this.isStreetViewMode = isStreetView;
        if (isStreetView) {
            // 街景模式：只顯示建築物和地板
            this.setModelVisibility('building', true);
            this.setModelVisibility('ground', true);
            this.setModelVisibility('buildingName', false);
        } else {
            // 正常模式：顯示所有模型
            this.setModelVisibility('building', true);
            this.setModelVisibility('ground', true);
            this.setModelVisibility('buildingName', true);
        }
    }
    
    // 處理模型載入錯誤，嘗試下一個檔案
    handleModelLoadError(failedPath, currentIndex) {
        const defaultModels = [
            'building.obj',
            'building name.obj',
            'ground.obj'
        ];
        
        const nextIndex = currentIndex + 1;
        if (nextIndex < defaultModels.length) {
            console.log(`檔案 ${failedPath} 載入失敗，嘗試下一個檔案: ${defaultModels[nextIndex]}`);
            setTimeout(() => {
                this.loadModel(nextIndex);
            }, 500);
        } else {
            console.error('所有預設模型檔案都無法載入');
            alert('無法載入模型檔案！\n\n請確認：\n1. 模型檔案存在於專案目錄中\n2. 使用本地伺服器開啟（不要直接用 file:// 開啟）\n3. 可以在瀏覽器控制台（F12）執行：\n   map3D.setModelPath("你的檔案名稱.obj")');
        }
    }

    // 取得模型檔案路徑（可自動檢測或手動指定）
    getModelPath(fallbackIndex = 0) {
        // 優先順序：GLTF > OBJ > STL
        // 如果存在 GLTF/GLB 檔案，優先使用（支援完整紋理）
        // 如果存在 OBJ 檔案，使用 OBJ（支援紋理）
        // 否則使用 STL（僅支援頂點顏色）
        
        // 可以透過 localStorage 儲存用戶選擇的檔案
        const savedPath = localStorage.getItem('mapModelPath');
        if (savedPath) {
            return savedPath;
        }
        
        // 預設嘗試載入的檔案（按優先順序）
        const defaultModels = [
            'building.obj',      // 主要建築模型
            'building name.obj', // 建築名稱模型
            'ground.obj'         // 地面模型
        ];
        
        // 根據回退索引返回對應的模型
        if (fallbackIndex < defaultModels.length) {
            return defaultModels[fallbackIndex];
        }
        
        // 如果索引超出範圍，返回第一個
        return defaultModels[0];
    }

    // 設定模型檔案路徑（供外部調用）
    setModelPath(path) {
        localStorage.setItem('mapModelPath', path);
        // 清除所有模型
        if (this.mapModel) {
            this.scene.remove(this.mapModel);
            this.mapModel = null;
        }
        // 清除多模型系統
        if (this.mapModels) {
            Object.values(this.mapModels).forEach(model => {
                if (model) this.scene.remove(model);
            });
            this.mapModels = {};
        }
        this.loadModel();
    }

    onModelLoaded() {
        // 模型載入完成後可以執行的操作
        console.log('地圖模型載入完成');
        // 載入所有圖片標誌
        this.loadPhotoMarkers();
    }

    // 載入所有圖片標誌
    loadPhotoMarkers() {
        if (!window.photoMarkerManager) {
            console.warn('photoMarkerManager 尚未初始化');
            return;
        }

        const markers = window.photoMarkerManager.getAllMarkers();
        markers.forEach(markerData => {
            // 只載入有位置的標誌
            if (markerData.position) {
                this.addPhotoMarker(markerData);
            }
        });
        console.log(`已載入 ${markers.filter(m => m.position).length} 個圖片標誌`);
    }

    // 添加圖片標誌
    addPhotoMarker(markerData) {
        const { id, name, imagePath, position } = markerData;
        
        if (!position) {
            console.warn(`標誌 ${name} 沒有位置，跳過`);
            return null;
        }

        // 創建標誌群組
        const markerGroup = new THREE.Group();
        
        // 創建外層球體（帶有發光效果）
        const outerGeometry = new THREE.SphereGeometry(1.2, 16, 16);
        const outerMaterial = new THREE.MeshPhongMaterial({
            color: 0x667eea,
            emissive: 0x667eea,
            emissiveIntensity: 0.4,
            transparent: true,
            opacity: 0.8,
            shininess: 100
        });
        const outerMesh = new THREE.Mesh(outerGeometry, outerMaterial);
        markerGroup.add(outerMesh);

        // 創建內層球體（較小，更亮）
        const innerGeometry = new THREE.SphereGeometry(0.8, 16, 16);
        const innerMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffff,
            emissive: 0x764ba2,
            emissiveIntensity: 0.6,
            transparent: true,
            opacity: 0.9
        });
        const innerMesh = new THREE.Mesh(innerGeometry, innerMaterial);
        markerGroup.add(innerMesh);

        // 創建標籤（顯示圖片名稱，去掉副檔名）
        const displayName = name.replace(/\.(jpg|jpeg|png)$/i, '');
        const sprite = this.createMarkerSprite(displayName);
        sprite.position.set(0, 2.5, 0);
        markerGroup.add(sprite);

        // 設置位置
        markerGroup.position.set(position.x, position.y, position.z);
        markerGroup.userData = { type: 'photoMarker', id, name, imagePath };

        // 添加到場景
        this.scene.add(markerGroup);

        const marker = {
            id,
            group: markerGroup,
            data: markerData
        };

        this.photoMarkers.push(marker);
        return marker;
    }

    // 創建標誌標籤（文字標籤）
    createMarkerSprite(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // 繪製背景
        context.fillStyle = 'rgba(102, 126, 234, 0.9)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // 繪製邊框
        context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        context.lineWidth = 2;
        context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
        
        // 繪製文字
        context.fillStyle = 'white';
        context.font = 'bold 20px Microsoft JhengHei';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(15, 4, 1);
        
        return sprite;
    }

    // 移除圖片標誌
    removePhotoMarker(id) {
        const index = this.photoMarkers.findIndex(m => m.id === id);
        if (index !== -1) {
            const marker = this.photoMarkers[index];
            this.scene.remove(marker.group);
            this.photoMarkers.splice(index, 1);
        }
    }

    // 圖片標誌點擊處理
    onPhotoMarkerClick(markerId) {
        const marker = photoMarkerManager.getMarker(markerId);
        if (!marker) return;

        this.showPhotoInfoPanel(marker);
        this.currentPhotoMarkerId = markerId;

        // 鏡頭平滑移動到該標誌
        const markerObj = this.photoMarkers.find(m => m.id === markerId);
        if (markerObj) {
            this.flyTo(markerObj.group.position);
        }
    }

    // 顯示圖片資訊面板
    showPhotoInfoPanel(marker) {
        const panel = document.getElementById('photoInfoPanel');
        const title = document.getElementById('photoInfoTitle');
        const image = document.getElementById('photoInfoImage');
        const imageContainer = document.getElementById('photoInfoImageContainer');

        if (!panel || !title || !image || !imageContainer) {
            console.warn('資訊面板元素不存在');
            return;
        }

        title.textContent = marker.name.replace(/\.(jpg|jpeg|png)$/i, '');

        // 載入圖片
        image.src = marker.imagePath;
        image.onload = () => {
            imageContainer.style.display = 'block';
        };
        image.onerror = () => {
            console.error('無法載入圖片:', marker.imagePath);
            imageContainer.style.display = 'none';
        };

        panel.classList.remove('hidden');
    }

    // 隱藏圖片資訊面板
    hidePhotoInfoPanel() {
        const panel = document.getElementById('photoInfoPanel');
        if (panel) {
            panel.classList.add('hidden');
        }
        this.currentPhotoMarkerId = null;
    }

    // 開始選擇位置
    startSelectPosition(callback) {
        this.isSelectingPosition = true;
        this.selectPositionCallback = callback;
    }

    // 停止選擇位置
    stopSelectPosition() {
        this.isSelectingPosition = false;
        this.selectPositionCallback = null;
    }

    // 重置視角
    resetView() {
        // 優先使用多模型系統
        if (this.mapModels && Object.keys(this.mapModels).length > 0) {
            const box = new THREE.Box3();
            Object.values(this.mapModels).forEach(model => {
                if (model) box.expandByObject(model);
            });
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxSize = Math.max(size.x, size.y, size.z);
            const distance = maxSize * 0.6; // 調遠視角（改為 0.6 倍）
            
            this.camera.position.set(center.x, center.y + maxSize * 0.1, center.z + distance);
            // 不強制看向中心，設定相機的固定角度
            this.camera.rotation.order = 'YXZ';
            this.camera.rotation.y = 0; // 水平角度
            this.camera.rotation.x = -0.5; // 向下傾斜約 30 度
        } else if (this.mapModel) {
            // 向後兼容單模型系統
            const box = new THREE.Box3().setFromObject(this.mapModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxSize = Math.max(size.x, size.y, size.z);
            const distance = maxSize * 0.6; // 調遠視角（改為 0.6 倍）
            
            this.camera.position.set(center.x, center.y + maxSize * 0.1, center.z + distance);
            // 不強制看向中心，設定相機的固定角度
            this.camera.rotation.order = 'YXZ';
            this.camera.rotation.y = 0; // 水平角度
            this.camera.rotation.x = -0.5; // 向下傾斜約 30 度
        } else {
            this.camera.position.set(0, 50, 100);
            // 設定相機的預設旋轉角度
            this.camera.rotation.order = 'YXZ';
            this.camera.rotation.y = 0;
            this.camera.rotation.x = -0.5; // 向下傾斜
        }
    }

    // 將相機沿目前朝向進行縮放（正值拉近，負值拉遠）
    applyZoom(delta) {
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        this.camera.position.add(direction.multiplyScalar(delta));
    }

    // 視窗大小變化處理
    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    // 設置事件監聽
    setupEventListeners() {
        // 滑鼠控制
        let isRotating = false; // 右鍵旋轉
        let isPanning = false;  // 左鍵平移
        let previousMousePosition = { x: 0, y: 0 };
        let rotationCenter = new THREE.Vector3(0, 0, 0); // 旋轉中心點
        let cameraDistance = 0; // 相機距離中心的距離

        this.renderer.domElement.addEventListener('mousedown', (e) => {
            // 街景模式下禁用滑鼠控制
            if (this.isStreetViewMode) {
                return;
            }

            // 選擇位置模式優先：不處理地圖拖動
            if (this.isSelectingPosition) {
                // 在選擇位置模式下，不啟動地圖拖動
                return;
            }
            
            // 右鍵：旋轉鏡頭
            if (e.button === 2) {
                isRotating = true;
                previousMousePosition = { x: e.clientX, y: e.clientY };
                
                // 記錄旋轉中心點和相機距離
                if (this.mapModels && Object.keys(this.mapModels).length > 0) {
                    const box = new THREE.Box3();
                    Object.values(this.mapModels).forEach(model => {
                        if (model) box.expandByObject(model);
                    });
                    rotationCenter = box.getCenter(new THREE.Vector3());
                } else if (this.mapModel) {
                    rotationCenter = new THREE.Box3().setFromObject(this.mapModel).getCenter(new THREE.Vector3());
                } else {
                    rotationCenter = new THREE.Vector3(0, 0, 0);
                }
                
                // 計算相機到中心的距離
                const cameraToCenter = new THREE.Vector3().subVectors(this.camera.position, rotationCenter);
                cameraDistance = cameraToCenter.length();
                
                e.preventDefault();
            }
            
            // 左鍵：平移鏡頭
            if (e.button === 0) {
                isPanning = true;
                previousMousePosition = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
        });

        this.renderer.domElement.addEventListener('mousemove', (e) => {
            // 街景模式下禁用滑鼠控制
            if (this.isStreetViewMode) {
                return;
            }

            // 選擇位置模式下禁用滑鼠控制
            if (this.isSelectingPosition) {
                return;
            }
            
            // 右鍵拖動：旋轉鏡頭（不固定看向中心點）
            if (isRotating) {
                const deltaX = previousMousePosition.x - e.clientX;
                const deltaY = previousMousePosition.y - e.clientY;

                // 直接旋轉相機的角度，而不是圍繞中心點旋轉
                this.camera.rotation.order = 'YXZ';
                
                // 水平旋轉（繞 Y 軸）- 調整為更舒適的旋轉速度
                this.camera.rotation.y -= deltaX * 0.006;
                
                // 垂直旋轉（繞 X 軸）- 調整為更舒適的旋轉速度
                this.camera.rotation.x -= deltaY * 0.006;
                
                // 限制垂直角度，避免翻轉
                this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));

                previousMousePosition = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
            
            // 左鍵拖動：平移鏡頭（與滑鼠游標移動速度一致）
            if (isPanning) {
                const deltaX = e.clientX - previousMousePosition.x;
                const deltaY = e.clientY - previousMousePosition.y;
                
                // 更新相機矩陣以獲取正確的方向
                this.camera.updateMatrixWorld();
                
                // 計算相機的右方向和上方向
                const right = new THREE.Vector3();
                right.setFromMatrixColumn(this.camera.matrixWorld, 0);
                right.normalize();
                
                const up = new THREE.Vector3();
                up.setFromMatrixColumn(this.camera.matrixWorld, 1);
                up.normalize();
                
                // 參考 Three.js OrbitControls 和 Blender 等標準3D工具的計算方式
                const rect = this.renderer.domElement.getBoundingClientRect();
                const height = rect.height;
                
                // 計算相機到焦點的距離（使用相機位置到原點的距離）
                const distance = this.camera.position.length();
                
                // 計算可見高度（標準透視投影計算）
                const fov = this.camera.fov * (Math.PI / 180);
                const visibleHeight = 2 * Math.tan(fov / 2) * distance;
                
                // 計算平移速度：讓滑鼠移動與視口移動一致（參考 OrbitControls 的標準計算）
                // 使用 1:1 的比例，滑鼠移動多少像素，視口就移動多少像素
                const panSpeed = visibleHeight / height;
                
                const panX = right.clone().multiplyScalar(-deltaX * panSpeed);
                const panY = up.clone().multiplyScalar(deltaY * panSpeed);
                
                // 平移相機
                this.camera.position.add(panX);
                this.camera.position.add(panY);

                previousMousePosition = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
        });

        this.renderer.domElement.addEventListener('mouseup', () => {
            isRotating = false;
            isPanning = false;
        });
        
        // 防止右鍵選單
        this.renderer.domElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // 點擊檢測
        this.renderer.domElement.addEventListener('click', (e) => {
            // 街景模式下禁用點擊檢測
            if (this.isStreetViewMode) {
                return;
            }

            // 如果正在拖動，不觸發點擊
            if (isRotating || isPanning) {
                return;
            }

            const rect = this.renderer.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);

            // 如果正在選擇位置模式，優先處理位置選擇
            if (this.isSelectingPosition) {
                // 在選擇位置模式下，忽略標誌點擊，只檢測地圖模型
                // 檢測與地圖的交點（排除標誌）
                const allModels = [];
                if (this.mapModels) {
                    Object.values(this.mapModels).forEach(model => {
                        if (model) allModels.push(model);
                    });
                }
                if (this.mapModel) {
                    allModels.push(this.mapModel);
                }
                
                let intersects = [];
                for (const model of allModels) {
                    const modelIntersects = this.raycaster.intersectObject(model, true);
                    intersects = intersects.concat(modelIntersects);
                }
                
                if (intersects.length > 0) {
                    // 選擇最近的交點
                    intersects.sort((a, b) => a.distance - b.distance);
                    const point = intersects[0].point;
                    if (this.selectPositionCallback) {
                        this.selectPositionCallback(point);
                    }
                    this.stopSelectPosition();
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                } else {
                    console.warn('未檢測到模型交點，請點擊地圖上的模型表面');
                }
                // 在選擇位置模式下，即使沒點到模型也不觸發其他事件
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            // 檢測圖片標誌點擊（只在非選擇位置模式下）
            const markerObjects = this.photoMarkers.map(m => m.group);
            const intersects = this.raycaster.intersectObjects(markerObjects, true);
            
            if (intersects.length > 0) {
                // 找到被點擊的標誌
                const clickedObject = intersects[0].object;
                let markerGroup = clickedObject;
                
                // 如果點擊的是子物件，找到父群組
                while (markerGroup && markerGroup.userData.type !== 'photoMarker') {
                    markerGroup = markerGroup.parent;
                }
                
                if (markerGroup && markerGroup.userData.type === 'photoMarker') {
                    this.onPhotoMarkerClick(markerGroup.userData.id);
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            } else {
                // 點擊空白處，隱藏資訊面板
                this.hidePhotoInfoPanel();
            }
        });

        // 滾輪縮放
        this.renderer.domElement.addEventListener('wheel', (e) => {
            // 街景模式下禁用滾輪縮放
            if (this.isStreetViewMode) {
                return;
            }
            e.preventDefault();
            // 調整縮放速度並反轉方向：滾輪往前 = 拉近，相反則拉遠
            const delta = -e.deltaY * this.zoomSpeed;
            this.applyZoom(delta);
        });
    }

    // 動畫循環
    animate() {
        requestAnimationFrame(() => this.animate());

        // 檢查渲染器是否已初始化
        if (!this.renderer || !this.scene || !this.camera) {
            console.warn('渲染器、場景或相機未初始化，跳過渲染');
            return;
        }

        // 如果有正在進行的鏡頭動畫，更新相機位置與朝向
        if (this.cameraAnimation) {
            const now = performance.now();
            const { startTime, duration, fromPos, toPos, target } = this.cameraAnimation;
            let t = (now - startTime) / duration;

            if (t >= 1) {
                this.camera.position.copy(toPos);
                this.camera.lookAt(target);
                this.cameraAnimation = null;
            } else {
                // easing：easeOutQuad
                t = t * (2 - t);
                const currentPos = fromPos.clone().lerp(toPos, t);
                this.camera.position.copy(currentPos);
                this.camera.lookAt(target);
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    // 平滑將鏡頭移動到指定位置附近，並看向該點
    flyTo(targetPosition, duration = 800) {
        if (!targetPosition) return;

        const target = targetPosition.clone();

        // 保持目前相機相對於目標的偏移量，做滑動效果
        const offset = new THREE.Vector3().subVectors(this.camera.position, target);
        const toPos = target.clone().add(offset);

        this.cameraAnimation = {
            startTime: performance.now(),
            duration,
            fromPos: this.camera.position.clone(),
            toPos,
            target
        };
    }
}

// 初始化地圖
let map3D;

// 確保所有資源載入完成後再初始化
let mapInitAttempts = 0;
const maxMapInitAttempts = 100; // 最多嘗試 10 秒

function initMap() {
    mapInitAttempts++;
    
    if (typeof THREE === 'undefined') {
        if (mapInitAttempts < maxMapInitAttempts) {
            setTimeout(initMap, 100);
        } else {
            alert('Three.js 載入失敗，請檢查網路連線');
        }
        return;
    }
    
    // 等待必要的 Loader 載入（優先 OBJLoader，STLLoader 作為備用）
    if (!THREE.OBJLoader && !THREE.STLLoader && !window.ModelLoader) {
        if (mapInitAttempts < maxMapInitAttempts) {
            setTimeout(initMap, 100);
        } else {
            alert('模型載入器載入失敗！\n\n請確認：\n1. 網路連線正常\n2. 使用本地伺服器開啟（不要直接用 file:// 開啟）');
        }
        return;
    }
    
    console.log('所有資源載入完成，開始初始化地圖...');
    map3D = new Map3D('canvas-container');
    window.map3D = map3D; // 設置為全域變數，供其他模組使用
    console.log('map3D 初始化完成，已設置為 window.map3D');
    
    // 觸發自訂事件，通知其他模組 map3D 已準備好
    window.dispatchEvent(new CustomEvent('map3DReady', { detail: map3D }));
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
});

