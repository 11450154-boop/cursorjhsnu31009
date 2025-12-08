// 模型載入器 - 支援多種格式（STL, OBJ, GLTF/GLB）
class ModelLoader {
    constructor(map3DInstance) {
        this.map3D = map3DInstance;
        this.supportedFormats = ['stl', 'obj', 'gltf', 'glb'];
    }

    // 自動檢測檔案格式並載入
    loadModel(filePath) {
        const extension = filePath.split('.').pop().toLowerCase();
        
        switch(extension) {
            case 'stl':
                this.loadSTL(filePath);
                break;
            case 'obj':
                this.loadOBJ(filePath);
                break;
            case 'gltf':
            case 'glb':
                this.loadGLTF(filePath);
                break;
            default:
                console.error('不支援的檔案格式:', extension);
                alert(`不支援的檔案格式: .${extension}\n\n支援的格式：STL, OBJ, GLTF, GLB`);
        }
    }
    
    // 載入模型並指定類型（用於多模型載入）
    loadModelWithType(filePath, modelType, onSuccess, onError) {
        const extension = filePath.split('.').pop().toLowerCase();
        
        switch(extension) {
            case 'stl':
                this.loadSTLWithType(filePath, modelType, onSuccess, onError);
                break;
            case 'obj':
                this.loadOBJWithType(filePath, modelType, onSuccess, onError);
                break;
            case 'gltf':
            case 'glb':
                this.loadGLTFWithType(filePath, modelType, onSuccess, onError);
                break;
            default:
                console.error('不支援的檔案格式:', extension);
                if (onError) onError(new Error(`不支援的檔案格式: .${extension}`));
        }
    }

    // 載入 STL 格式（原有功能）
    loadSTL(filePath) {
        if (!THREE.STLLoader) {
            console.error('STLLoader 未載入');
            return;
        }

        const loader = new THREE.STLLoader();
        console.log('開始載入 STL 檔案:', filePath);
        
        loader.load(
            filePath,
            (geometry) => {
                this.processSTLGeometry(geometry);
            },
            (progress) => {
                console.log('載入進度:', (progress.loaded / progress.total * 100) + '%');
            },
            (error) => {
                console.error('載入 STL 模型失敗:', error);
                alert('載入 STL 模型失敗！\n\n請確認檔案路徑正確');
            }
        );
    }

