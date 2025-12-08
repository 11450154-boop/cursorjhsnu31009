// 街景 / 平面漫遊控制器
class StreetViewController {
    constructor(map3DInstance) {
        this.map3D = map3DInstance;
        this.active = false;

        // 速度與高度設定
        this.moveSpeed = 1.2;   // 移動速度（越大越快）
        this.turnSpeed = 0.04;  // 左右轉向速度
        this.groundY = 6;       // 相機高度（視為站在地面上的高度）

        // 碰撞相關設定
        this.collisionRadius = 0.8;                // 與牆壁保持的最小距離（進一步降低）
        this.maxStepDistance = this.moveSpeed * 2; // 單步最大檢查距離（保險一點）
        this.raycaster = new THREE.Raycaster();    // 用來偵測前方是否有碰撞物

        this.yaw = 0;           // 水平角度（朝向）
        this.keys = {
            forward: false,
            back: false,
            left: false,
            right: false,
            turnLeft: false,
            turnRight: false
        };

        this._onKeyDown = this.onKeyDown.bind(this);
        this._onKeyUp = this.onKeyUp.bind(this);

        this.lastTime = performance.now();
    }

    // 啟用街景模式
    activate() {
        if (this.active) return;
        this.active = true;
        this.attachKeyboard();
        // 街景模式：只顯示建築物和地板，隱藏其他模型（如建築名稱）
        if (this.map3D && this.map3D.setStreetViewMode) {
            this.map3D.setStreetViewMode(true);
        }
        this.placeCameraOnGround();
        this.lastTime = performance.now();
        this.loop();
        console.log('街景模式：啟用');
    }

