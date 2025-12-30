// 3D 地圖核心功能
class Map3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.mapModel = null;
        this.mapModels = {}; // 儲存多個模型：{ building: obj, ground: obj }
        this.photoMarkers = []; // 儲存圖片標誌物件
        this.currentPhotoMarkerId = null; // 當前選中的圖片標誌 ID
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        // 縮放速度係數（數字越大縮放越快）
        this.zoomSpeed = 0.3; // 調整為更舒適的縮放速度
        // 鏡頭平移動畫狀態（用來做類似 Google Map 的平滑移動）
        this.cameraAnimation = null;
        // 街景模式狀態（用於禁用滑鼠控制）
        this.isStreetViewMode = false;
        // 滑鼠鎖定狀態
        this.isMouseLocked = false;
        this.mouseLockButton = null;
        
        this.init();
        // 使用智能輸入系統管理器（自動檢測設備和瀏覽器）
        this.inputSystemManager = null;
        // 延遲初始化輸入系統，等待 Three.js 完全載入
        setTimeout(() => {
            if (typeof InputSystemManager !== 'undefined') {
                this.inputSystemManager = new InputSystemManager(this);
                window.inputSystemManager = this.inputSystemManager; // 設置為全域變數
            } else {
                console.warn('InputSystemManager 未載入，使用舊版輸入系統');
                this.setupEventListeners();
                this.setupTouchControls();
            }
        }, 100);
        this.setupMouseLock();
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
            { path: 'models/building.obj', type: 'building', name: '建築物' },
            { path: 'models/ground.obj', type: 'ground', name: '地板' }
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
            
            // 調試：計算模型的邊界框和網格數量
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            let meshCount = 0;
            let vertexCount = 0;
            model.traverse((child) => {
                if (child.isMesh) {
                    meshCount++;
                    if (child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
                        vertexCount += child.geometry.attributes.position.count;
                    }
                }
            });
            
            console.log(`${name} 處理完成：`, {
                原始位置: originalPosition,
                旋轉後位置: model.position,
                邊界框: {
                    最小: box.min,
                    最大: box.max,
                    尺寸: size,
                    中心: box.getCenter(new THREE.Vector3())
                },
                網格數量: meshCount,
                頂點數量: vertexCount
            });
            
            // 為所有3D模型添加黑色邊緣線（在所有變換完成並添加到場景之後）
            // 使用 setTimeout 確保模型完全載入後再添加邊緣線
            setTimeout(() => {
                let meshIndex = 0;
                model.traverse((child) => {
                    if (child.isMesh) {
                        meshIndex++;
                        // 為每個網格添加唯一標識
                        if (!child.userData) child.userData = {};
                        child.userData.meshIndex = meshIndex;
                        child.userData.modelType = type;
                        child.userData.meshName = child.name || `網格_${meshIndex}`;
                        
                        // 計算這個網格的邊界框
                        const meshBox = new THREE.Box3().setFromObject(child);
                        const meshSize = meshBox.getSize(new THREE.Vector3());
                        const meshCenter = meshBox.getCenter(new THREE.Vector3());
                        
                        let vertexCount = 0;
                        if (child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
                            vertexCount = child.geometry.attributes.position.count;
                        }
                        
                        console.log(`為模型添加邊緣線 [${type}] 網格 #${meshIndex}:`, {
                            名稱: child.userData.meshName,
                            位置: child.position,
                            邊界框: {
                                最小: meshBox.min,
                                最大: meshBox.max,
                                尺寸: meshSize,
                                中心: meshCenter
                            },
                            頂點數: vertexCount,
                            物件: child
                        });
                        
                        this.addEdgeLines(child);
                    }
                });
            }, 100);
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
        // 街景模式和正常模式都顯示建築物和地板
        this.setModelVisibility('building', true);
        this.setModelVisibility('ground', true);
    }
    
    // 處理模型載入錯誤，嘗試下一個檔案
    handleModelLoadError(failedPath, currentIndex) {
        const defaultModels = [
            'building.obj',
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
        
        // 調試：列出場景中所有模型物件
        console.log('=== 場景中的模型物件 ===');
        this.scene.traverse((object) => {
            if (object.userData && object.userData.type === 'map') {
                const box = new THREE.Box3().setFromObject(object);
                const size = box.getSize(new THREE.Vector3());
                console.log(`模型類型: ${object.userData.modelType || '未知'}`, {
                    物件: object,
                    位置: object.position,
                    邊界框: {
                        最小: box.min,
                        最大: box.max,
                        尺寸: size
                    },
                    子物件數量: object.children.length
                });
            }
        });
        console.log('=== 模型列表結束 ===');
        
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
        
        // 設定字體大小
        const fontSize = 48;
        context.font = 'bold ' + fontSize + 'px Microsoft JhengHei';
        
        // 測量文字寬度
        const textMetrics = context.measureText(text);
        const textWidth = textMetrics.width;
        
        // 根據文字長度動態調整 canvas 寬度（加上左右內邊距）
        const padding = 40; // 左右內邊距
        const minWidth = 200; // 最小寬度
        canvas.width = Math.max(textWidth + padding * 2, minWidth);
        canvas.height = 144; // 固定高度
        
        // 重新設定字體（因為 canvas 尺寸改變後需要重新設定）
        context.font = 'bold ' + fontSize + 'px Microsoft JhengHei';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // 繪製背景（使用更深的背景色以增加對比度）
        context.fillStyle = 'rgba(30, 30, 40, 0.95)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // 繪製邊框（使用亮色邊框）
        context.strokeStyle = 'rgba(255, 215, 0, 0.9)';
        context.lineWidth = 5;
        context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        
        // 繪製文字（使用亮黃色，並添加黑色描邊使其更顯眼）
        const textX = canvas.width / 2;
        const textY = canvas.height / 2;
        
        // 先繪製文字描邊（黑色）
        context.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        context.lineWidth = 6;
        context.lineJoin = 'round';
        context.miterLimit = 2;
        context.strokeText(text, textX, textY);
        
        // 再繪製文字主體（亮黃色）
        context.fillStyle = '#FFD700'; // 金色/亮黃色
        context.fillText(text, textX, textY);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        // 根據 canvas 寬度動態調整 sprite 縮放（保持高度不變）
        const baseScale = 9; // 基礎高度縮放
        const widthScale = (canvas.width / canvas.height) * baseScale; // 根據寬高比調整寬度縮放
        sprite.scale.set(widthScale, baseScale, 1);
        
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
        console.log('onPhotoMarkerClick 被調用，markerId:', markerId);
        const marker = photoMarkerManager.getMarker(markerId);
        if (!marker) {
            console.warn('找不到標誌，markerId:', markerId);
            return;
        }
        console.log('找到標誌:', marker);

        this.showPhotoInfoPanel(marker);
        this.currentPhotoMarkerId = markerId;

        // 鏡頭平滑移動到該標誌
        const markerObj = this.photoMarkers.find(m => m.id === markerId);
        if (markerObj) {
            this.flyTo(markerObj.group.position);
        }
    }

    // 顯示圖片資訊面板
    async showPhotoInfoPanel(marker) {
        console.log('showPhotoInfoPanel 被調用，marker:', marker);
        const panel = document.getElementById('photoInfoPanel');
        const title = document.getElementById('photoInfoTitle');
        const image = document.getElementById('photoInfoImage');
        const imageContainer = document.getElementById('photoInfoImageContainer');
        const descriptionElement = document.getElementById('photoInfoDescription');

        console.log('面板元素檢查:', {
            panel: !!panel,
            title: !!title,
            image: !!image,
            imageContainer: !!imageContainer,
            descriptionElement: !!descriptionElement
        });

        if (!panel || !title || !image || !imageContainer) {
            console.warn('資訊面板元素不存在');
            return;
        }

        title.textContent = marker.name.replace(/\.(jpg|jpeg|png)$/i, '');
        console.log('標題已設置:', title.textContent);

        // 載入描述文字
        if (descriptionElement) {
            // 根據圖片檔名生成對應的文字檔路徑
            const imageFileName = marker.name || marker.imagePath;
            const textFileName = imageFileName.replace(/\.(jpg|jpeg|png)$/i, '.txt');
            const textFilePath = 'descriptions/' + textFileName;
            
            console.log('嘗試載入描述文字:', textFilePath, 'marker:', marker);
            
            // 先清空描述區域
            descriptionElement.textContent = '';
            descriptionElement.style.display = 'none';
            descriptionElement.style.visibility = 'hidden';
            
            // 嘗試載入文字檔
            try {
                const response = await fetch(textFilePath);
                console.log('描述文字載入回應:', response.status, response.ok, response.statusText);
                
                if (response.ok) {
                    const text = await response.text();
                    console.log('描述文字內容 (原始):', JSON.stringify(text));
                    console.log('描述文字內容 (trim後):', JSON.stringify(text.trim()));
                    console.log('描述文字長度:', text.length, 'trim後長度:', text.trim().length);
                    
                    if (text && text.trim()) {
                        // 將文字內容顯示在描述區域（保留換行）
                        descriptionElement.textContent = text.trim();
                        descriptionElement.style.display = 'block';
                        descriptionElement.style.visibility = 'visible';
                        descriptionElement.style.opacity = '1';
                        console.log('描述文字已設置，元素內容:', descriptionElement.textContent);
                        console.log('描述元素樣式:', {
                            display: descriptionElement.style.display,
                            visibility: descriptionElement.style.visibility,
                            opacity: descriptionElement.style.opacity,
                            innerHTML: descriptionElement.innerHTML,
                            textContent: descriptionElement.textContent
                        });
                    } else {
                        console.log('描述文字為空或只有空白');
                        descriptionElement.style.display = 'none';
                    }
                } else {
                    // 檔案不存在，隱藏描述區域
                    console.warn('描述文字檔案不存在或無法讀取:', textFilePath, '狀態碼:', response.status, response.statusText);
                    descriptionElement.style.display = 'none';
                }
            } catch (error) {
                // 載入失敗，隱藏描述區域
                console.error('無法載入描述文字 (錯誤詳情):', textFilePath, error);
                console.error('錯誤類型:', error.name, '錯誤訊息:', error.message);
                descriptionElement.style.display = 'none';
            }
        } else {
            console.error('找不到描述元素 photoInfoDescription，檢查 DOM');
            const testElement = document.getElementById('photoInfoDescription');
            console.log('直接查詢結果:', testElement);
        }

        // 載入圖片（確保路徑包含 images/ 前綴）
        let imagePath = marker.imagePath;
        if (!imagePath.startsWith('images/') && !imagePath.startsWith('/images/') && !imagePath.startsWith('http')) {
            imagePath = 'images/' + imagePath;
        }
        image.src = imagePath;
        image.onload = () => {
            imageContainer.style.display = 'block';
        };
        image.onerror = () => {
            console.error('無法載入圖片:', marker.imagePath);
            imageContainer.style.display = 'none';
        };

        // 等待描述文字載入完成後再顯示面板
        // 如果描述元素存在，等待載入完成；否則直接顯示
        if (descriptionElement) {
            // 描述文字載入已在上面完成，這裡直接顯示面板
        }
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

        this.renderer.domElement.addEventListener('mouseup', (e) => {
            // 街景模式下禁用滑鼠控制
            if (this.isStreetViewMode) {
                return;
            }
            
            // 在 Pointer Lock 模式下，不重置狀態（讓 Pointer Lock 的處理接管）
            if (!this.isMouseLocked) {
                isRotating = false;
                isPanning = false;
            } else {
                // Pointer Lock 模式下，只處理右鍵釋放
                if (e.button === 2) {
                    isRotating = false;
                } else if (e.button === 0) {
                    isPanning = false;
                }
            }
        });
        
        // 防止右鍵選單（街景模式下也禁用）
        this.renderer.domElement.addEventListener('contextmenu', (e) => {
            if (this.isStreetViewMode) {
                e.preventDefault();
                return;
            }
            e.preventDefault();
        });

        // 點擊檢測
        this.renderer.domElement.addEventListener('click', (e) => {
            // 街景模式下禁用點擊檢測
            if (this.isStreetViewMode) {
                return;
            }

            // 如果正在拖動，不觸發點擊
            // 在 Pointer Lock 模式下，檢查按鈕狀態
            if (this.isMouseLocked) {
                if (isRightButtonDownLocked || isLeftButtonDownLocked) {
                    return;
                }
            } else {
                if (isRotating || isPanning) {
                    return;
                }
            }

            // 在 Pointer Lock 模式下，使用中心點作為點擊位置
            let mouseX, mouseY;
            if (this.isMouseLocked) {
                // Pointer Lock 模式下，點擊位置在視窗中心
                mouseX = 0;
                mouseY = 0;
            } else {
                const rect = this.renderer.domElement.getBoundingClientRect();
                mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
                mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            }
            this.mouse.x = mouseX;
            this.mouse.y = mouseY;

            this.raycaster.setFromCamera(this.mouse, this.camera);

            // 檢測圖片標誌點擊
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

        // Pointer Lock 模式下的滑鼠移動（使用 movementX/Y）
        // 追蹤按鈕狀態
        let isRightButtonDownLocked = false;
        let isLeftButtonDownLocked = false;
        
        // 在 Pointer Lock 模式下，需要單獨處理按鈕狀態
        const handleLockedMouseDown = (e) => {
            // 街景模式下禁用滑鼠控制
            if (this.isStreetViewMode) {
                return;
            }
            if (this.isMouseLocked) {
                if (e.button === 2) {
                    isRightButtonDownLocked = true;
                } else if (e.button === 0) {
                    isLeftButtonDownLocked = true;
                }
            }
        };
        
        const handleLockedMouseUp = (e) => {
            // 街景模式下禁用滑鼠控制
            if (this.isStreetViewMode) {
                return;
            }
            if (e.button === 2) {
                isRightButtonDownLocked = false;
            } else if (e.button === 0) {
                isLeftButtonDownLocked = false;
            }
        };
        
        // 使用 capture 階段確保能捕獲到事件
        this.renderer.domElement.addEventListener('mousedown', handleLockedMouseDown, true);
        this.renderer.domElement.addEventListener('mouseup', handleLockedMouseUp, true);
        
        document.addEventListener('mousemove', (e) => {
            if (!this.isMouseLocked) return;
            if (this.isStreetViewMode) return;

            // 使用 movementX/Y 來獲取相對移動（不受視窗邊界限制）
            if (e.movementX !== undefined && e.movementY !== undefined) {
                const deltaX = e.movementX;
                const deltaY = e.movementY;

                // 右鍵：旋轉相機
                if (isRightButtonDownLocked) {
                    this.camera.rotation.order = 'YXZ';
                    this.camera.rotation.y -= deltaX * 0.006;
                    this.camera.rotation.x -= deltaY * 0.006;
                    
                    // 限制垂直角度，避免翻轉
                    this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
                }
                
                // 左鍵：平移相機
                if (isLeftButtonDownLocked) {
                    // 更新相機矩陣以獲取正確的方向
                    this.camera.updateMatrixWorld();
                    
                    // 計算相機的右方向和上方向
                    const right = new THREE.Vector3();
                    right.setFromMatrixColumn(this.camera.matrixWorld, 0);
                    right.normalize();
                    
                    const up = new THREE.Vector3();
                    up.setFromMatrixColumn(this.camera.matrixWorld, 1);
                    up.normalize();
                    
                    // 計算平移速度（使用與非鎖定模式相同的計算方式）
                    const rect = this.renderer.domElement.getBoundingClientRect();
                    const height = rect.height;
                    const distance = this.camera.position.length();
                    const fov = this.camera.fov * (Math.PI / 180);
                    const visibleHeight = 2 * Math.tan(fov / 2) * distance;
                    const panSpeed = visibleHeight / height;
                    
                    // 使用 movementX/Y 來計算平移（轉換為像素單位）
                    const panX = right.clone().multiplyScalar(-deltaX * panSpeed);
                    const panY = up.clone().multiplyScalar(deltaY * panSpeed);
                    
                    // 平移相機
                    this.camera.position.add(panX);
                    this.camera.position.add(panY);
                }
            }
        });
    }

    // 設置觸控控制
    setupTouchControls() {
        // 觸控事件處理
        let touchState = {
            touches: [],
            isPanning: false,
            isRotating: false,
            initialDistance: 0,
            initialPanPosition: { x: 0, y: 0 },
            initialRotation: { x: 0, y: 0 }
        };

        // 計算兩點之間的距離
        const getDistance = (touch1, touch2) => {
            const dx = touch1.clientX - touch2.clientX;
            const dy = touch1.clientY - touch2.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };

        // 觸控開始
        this.renderer.domElement.addEventListener('touchstart', (e) => {
            if (this.isStreetViewMode) {
                return;
            }

            e.preventDefault();
            touchState.touches = Array.from(e.touches);

            if (touchState.touches.length === 1) {
                // 單指：左鍵（平移）
                touchState.isPanning = true;
                touchState.initialPanPosition = {
                    x: touchState.touches[0].clientX,
                    y: touchState.touches[0].clientY
                };
            } else if (touchState.touches.length === 2) {
                // 雙指：右鍵（旋轉）或縮放
                touchState.isRotating = true;
                touchState.initialDistance = getDistance(touchState.touches[0], touchState.touches[1]);
                touchState.initialRotation = {
                    x: this.camera.rotation.x,
                    y: this.camera.rotation.y
                };
                // 初始化雙指中心點位置（用於旋轉）
                const touch1 = touchState.touches[0];
                const touch2 = touchState.touches[1];
                touchState.initialPanPosition = {
                    x: (touch1.clientX + touch2.clientX) / 2,
                    y: (touch1.clientY + touch2.clientY) / 2
                };
            }
        }, { passive: false });

        // 觸控移動
        this.renderer.domElement.addEventListener('touchmove', (e) => {
            if (this.isStreetViewMode) {
                return;
            }

            e.preventDefault();
            touchState.touches = Array.from(e.touches);

            if (touchState.touches.length === 1 && touchState.isPanning) {
                // 單指移動：平移
                const deltaX = touchState.touches[0].clientX - touchState.initialPanPosition.x;
                const deltaY = touchState.touches[0].clientY - touchState.initialPanPosition.y;

                // 更新相機矩陣以獲取正確的方向
                this.camera.updateMatrixWorld();

                // 計算相機的右方向和上方向
                const right = new THREE.Vector3();
                right.setFromMatrixColumn(this.camera.matrixWorld, 0);
                right.normalize();

                const up = new THREE.Vector3();
                up.setFromMatrixColumn(this.camera.matrixWorld, 1);
                up.normalize();

                // 計算平移速度
                const rect = this.renderer.domElement.getBoundingClientRect();
                const height = rect.height;
                const distance = this.camera.position.length();
                const fov = this.camera.fov * (Math.PI / 180);
                const visibleHeight = 2 * Math.tan(fov / 2) * distance;
                const panSpeed = visibleHeight / height;

                const panX = right.clone().multiplyScalar(-deltaX * panSpeed);
                const panY = up.clone().multiplyScalar(deltaY * panSpeed);

                // 平移相機
                this.camera.position.add(panX);
                this.camera.position.add(panY);

                touchState.initialPanPosition = {
                    x: touchState.touches[0].clientX,
                    y: touchState.touches[0].clientY
                };
            } else if (touchState.touches.length === 2 && touchState.isRotating) {
                // 雙指移動：旋轉或縮放
                const currentDistance = getDistance(touchState.touches[0], touchState.touches[1]);
                const distanceChange = currentDistance - touchState.initialDistance;
                const distanceChangePercent = Math.abs(distanceChange / touchState.initialDistance);

                // 如果距離變化超過5%，視為縮放操作
                if (distanceChangePercent > 0.05) {
                    // 縮放：雙指距離改變（中鍵縮放）
                    const zoomDelta = -distanceChange * this.zoomSpeed * 0.1;
                    this.applyZoom(zoomDelta);
                    touchState.initialDistance = currentDistance;
                } else {
                    // 旋轉：雙指移動（右鍵旋轉）
                    const touch1 = touchState.touches[0];
                    const touch2 = touchState.touches[1];
                    const centerX = (touch1.clientX + touch2.clientX) / 2;
                    const centerY = (touch1.clientY + touch2.clientY) / 2;

                    // 計算兩指中心點的移動
                    if (!touchState.initialPanPosition.x && !touchState.initialPanPosition.y) {
                        touchState.initialPanPosition = { x: centerX, y: centerY };
                    }

                    const deltaX = centerX - touchState.initialPanPosition.x;
                    const deltaY = centerY - touchState.initialPanPosition.y;

                    this.camera.rotation.order = 'YXZ';
                    this.camera.rotation.y -= deltaX * 0.006;
                    this.camera.rotation.x -= deltaY * 0.006;
                    this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));

                    touchState.initialPanPosition = { x: centerX, y: centerY };
                }
            }
        }, { passive: false });

        // 觸控結束
        this.renderer.domElement.addEventListener('touchend', (e) => {
            if (this.isStreetViewMode) {
                return;
            }

            e.preventDefault();
            touchState.touches = Array.from(e.touches);

            if (touchState.touches.length === 0) {
                // 所有手指都離開
                touchState.isPanning = false;
                touchState.isRotating = false;
                touchState.initialDistance = 0;
            } else if (touchState.touches.length === 1) {
                // 從雙指變為單指：切換到平移模式
                touchState.isRotating = false;
                touchState.isPanning = true;
                touchState.initialPanPosition = {
                    x: touchState.touches[0].clientX,
                    y: touchState.touches[0].clientY
                };
            }
        }, { passive: false });

        // 觸控按鈕控制
        const moveForwardBtn = document.getElementById('moveForwardBtn');
        const moveBackwardBtn = document.getElementById('moveBackwardBtn');
        const turnLeftBtn = document.getElementById('turnLeftBtn');
        const turnRightBtn = document.getElementById('turnRightBtn');

        let buttonState = {
            forward: false,
            backward: false,
            left: false,
            right: false
        };

        const handleButtonPress = (direction, isPressed) => {
            buttonState[direction] = isPressed;
        };

        const handleButtonTouch = (btn, direction) => {
            if (!btn) return;

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleButtonPress(direction, true);
            }, { passive: false });

            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleButtonPress(direction, false);
            }, { passive: false });

            btn.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleButtonPress(direction, false);
            }, { passive: false });

            // 也支持滑鼠點擊（用於測試）
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleButtonPress(direction, true);
            });

            btn.addEventListener('mouseup', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleButtonPress(direction, false);
            });

            btn.addEventListener('mouseleave', (e) => {
                handleButtonPress(direction, false);
            });
        };

        handleButtonTouch(moveForwardBtn, 'forward');
        handleButtonTouch(moveBackwardBtn, 'backward');
        handleButtonTouch(turnLeftBtn, 'left');
        handleButtonTouch(turnRightBtn, 'right');

        // 按鈕控制更新循環
        const buttonControlUpdate = () => {
            if (this.isStreetViewMode) {
                requestAnimationFrame(buttonControlUpdate);
                return;
            }

            const moveSpeed = 0.5; // 移動速度
            const turnSpeed = 0.02; // 旋轉速度

            if (buttonState.forward || buttonState.backward) {
                const direction = new THREE.Vector3();
                this.camera.getWorldDirection(direction);
                const moveDistance = buttonState.forward ? moveSpeed : -moveSpeed;
                this.camera.position.add(direction.multiplyScalar(moveDistance));
            }

            if (buttonState.left || buttonState.right) {
                const turnAmount = buttonState.left ? turnSpeed : -turnSpeed;
                this.camera.rotation.order = 'YXZ';
                this.camera.rotation.y += turnAmount;
            }

            requestAnimationFrame(buttonControlUpdate);
        };

        buttonControlUpdate();
    }

    // 設置滑鼠鎖定功能
    setupMouseLock() {
        this.mouseLockButton = document.getElementById('lockMouseBtn');
        if (!this.mouseLockButton) {
            console.warn('找不到鎖定滑鼠按鈕');
            return;
        }

        // 更新按鈕文字
        this.updateLockButtonText();

        // 點擊按鈕切換鎖定狀態
        this.mouseLockButton.addEventListener('click', () => {
            this.toggleMouseLock();
        });

        // 監聽 Pointer Lock 狀態變化
        document.addEventListener('pointerlockchange', () => {
            this.isMouseLocked = document.pointerLockElement === this.renderer.domElement;
            this.updateLockButtonText();
        });

        // 監聽 Pointer Lock 錯誤
        document.addEventListener('pointerlockerror', () => {
            console.error('Pointer Lock 失敗');
            alert('無法鎖定滑鼠，請確認瀏覽器允許 Pointer Lock 功能');
            this.isMouseLocked = false;
            this.updateLockButtonText();
        });
    }

    // 切換滑鼠鎖定
    toggleMouseLock() {
        if (this.isMouseLocked) {
            // 解鎖
            document.exitPointerLock();
        } else {
            // 鎖定（需要用戶互動，所以通過點擊按鈕觸發）
            this.renderer.domElement.requestPointerLock();
        }
    }

    // 更新鎖定按鈕文字
    updateLockButtonText() {
        if (this.mouseLockButton) {
            this.mouseLockButton.textContent = this.isMouseLocked ? '解鎖滑鼠' : '鎖定滑鼠';
            if (this.isMouseLocked) {
                this.mouseLockButton.classList.add('active');
            } else {
                this.mouseLockButton.classList.remove('active');
            }
        }
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
    
    // 添加全局調試函數
    window.inspectModels = function() {
        if (!map3D) {
            console.error('map3D 尚未初始化');
            return;
        }
        
        console.log('=== 模型檢查 ===');
        console.log('mapModels:', map3D.mapModels);
        
        Object.keys(map3D.mapModels).forEach(type => {
            const model = map3D.mapModels[type];
            if (model) {
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                let meshCount = 0;
                let totalVertices = 0;
                const meshDetails = [];
                
                model.traverse((child) => {
                    if (child.isMesh) {
                        meshCount++;
                        const meshBox = new THREE.Box3().setFromObject(child);
                        const meshSize = meshBox.getSize(new THREE.Vector3());
                        const meshCenter = meshBox.getCenter(new THREE.Vector3());
                        
                        let vertexCount = 0;
                        if (child.geometry && child.geometry.attributes && child.geometry.attributes.position) {
                            vertexCount = child.geometry.attributes.position.count;
                        }
                        
                        const meshInfo = {
                            索引: child.userData.meshIndex || meshCount,
                            名稱: child.name || child.userData.meshName || `網格_${meshCount}`,
                            位置: child.position,
                            邊界框: {
                                最小: meshBox.min,
                                最大: meshBox.max,
                                尺寸: meshSize,
                                中心: meshCenter
                            },
                            頂點數: vertexCount,
                            物件: child
                        };
                        
                        meshDetails.push(meshInfo);
                        totalVertices += vertexCount;
                    }
                });
                
                console.log(`\n模型類型: ${type}`, {
                    位置: model.position,
                    邊界框: {
                        最小: box.min,
                        最大: box.max,
                        尺寸: size,
                        中心: center
                    },
                    網格數量: meshCount,
                    總頂點數: totalVertices,
                    網格詳細資訊: meshDetails,
                    物件: model
                });
            }
        });
        
        console.log('\n提示：');
        console.log('  - 輸入 inspectModels() 可以隨時檢查模型');
        console.log('  - 輸入 hideMesh(type, index) 可以隱藏特定網格，例如: hideMesh("ground", 3)');
        console.log('  - 輸入 showMesh(type, index) 可以顯示特定網格');
        console.log('  - 輸入 toggleMesh(type, index) 可以切換網格的顯示/隱藏');
        console.log('=== 檢查結束 ===');
    };
    
    // 隱藏特定網格
    window.hideMesh = function(type, meshIndex) {
        if (!map3D || !map3D.mapModels[type]) {
            console.error(`找不到模型類型: ${type}`);
            return;
        }
        
        const model = map3D.mapModels[type];
        let found = false;
        model.traverse((child) => {
            if (child.isMesh && (child.userData.meshIndex === meshIndex || !meshIndex)) {
                child.visible = false;
                found = true;
                console.log(`已隱藏 ${type} 模型的網格 #${child.userData.meshIndex || '未知'}`);
            }
        });
        
        if (!found) {
            console.warn(`找不到 ${type} 模型的網格 #${meshIndex}`);
        }
    };
    
    // 顯示特定網格
    window.showMesh = function(type, meshIndex) {
        if (!map3D || !map3D.mapModels[type]) {
            console.error(`找不到模型類型: ${type}`);
            return;
        }
        
        const model = map3D.mapModels[type];
        let found = false;
        model.traverse((child) => {
            if (child.isMesh && (child.userData.meshIndex === meshIndex || !meshIndex)) {
                child.visible = true;
                found = true;
                console.log(`已顯示 ${type} 模型的網格 #${child.userData.meshIndex || '未知'}`);
            }
        });
        
        if (!found) {
            console.warn(`找不到 ${type} 模型的網格 #${meshIndex}`);
        }
    };
    
    // 切換網格顯示/隱藏
    window.toggleMesh = function(type, meshIndex) {
        if (!map3D || !map3D.mapModels[type]) {
            console.error(`找不到模型類型: ${type}`);
            return;
        }
        
        const model = map3D.mapModels[type];
        let found = false;
        model.traverse((child) => {
            if (child.isMesh && child.userData.meshIndex === meshIndex) {
                child.visible = !child.visible;
                found = true;
                console.log(`${child.visible ? '顯示' : '隱藏'} ${type} 模型的網格 #${meshIndex}`);
            }
        });
        
        if (!found) {
            console.warn(`找不到 ${type} 模型的網格 #${meshIndex}`);
        }
    };
    
    // 觸發自訂事件，通知其他模組 map3D 已準備好
    window.dispatchEvent(new CustomEvent('map3DReady', { detail: map3D }));
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
});

