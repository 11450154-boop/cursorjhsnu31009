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
        this.collisionRadius = 3;                  // 與牆壁保持的最小距離
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
        // 街景模式下隱藏地標名稱標籤
        this.setMarkerLabelsVisible(false);
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
        // 離開街景後恢復地標名稱標籤
        this.setMarkerLabelsVisible(true);
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

    // 控制地標名稱標籤是否顯示
    setMarkerLabelsVisible(visible) {
        if (!this.map3D || !Array.isArray(this.map3D.markers)) return;
        this.map3D.markers.forEach(marker => {
            if (marker.sprite) {
                marker.sprite.visible = visible;
            }
        });
    }

    // 把相機放到模型附近的「地面」高度
    placeCameraOnGround() {
        const camera = this.map3D.camera;
        let pos = new THREE.Vector3(0, this.groundY, 30);

        // 優先使用多模型系統
        if (this.map3D.mapModels && (this.map3D.mapModels.building || this.map3D.mapModels.ground)) {
            const box = new THREE.Box3();
            if (this.map3D.mapModels.building) box.expandByObject(this.map3D.mapModels.building);
            if (this.map3D.mapModels.ground) box.expandByObject(this.map3D.mapModels.ground);
            
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const radius = Math.max(size.x, size.z) * 0.4;

            pos.set(center.x, center.y + this.groundY, center.z + radius);
        } else if (this.map3D.mapModel) {
            // 向後兼容單模型系統
            const box = new THREE.Box3().setFromObject(this.map3D.mapModel);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const radius = Math.max(size.x, size.z) * 0.4;

            pos.set(center.x, center.y + this.groundY, center.z + radius);
        }

        camera.position.copy(pos);

        // 先朝向 -Z 方向
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

                    // 從相機位置稍微抬高一點往前打射線
                    const origin = camera.position.clone();
                    origin.y = this.groundY;

                    this.raycaster.set(origin, dir);
                    // 射線長度：這一步要走的距離 + 安全半徑
                    const maxDistance = Math.min(distance + this.collisionRadius, this.maxStepDistance);
                    
                    // 檢測所有碰撞物件
                    let hit = null;
                    for (const obj of collisionObjects) {
                        const intersects = this.raycaster.intersectObject(obj, true);
                        const foundHit = intersects.find(h => h.distance <= maxDistance);
                        if (foundHit) {
                            hit = foundHit;
                            break;
                        }
                    }

                    // 如果前方太近有牆，就不要往那個方向移動
                    if (hit) {
                        // 直接把 move 設為 0，等於這一幀不移動
                        move.set(0, 0, 0);
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

function setupStreetViewWhenReady() {
    // map3D 在 map3d.js 中以全域變數建立
    if (typeof map3D !== 'undefined' && map3D) {
        streetViewController = new StreetViewController(map3D);

        const btn = document.getElementById('streetViewBtn');
        if (btn) {
            btn.addEventListener('click', () => {
                streetViewController.toggle();
                btn.textContent = streetViewController.active ? '離開街景' : '街景模式';
            });
        }
    } else {
        // map3D 尚未建立，稍後再試
        setTimeout(setupStreetViewWhenReady, 200);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setupStreetViewWhenReady();
});