    // 關閉街景模式
    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.detachKeyboard();
        // 正常模式：顯示所有模型
        if (this.map3D && this.map3D.setStreetViewMode) {
            this.map3D.setStreetViewMode(false);
        }
        console.log('街景模式：關閉');
    }

    toggle() {
        if (this.active) {
            this.deactivate();
        } else {
            this.activate();
        }
    }

    attachKeyboard() {
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    detachKeyboard() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }

    // 把相機放到模型附近的「地面」高度
    placeCameraOnGround() {
        const camera = this.map3D.camera;
        let pos = new THREE.Vector3(0, this.groundY, 30);
        let groundLevel = 0; // 地面高度

        // 優先使用多模型系統
        if (this.map3D.mapModels && (this.map3D.mapModels.building || this.map3D.mapModels.ground)) {
            const box = new THREE.Box3();
            if (this.map3D.mapModels.building) box.expandByObject(this.map3D.mapModels.building);
            if (this.map3D.mapModels.ground) box.expandByObject(this.map3D.mapModels.ground);
            
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const min = box.min; // 獲取最小邊界（通常是地面）
            groundLevel = min.y; // 使用地面的 Y 座標
            
            // 計算一個在地面上的起始位置（在模型邊緣附近）
            const radius = Math.max(size.x, size.z) * 0.3; // 稍微靠近中心一點
            
            // 將相機放在地面上方（使用實際地面高度 + 相機高度）
            pos.set(center.x, groundLevel + this.groundY, center.z + radius);
        } else if (this.map3D.mapModel) {
            // 向後兼容單模型系統
            const box = new THREE.Box3().setFromObject(this.map3D.mapModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const min = box.min;
            groundLevel = min.y;
            
            const radius = Math.max(size.x, size.z) * 0.3;
            pos.set(center.x, groundLevel + this.groundY, center.z + radius);
        }

        // 更新 groundY 為實際的地面高度 + 相機高度
        this.groundY = groundLevel + 6;

        camera.position.copy(pos);

        // 先朝向 -Z 方向（朝向模型中心）
        const target = new THREE.Vector3(pos.x, pos.y, pos.z - 10);
        camera.lookAt(target);

        // 根據目前朝向計算 yaw
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        this.yaw = Math.atan2(dir.x, dir.z);
    }

    onKeyDown(e) {
        switch (e.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.back = true;
                break;
            case 'KeyA':
                this.keys.left = true;
                break;
            case 'KeyD':
                this.keys.right = true;
                break;
            case 'ArrowLeft':
                this.keys.turnLeft = true;
                break;
            case 'ArrowRight':
                this.keys.turnRight = true;
                break;
            case 'Escape':
                // Esc 離開街景模式
                this.deactivate();
                {
                    const btn = document.getElementById('streetViewBtn');
                    if (btn) btn.textContent = '街景模式';
                }
                break;
            default:
                break;
        }
    }

    onKeyUp(e) {
        switch (e.code) {
            case 'KeyW':
            case 'ArrowUp':
                this.keys.forward = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.keys.back = false;
                break;
            case 'KeyA':
                this.keys.left = false;
                break;
            case 'KeyD':
                this.keys.right = false;
                break;
            case 'ArrowLeft':
                this.keys.turnLeft = false;
                break;
            case 'ArrowRight':
                this.keys.turnRight = false;
                break;
            default:
                break;
        }
    }

    // 連續更新（每一幀）
    loop() {
        if (!this.active) return;

        const now = performance.now();
        const dt = (now - this.lastTime) / 1000; // 秒
        this.lastTime = now;

        this.update(dt);
        requestAnimationFrame(() => this.loop());
    }

    update(dt) {
        const camera = this.map3D.camera;

        // 左右轉頭
        if (this.keys.turnLeft) this.yaw += this.turnSpeed;
        if (this.keys.turnRight) this.yaw -= this.turnSpeed;

        const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const move = new THREE.Vector3();

        if (this.keys.forward) move.add(forward);
        if (this.keys.back) move.sub(forward);
        if (this.keys.left) move.sub(right);
        if (this.keys.right) move.add(right);

        if (move.lengthSq() > 0) {
            move.normalize();
            // 乘上 60 讓速度在不同幀率下比較一致
            move.multiplyScalar(this.moveSpeed * dt * 60);

            // ========= 碰撞偵測：避免穿牆 =========
            // 使用所有可見的模型進行碰撞檢測（建築物和地板）
            const collisionObjects = [];
            if (this.map3D.mapModels) {
                // 使用多模型系統
                if (this.map3D.mapModels.building) collisionObjects.push(this.map3D.mapModels.building);
                if (this.map3D.mapModels.ground) collisionObjects.push(this.map3D.mapModels.ground);
            } else if (this.map3D.mapModel) {
                // 向後兼容單模型系統
                collisionObjects.push(this.map3D.mapModel);
            }
            
            if (collisionObjects.length > 0) {
                // 只看水平平面上的方向
                const horizontalMove = move.clone();
                horizontalMove.y = 0;
                const distance = horizontalMove.length();

                if (distance > 0) {
                    const dir = horizontalMove.clone().normalize();
                    const origin = camera.position.clone();
                    origin.y -= 1; // 稍微降低射線起點

                    // 檢查移動方向是否有碰撞
                    this.raycaster.set(origin, dir);
                    const maxDistance = Math.min(distance + this.collisionRadius, this.maxStepDistance);
                    
                    let hit = null;
                    let minHitDistance = Infinity;
                    
                    for (const obj of collisionObjects) {
                        // 只檢測 Mesh 物件，排除邊框線（LineSegments）
                        const intersects = this.raycaster.intersectObject(obj, true);
                        for (const intersection of intersects) {
                            // 過濾掉邊框線：檢查物件類型，只保留 Mesh
                            const object = intersection.object;
                            // 跳過 LineSegments（邊框線）和 Line（線條）
                            if (object.isLineSegments || object.isLine) {
                                continue;
                            }
                            // 只檢測 Mesh 物件
                            if (object.isMesh && intersection.distance <= maxDistance && intersection.distance < minHitDistance) {
                                hit = intersection;
                                minHitDistance = intersection.distance;
                            }
                        }
                    }

                    // 改進的碰撞處理：允許側向滑動，避免被黏住
                    if (hit) {
                        const hitDistance = hit.distance;
                        
                        // 如果碰撞距離小於安全半徑，需要處理
                        if (hitDistance < this.collisionRadius) {
                            // 分析移動方向：主要是前進/後退還是側向
                            const forwardComponent = Math.abs(forward.dot(dir));
                            const rightComponent = Math.abs(right.dot(dir));
                            
                            // 如果主要是側向移動（左右），允許側向滑動
                            if (rightComponent > forwardComponent * 1.5) {
                                // 側向移動：檢查側向是否有足夠空間
                                const sideDir = right.clone().multiplyScalar(Math.sign(right.dot(dir)));
                                this.raycaster.set(origin, sideDir);
                                let sideHit = null;
                                let sideHitDistance = Infinity;
                                
                                for (const obj of collisionObjects) {
                                    const intersects = this.raycaster.intersectObject(obj, true);
                                    for (const intersection of intersects) {
                                        // 過濾掉邊框線
                                        const object = intersection.object;
                                        if (object.isLineSegments || object.isLine) {
                                            continue;
                                        }
                                        // 只檢測 Mesh 物件
                                        if (object.isMesh && intersection.distance <= distance + this.collisionRadius && 
                                            intersection.distance < sideHitDistance) {
                                            sideHit = intersection;
                                            sideHitDistance = intersection.distance;
                                        }
                                    }
                                }
                                
                                // 如果側向有足夠空間，允許側向移動
                                if (!sideHit || sideHitDistance >= this.collisionRadius) {
                                    // 允許側向移動，但限制前進/後退分量
                                    const forwardMove = forward.clone().multiplyScalar(forward.dot(move));
                                    const rightMove = right.clone().multiplyScalar(right.dot(move));
                                    // 只保留側向移動，移除前進/後退分量
                                    move.copy(rightMove);
                                } else {
                                    // 側向也有牆，完全阻止
                                    move.set(0, 0, 0);
                                }
                            } else {
                                // 主要是前進/後退，如果會撞牆就阻止
                                move.set(0, 0, 0);
                            }
                        } else if (hitDistance < distance + this.collisionRadius) {
                            // 會撞到牆但還有空間，調整移動距離
                            const safeDistance = Math.max(0, hitDistance - this.collisionRadius);
                            if (safeDistance > 0.1) {
                                move.normalize().multiplyScalar(safeDistance);
                            } else {
                                move.set(0, 0, 0);
                            }
                        }
                    }
                }
            }

            camera.position.add(move);
        }

        // 固定在「平面」上
        camera.position.y = this.groundY;

        // 根據 yaw 決定看向的方向（不抬頭低頭，只左右）
        const target = new THREE.Vector3(
            camera.position.x + Math.sin(this.yaw),
            camera.position.y,
            camera.position.z + Math.cos(this.yaw)
        );
        camera.lookAt(target);
    }
}