    // 處理 STL 幾何體
    processSTLGeometry(geometry) {
        // 先讓模型躺平在 XZ 平面上，再把中心移到原點
        geometry.computeBoundingBox();

        const bboxCenter = geometry.boundingBox.getCenter(new THREE.Vector3());
        geometry.translate(-bboxCenter.x, -bboxCenter.y, -bboxCenter.z);
        geometry.rotateX(-Math.PI / 2);
        geometry.computeBoundingBox();

        // 判斷 STL 是否內建顏色
        let material;
        const hasVertexColors =
            (geometry.attributes && geometry.attributes.color) ||
            geometry.hasColors;

        if (hasVertexColors) {
            material = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                specular: 0x222222,
                shininess: 80,
                flatShading: true,
                side: THREE.DoubleSide,
                vertexColors: true
            });
        } else {
            material = new THREE.MeshPhongMaterial({
                color: 0x5c7cfa,
                specular: 0x222222,
                shininess: 80,
                flatShading: true,
                side: THREE.DoubleSide
            });
        }

        this.createMapModel(geometry, material);
    }

    // 載入 OBJ 格式（支援紋理和 MTL 材質）
    loadOBJ(filePath) {
        if (!THREE.OBJLoader) {
            console.error('OBJLoader 未載入，嘗試載入...');
            this.loadOBJLoader(() => this.loadOBJ(filePath));
            return;
        }

        // 嘗試載入 MTL 材質檔
        // 對於其他 OBJ 檔案，嘗試使用同名的 MTL
        let mtlPath = filePath.replace('.obj', '.mtl');
        const objLoader = new THREE.OBJLoader();
        
        // 如果有 MTLLoader，先載入材質
        if (THREE.MTLLoader) {
            console.log('開始載入 MTL 材質檔:', mtlPath);
            const mtlLoader = new THREE.MTLLoader();
            mtlLoader.load(
                mtlPath,
                (materials) => {
                    materials.preload();
                    objLoader.setMaterials(materials);
                    this.loadOBJFile(filePath, objLoader);
                },
                undefined,
                (error) => {
                    console.warn('MTL 材質檔載入失敗，將使用預設材質:', error);
                    // MTL 載入失敗，繼續載入 OBJ（使用預設材質）
                    this.loadOBJFile(filePath, objLoader);
                }
            );
        } else {
            // 沒有 MTLLoader，直接載入 OBJ
            console.warn('MTLLoader 未載入，將使用預設材質');
            this.loadOBJFile(filePath, objLoader);
        }
    }

    // 實際載入 OBJ 檔案
    loadOBJFile(filePath, loader) {
        console.log('開始載入 OBJ 檔案:', filePath);
        
        loader.load(
            filePath,
            (object) => {
                this.processOBJObject(object);
            },
            (progress) => {
                if (progress.lengthComputable) {
                    console.log('載入進度:', (progress.loaded / progress.total * 100) + '%');
                }
            },
            (error) => {
                console.error('載入 OBJ 模型失敗:', error);
                // 如果有 map3D 實例且是預設檔案，嘗試回退
                if (this.map3D && this.map3D.handleModelLoadError) {
                    const defaultModels = ['models/building.obj', 'models/building name.obj', 'models/ground.obj'];
                    const currentIndex = defaultModels.indexOf(filePath);
                    if (currentIndex >= 0 && this.currentFallbackIndex !== undefined) {
                        // 使用儲存的回退索引
                        this.map3D.handleModelLoadError(filePath, this.currentFallbackIndex);
                        return;
                    }
                }
                // 如果不是預設檔案或無法回退，顯示錯誤訊息
                alert('載入 OBJ 模型失敗！\n\n請確認：\n1. 檔案「' + filePath + '」存在\n2. 如果使用 MTL 材質，確保對應的 .mtl 檔案也在同一目錄\n3. 使用本地伺服器開啟（不要直接用 file:// 開啟）');
            }
        );
    }

    // 處理 OBJ 物件（可能包含多個網格和材質）
    processOBJObject(object, modelType = null, onSuccess = null) {
        // OBJ 可能包含多個子物件，需要統一處理
        object.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                
                // 如果沒有材質，給一個預設材質
                if (!child.material || child.material.length === 0) {
                    child.material = new THREE.MeshPhongMaterial({
                        color: 0x5c7cfa,
                        specular: 0x222222,
                        shininess: 80
                    });
                }
            }
        });

        // 計算邊界並調整位置
        const box = new THREE.Box3().setFromObject(object);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // 將中心移到原點
        object.position.sub(center);
        
        // 旋轉以符合 Three.js 座標系（Y 軸朝上）
        object.rotateX(-Math.PI / 2);
        
        // 計算縮放
        const maxDim = Math.max(size.x, size.z);
        const targetSize = 180;
        const scale = targetSize / maxDim;
        object.scale.set(scale, scale, scale);

        // 如果有指定類型，使用新的多模型系統
        if (modelType) {
            object.userData = { type: 'map', modelType: modelType };
            this.map3D.mapModels[modelType] = object;
            this.map3D.scene.add(object);
            if (onSuccess) onSuccess();
        } else {
            // 舊的單模型系統（向後兼容）
            this.map3D.mapModel = object;
            this.map3D.mapModel.userData = { type: 'map' };
            this.map3D.scene.add(this.map3D.mapModel);
            // 調整相機位置
            this.adjustCamera();
            this.map3D.onModelLoaded();
        }
    }
    
    // 載入 OBJ 格式並指定類型
    loadOBJWithType(filePath, modelType, onSuccess, onError) {
        if (!THREE.OBJLoader) {
            console.error('OBJLoader 未載入，嘗試載入...');
            this.loadOBJLoader(() => this.loadOBJWithType(filePath, modelType, onSuccess, onError));
            return;
        }

        // 嘗試載入 MTL 材質檔
        let mtlPath = filePath.replace('.obj', '.mtl');
        const objLoader = new THREE.OBJLoader();
        
        // 如果有 MTLLoader，先載入材質
        if (THREE.MTLLoader) {
            console.log('開始載入 MTL 材質檔:', mtlPath);
            const mtlLoader = new THREE.MTLLoader();
            mtlLoader.load(
                mtlPath,
                (materials) => {
                    materials.preload();
                    objLoader.setMaterials(materials);
                    this.loadOBJFileWithType(filePath, objLoader, modelType, onSuccess, onError);
                },
                undefined,
                (error) => {
                    console.warn('MTL 材質檔載入失敗，將使用預設材質:', error);
                    // MTL 載入失敗，繼續載入 OBJ（使用預設材質）
                    this.loadOBJFileWithType(filePath, objLoader, modelType, onSuccess, onError);
                }
            );
        } else {
            // 沒有 MTLLoader，直接載入 OBJ
            console.warn('MTLLoader 未載入，將使用預設材質');
            this.loadOBJFileWithType(filePath, objLoader, modelType, onSuccess, onError);
        }
    }
    
    // 實際載入 OBJ 檔案（帶類型）
    loadOBJFileWithType(filePath, loader, modelType, onSuccess, onError) {
        console.log('開始載入 OBJ 檔案:', filePath, '類型:', modelType);
        
        loader.load(
            filePath,
            (object) => {
                // 只做基本的材質處理，不做位置調整
                // 讓 map3d.js 統一處理所有模型以保持相對位置
                object.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        // 如果沒有材質，給一個預設材質
                        if (!child.material || child.material.length === 0) {
                            child.material = new THREE.MeshPhongMaterial({
                                color: 0x5c7cfa,
                                specular: 0x222222,
                                shininess: 80
                            });
                        }
                    }
                });
                
                // 直接返回原始模型，讓 map3d.js 統一處理
                if (onSuccess) {
                    onSuccess(object);
                }
            },
            (progress) => {
                if (progress.lengthComputable) {
                    console.log('載入進度:', (progress.loaded / progress.total * 100) + '%');
                }
            },
            (error) => {
                console.error('載入 OBJ 模型失敗:', error);
                if (onError) {
                    onError(error);
                } else {
                    alert('載入 OBJ 模型失敗！\n\n請確認：\n1. 檔案「' + filePath + '」存在\n2. 如果使用 MTL 材質，確保對應的 .mtl 檔案也在同一目錄\n3. 使用本地伺服器開啟（不要直接用 file:// 開啟）');
                }
            }
        );
    }
    
    // 載入 STL 格式並指定類型（暫時不實現，因為目前主要使用 OBJ）
    loadSTLWithType(filePath, modelType, onSuccess, onError) {
        if (onError) onError(new Error('STL 格式的多模型載入尚未實現'));
    }
    
    // 載入 GLTF 格式並指定類型（暫時不實現，因為目前主要使用 OBJ）
    loadGLTFWithType(filePath, modelType, onSuccess, onError) {
        if (onError) onError(new Error('GLTF 格式的多模型載入尚未實現'));
    }

    // 載入 GLTF/GLB 格式（最佳選擇，完整支援紋理）
    loadGLTF(filePath) {
        if (!THREE.GLTFLoader) {
            console.error('GLTFLoader 未載入，嘗試載入...');
            this.loadGLTFLoader(() => this.loadGLTF(filePath));
            return;
        }

        const loader = new THREE.GLTFLoader();
        console.log('開始載入 GLTF/GLB 檔案:', filePath);
        
        loader.load(
            filePath,
            (gltf) => {
                this.processGLTFScene(gltf);
            },
            (progress) => {
                if (progress.lengthComputable) {
                    console.log('載入進度:', (progress.loaded / progress.total * 100) + '%');
                }
            },
            (error) => {
                console.error('載入 GLTF/GLB 模型失敗:', error);
                alert('載入 GLTF/GLB 模型失敗！\n\n請確認檔案路徑正確');
            }
        );
    }

    // 處理 GLTF 場景
    processGLTFScene(gltf) {
        const scene = gltf.scene;
        
        // 遍歷所有物件，確保陰影設定正確
        scene.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // 計算邊界並調整位置
        const box = new THREE.Box3().setFromObject(scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // 將中心移到原點
        scene.position.sub(center);
        
        // 旋轉以符合 Three.js 座標系（Y 軸朝上）
        scene.rotateX(-Math.PI / 2);
        
        // 計算縮放
        const maxDim = Math.max(size.x, size.z);
        const targetSize = 180;
        const scale = targetSize / maxDim;
        scene.scale.set(scale, scale, scale);

        this.map3D.mapModel = scene;
        this.map3D.mapModel.userData = { type: 'map' };
        this.map3D.scene.add(this.map3D.mapModel);

        // 調整相機位置
        this.adjustCamera();
        this.map3D.onModelLoaded();
    }

    // 創建地圖模型（STL 用）
    createMapModel(geometry, material) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { type: 'map' };
        
        // 計算合適的縮放
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.z);
        const targetSize = 180;
        const scale = targetSize / maxDim;
        mesh.scale.set(scale, scale, scale);

        this.map3D.mapModel = mesh;
        this.map3D.scene.add(this.map3D.mapModel);

        // 調整相機位置
        this.adjustCamera();
        this.map3D.onModelLoaded();
    }

    // 調整相機位置
    adjustCamera() {
        if (!this.map3D.mapModel) return;

        const box = new THREE.Box3().setFromObject(this.map3D.mapModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxSize = Math.max(size.x, size.y, size.z);
        const distance = maxSize * 2;
        
        this.map3D.camera.position.set(
            center.x,
            center.y + distance * 0.5,
            center.z + distance
        );
        this.map3D.camera.lookAt(center);
    }

    // 動態載入 OBJLoader 和 MTLLoader
    loadOBJLoader(callback) {
        // 先載入 MTLLoader（如果需要的話）
        if (!THREE.MTLLoader) {
            const mtlScript = document.createElement('script');
            mtlScript.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/MTLLoader.js';
            mtlScript.onload = () => {
                console.log('MTLLoader 載入完成');
                this.loadOBJLoaderScript(callback);
            };
            mtlScript.onerror = () => {
                console.warn('MTLLoader 載入失敗，將繼續載入 OBJ（不使用材質檔）');
                this.loadOBJLoaderScript(callback);
            };
            document.head.appendChild(mtlScript);
        } else {
            this.loadOBJLoaderScript(callback);
        }
    }

    // 載入 OBJLoader 腳本
    loadOBJLoaderScript(callback) {
        if (THREE.OBJLoader) {
            if (callback) callback();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.js';
        script.onload = () => {
            console.log('OBJLoader 載入完成');
            if (callback) callback();
        };
        script.onerror = () => {
            console.error('OBJLoader 載入失敗');
            alert('OBJLoader 載入失敗，請檢查網路連線');
        };
        document.head.appendChild(script);
    }

    // 動態載入 GLTFLoader
    loadGLTFLoader(callback) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
        script.onload = () => {
            console.log('GLTFLoader 載入完成');
            if (callback) callback();
        };
        script.onerror = () => {
            console.error('GLTFLoader 載入失敗');
            alert('GLTFLoader 載入失敗，請檢查網路連線');
        };
        document.head.appendChild(script);
    }
}