// 全域街景控制器實例
let streetViewController = null;
let streetViewSetup = false;

function setupStreetView() {
    // 避免重複設置
    if (streetViewSetup) return;
    
    if (!window.map3D) {
        console.warn('map3D 尚未初始化，無法設置街景模式');
        return;
    }
    
    console.log('設置街景模式...');
    streetViewController = new StreetViewController(window.map3D);

    const btn = document.getElementById('streetViewBtn');
    if (btn) {
        btn.onclick = () => {
            console.log('點擊街景模式按鈕');
            if (streetViewController) {
                streetViewController.toggle();
                btn.textContent = streetViewController.active ? '離開街景' : '街景模式';
            } else {
                console.error('streetViewController 不存在');
            }
        };
        console.log('街景模式按鈕事件監聽器已設置');
    } else {
        console.warn('找不到 streetViewBtn');
    }
    
    streetViewSetup = true;
    console.log('街景模式設置完成');
}

// 監聽 map3D 準備好的事件
window.addEventListener('map3DReady', () => {
    console.log('收到 map3DReady 事件，設置街景模式');
    setupStreetView();
});

// 如果事件已經觸發，直接設置
document.addEventListener('DOMContentLoaded', () => {
    // 先嘗試設置（如果 map3D 已經初始化）
    if (window.map3D) {
        setupStreetView();
    }
    // 同時也監聽事件（以防 map3D 稍後才初始化）
    window.addEventListener('map3DReady', setupStreetView);
});



