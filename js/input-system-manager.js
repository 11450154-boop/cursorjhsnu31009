// 智能輸入系統管理器
// 自動檢測設備和瀏覽器類型，並應用相應的控制模式

class InputSystemManager {
    constructor(map3DInstance) {
        this.map3D = map3DInstance;
        this.deviceType = null;
        this.browserType = null;
        this.currentInputSystem = null;
        this.inputSystems = {};
        
        // 檢測設備和瀏覽器
        this.detectDevice();
        this.detectBrowser();
        
        // 初始化所有輸入系統
        this.initializeInputSystems();
        
        // 自動應用適合的輸入系統
        this.applyInputSystem();
    }
    
    // 檢測設備類型
    detectDevice() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const touchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        
        // 檢測移動設備
        const isMobile = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || 
                        (touchSupport && (screenWidth < 768 || screenHeight < 768));
        
        // 檢測平板設備
        const isTablet = /iPad|Android/i.test(userAgent) && !/Mobile/i.test(userAgent) ||
                         (touchSupport && screenWidth >= 768 && screenWidth < 1024);
        
        if (isMobile) {
            this.deviceType = 'mobile';
        } else if (isTablet) {
            this.deviceType = 'tablet';
        } else {
            this.deviceType = 'desktop';
        }
        
        console.log('檢測到設備類型:', this.deviceType);
        console.log('觸控支援:', touchSupport);
        console.log('螢幕尺寸:', screenWidth, 'x', screenHeight);
    }
    
    // 檢測瀏覽器類型
    detectBrowser() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        
        if (userAgent.indexOf('Chrome') > -1 && userAgent.indexOf('Edg') === -1) {
            this.browserType = 'chrome';
        } else if (userAgent.indexOf('Firefox') > -1) {
            this.browserType = 'firefox';
        } else if (userAgent.indexOf('Safari') > -1 && userAgent.indexOf('Chrome') === -1) {
            this.browserType = 'safari';
        } else if (userAgent.indexOf('Edg') > -1) {
            this.browserType = 'edge';
        } else if (userAgent.indexOf('Opera') > -1 || userAgent.indexOf('OPR') > -1) {
            this.browserType = 'opera';
        } else {
            this.browserType = 'unknown';
        }
        
        console.log('檢測到瀏覽器類型:', this.browserType);
    }
    
    // 初始化所有輸入系統
    initializeInputSystems() {
        // 系統1: Tinkercad 風格桌面模式（主要系統）
        this.inputSystems.tinkercadDesktop = new TinkercadDesktopInput(this.map3D);
        
        // 系統2: Tinkercad 風格移動模式（主要系統）
        this.inputSystems.tinkercadMobile = new TinkercadMobileInput(this.map3D);
        
        // 系統3: 軌道控制模式（代入系統1）
        this.inputSystems.orbitControl = new OrbitControlInput(this.map3D);
        
        // 系統4: 第一人稱控制模式（代入系統2）
        this.inputSystems.firstPerson = new FirstPersonInput(this.map3D);
    }
    
    // 自動應用適合的輸入系統
    applyInputSystem() {
        // 根據設備類型選擇主要系統
        if (this.deviceType === 'mobile' || this.deviceType === 'tablet') {
            this.currentInputSystem = this.inputSystems.tinkercadMobile;
            console.log('已應用: Tinkercad 移動模式');
        } else {
            this.currentInputSystem = this.inputSystems.tinkercadDesktop;
            console.log('已應用: Tinkercad 桌面模式');
        }
        
        // 啟用選中的系統
        if (this.currentInputSystem) {
            this.currentInputSystem.enable();
        }
    }
    
    // 切換到指定的輸入系統
    switchInputSystem(systemName) {
        // 禁用當前系統
        if (this.currentInputSystem) {
            this.currentInputSystem.disable();
        }
        
        // 啟用新系統
        if (this.inputSystems[systemName]) {
            this.currentInputSystem = this.inputSystems[systemName];
            this.currentInputSystem.enable();
            console.log('已切換到輸入系統:', systemName);
            return true;
        }
        
        console.warn('找不到輸入系統:', systemName);
        return false;
    }
    
    // 獲取當前設備信息
    getDeviceInfo() {
        return {
            deviceType: this.deviceType,
            browserType: this.browserType,
            currentSystem: this.currentInputSystem ? this.currentInputSystem.name : null
        };
    }
}

// Tinkercad 風格桌面輸入系統
class TinkercadDesktopInput {
    constructor(map3D) {
        this.map3D = map3D;
        this.name = 'Tinkercad Desktop';
        this.enabled = false;
        this.isRotating = false;
        this.isPanning = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.rotationCenter = new THREE.Vector3(0, 0, 0);
        this.cameraDistance = 0;
    }
    
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.setupEventListeners();
        console.log('✓ Tinkercad 桌面模式已啟用');
    }
    
    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this.removeEventListeners();
        console.log('✗ Tinkercad 桌面模式已停用');
    }
    
    setupEventListeners() {
        const canvas = this.map3D.renderer.domElement;
        
        // 滑鼠按下
        this.mouseDownHandler = (e) => {
            if (this.map3D.isStreetViewMode) return;
            
            // 右鍵：旋轉
            if (e.button === 2) {
                this.isRotating = true;
                this.previousMousePosition = { x: e.clientX, y: e.clientY };
                this.updateRotationCenter();
                e.preventDefault();
            }
            
            // 左鍵：平移
            if (e.button === 0) {
                this.isPanning = true;
                this.previousMousePosition = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
        };
        
        // 滑鼠移動
        this.mouseMoveHandler = (e) => {
            if (this.map3D.isStreetViewMode) return;
            
            // 右鍵拖動：旋轉
            if (this.isRotating) {
                const deltaX = this.previousMousePosition.x - e.clientX;
                const deltaY = this.previousMousePosition.y - e.clientY;
                
                this.map3D.camera.rotation.order = 'YXZ';
                this.map3D.camera.rotation.y -= deltaX * 0.006;
                this.map3D.camera.rotation.x -= deltaY * 0.006;
                this.map3D.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.map3D.camera.rotation.x));
                
                this.previousMousePosition = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
            
            // 左鍵拖動：平移
            if (this.isPanning) {
                const deltaX = e.clientX - this.previousMousePosition.x;
                const deltaY = e.clientY - this.previousMousePosition.y;
                
                this.map3D.camera.updateMatrixWorld();
                
                const right = new THREE.Vector3();
                right.setFromMatrixColumn(this.map3D.camera.matrixWorld, 0);
                right.normalize();
                
                const up = new THREE.Vector3();
                up.setFromMatrixColumn(this.map3D.camera.matrixWorld, 1);
                up.normalize();
                
                const rect = canvas.getBoundingClientRect();
                const height = rect.height;
                const distance = this.map3D.camera.position.length();
                const fov = this.map3D.camera.fov * (Math.PI / 180);
                const visibleHeight = 2 * Math.tan(fov / 2) * distance;
                const panSpeed = visibleHeight / height;
                
                const panX = right.clone().multiplyScalar(-deltaX * panSpeed);
                const panY = up.clone().multiplyScalar(deltaY * panSpeed);
                
                this.map3D.camera.position.add(panX);
                this.map3D.camera.position.add(panY);
                
                this.previousMousePosition = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
        };
        
        // 滑鼠放開
        this.mouseUpHandler = () => {
            this.isRotating = false;
            this.isPanning = false;
        };
        
        // 滾輪縮放（中鍵功能）
        this.wheelHandler = (e) => {
            if (this.map3D.isStreetViewMode) return;
            e.preventDefault();
            const delta = -e.deltaY * this.map3D.zoomSpeed;
            this.map3D.applyZoom(delta);
        };
        
        // 防止右鍵選單
        this.contextMenuHandler = (e) => {
            if (this.map3D.isStreetViewMode) return;
            e.preventDefault();
        };
        
        canvas.addEventListener('mousedown', this.mouseDownHandler);
        canvas.addEventListener('mousemove', this.mouseMoveHandler);
        canvas.addEventListener('mouseup', this.mouseUpHandler);
        canvas.addEventListener('wheel', this.wheelHandler);
        canvas.addEventListener('contextmenu', this.contextMenuHandler);
    }
    
    removeEventListeners() {
        const canvas = this.map3D.renderer.domElement;
        canvas.removeEventListener('mousedown', this.mouseDownHandler);
        canvas.removeEventListener('mousemove', this.mouseMoveHandler);
        canvas.removeEventListener('mouseup', this.mouseUpHandler);
        canvas.removeEventListener('wheel', this.wheelHandler);
        canvas.removeEventListener('contextmenu', this.contextMenuHandler);
    }
    
    updateRotationCenter() {
        if (this.map3D.mapModels && Object.keys(this.map3D.mapModels).length > 0) {
            const box = new THREE.Box3();
            Object.values(this.map3D.mapModels).forEach(model => {
                if (model) box.expandByObject(model);
            });
            this.rotationCenter = box.getCenter(new THREE.Vector3());
        } else if (this.map3D.mapModel) {
            this.rotationCenter = new THREE.Box3().setFromObject(this.map3D.mapModel).getCenter(new THREE.Vector3());
        } else {
            this.rotationCenter = new THREE.Vector3(0, 0, 0);
        }
    }
}

// Tinkercad 風格移動輸入系統
class TinkercadMobileInput {
    constructor(map3D) {
        this.map3D = map3D;
        this.name = 'Tinkercad Mobile';
        this.enabled = false;
        this.touchState = {
            touches: [],
            isPanning: false,
            isRotating: false,
            initialDistance: 0,
            initialPanPosition: { x: 0, y: 0 },
            initialRotation: { x: 0, y: 0 }
        };
    }
    
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.setupEventListeners();
        console.log('✓ Tinkercad 移動模式已啟用');
    }
    
    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this.removeEventListeners();
        console.log('✗ Tinkercad 移動模式已停用');
    }
    
    setupEventListeners() {
        const canvas = this.map3D.renderer.domElement;
        
        // 計算兩點距離
        const getDistance = (touch1, touch2) => {
            const dx = touch1.clientX - touch2.clientX;
            const dy = touch1.clientY - touch2.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        };
        
        // 觸控開始
        this.touchStartHandler = (e) => {
            if (this.map3D.isStreetViewMode) return;
            e.preventDefault();
            
            this.touchState.touches = Array.from(e.touches);
            
            if (this.touchState.touches.length === 1) {
                // 單指：平移
                this.touchState.isPanning = true;
                this.touchState.initialPanPosition = {
                    x: this.touchState.touches[0].clientX,
                    y: this.touchState.touches[0].clientY
                };
            } else if (this.touchState.touches.length === 2) {
                // 雙指：旋轉或縮放
                this.touchState.isRotating = true;
                this.touchState.initialDistance = getDistance(this.touchState.touches[0], this.touchState.touches[1]);
                this.touchState.initialRotation = {
                    x: this.map3D.camera.rotation.x,
                    y: this.map3D.camera.rotation.y
                };
                const touch1 = this.touchState.touches[0];
                const touch2 = this.touchState.touches[1];
                this.touchState.initialPanPosition = {
                    x: (touch1.clientX + touch2.clientX) / 2,
                    y: (touch1.clientY + touch2.clientY) / 2
                };
            }
        };
        
        // 觸控移動
        this.touchMoveHandler = (e) => {
            if (this.map3D.isStreetViewMode) return;
            e.preventDefault();
            
            this.touchState.touches = Array.from(e.touches);
            
            if (this.touchState.touches.length === 1 && this.touchState.isPanning) {
                // 單指移動：平移
                const deltaX = this.touchState.touches[0].clientX - this.touchState.initialPanPosition.x;
                const deltaY = this.touchState.touches[0].clientY - this.touchState.initialPanPosition.y;
                
                this.map3D.camera.updateMatrixWorld();
                
                const right = new THREE.Vector3();
                right.setFromMatrixColumn(this.map3D.camera.matrixWorld, 0);
                right.normalize();
                
                const up = new THREE.Vector3();
                up.setFromMatrixColumn(this.map3D.camera.matrixWorld, 1);
                up.normalize();
                
                const rect = canvas.getBoundingClientRect();
                const height = rect.height;
                const distance = this.map3D.camera.position.length();
                const fov = this.map3D.camera.fov * (Math.PI / 180);
                const visibleHeight = 2 * Math.tan(fov / 2) * distance;
                const panSpeed = visibleHeight / height;
                
                const panX = right.clone().multiplyScalar(-deltaX * panSpeed);
                const panY = up.clone().multiplyScalar(deltaY * panSpeed);
                
                this.map3D.camera.position.add(panX);
                this.map3D.camera.position.add(panY);
                
                this.touchState.initialPanPosition = {
                    x: this.touchState.touches[0].clientX,
                    y: this.touchState.touches[0].clientY
                };
            } else if (this.touchState.touches.length === 2 && this.touchState.isRotating) {
                // 雙指移動：旋轉或縮放
                const currentDistance = getDistance(this.touchState.touches[0], this.touchState.touches[1]);
                const distanceChange = currentDistance - this.touchState.initialDistance;
                const distanceChangePercent = Math.abs(distanceChange / this.touchState.initialDistance);
                
                if (distanceChangePercent > 0.05) {
                    // 縮放
                    const zoomDelta = -distanceChange * this.map3D.zoomSpeed * 0.1;
                    this.map3D.applyZoom(zoomDelta);
                    this.touchState.initialDistance = currentDistance;
                } else {
                    // 旋轉
                    const touch1 = this.touchState.touches[0];
                    const touch2 = this.touchState.touches[1];
                    const centerX = (touch1.clientX + touch2.clientX) / 2;
                    const centerY = (touch1.clientY + touch2.clientY) / 2;
                    
                    const deltaX = centerX - this.touchState.initialPanPosition.x;
                    const deltaY = centerY - this.touchState.initialPanPosition.y;
                    
                    this.map3D.camera.rotation.order = 'YXZ';
                    this.map3D.camera.rotation.y -= deltaX * 0.006;
                    this.map3D.camera.rotation.x -= deltaY * 0.006;
                    this.map3D.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.map3D.camera.rotation.x));
                    
                    this.touchState.initialPanPosition = { x: centerX, y: centerY };
                }
            }
        };
        
        // 觸控結束
        this.touchEndHandler = (e) => {
            if (this.map3D.isStreetViewMode) return;
            e.preventDefault();
            
            this.touchState.touches = Array.from(e.touches);
            
            if (this.touchState.touches.length === 0) {
                this.touchState.isPanning = false;
                this.touchState.isRotating = false;
                this.touchState.initialDistance = 0;
            } else if (this.touchState.touches.length === 1) {
                this.touchState.isRotating = false;
                this.touchState.isPanning = true;
                this.touchState.initialPanPosition = {
                    x: this.touchState.touches[0].clientX,
                    y: this.touchState.touches[0].clientY
                };
            }
        };
        
        canvas.addEventListener('touchstart', this.touchStartHandler, { passive: false });
        canvas.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
        canvas.addEventListener('touchend', this.touchEndHandler, { passive: false });
    }
    
    removeEventListeners() {
        const canvas = this.map3D.renderer.domElement;
        canvas.removeEventListener('touchstart', this.touchStartHandler);
        canvas.removeEventListener('touchmove', this.touchMoveHandler);
        canvas.removeEventListener('touchend', this.touchEndHandler);
    }
}

// 代入系統1: 軌道控制模式
class OrbitControlInput {
    constructor(map3D) {
        this.map3D = map3D;
        this.name = 'Orbit Control';
        this.enabled = false;
        this.isRotating = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.target = new THREE.Vector3(0, 0, 0);
    }
    
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.setupEventListeners();
        console.log('✓ 軌道控制模式已啟用');
    }
    
    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this.removeEventListeners();
        console.log('✗ 軌道控制模式已停用');
    }
    
    setupEventListeners() {
        const canvas = this.map3D.renderer.domElement;
        
        this.mouseDownHandler = (e) => {
            if (this.map3D.isStreetViewMode) return;
            if (e.button === 0) {
                this.isRotating = true;
                this.previousMousePosition = { x: e.clientX, y: e.clientY };
                this.updateTarget();
                e.preventDefault();
            }
        };
        
        this.mouseMoveHandler = (e) => {
            if (this.map3D.isStreetViewMode) return;
            if (this.isRotating) {
                const deltaX = this.previousMousePosition.x - e.clientX;
                const deltaY = this.previousMousePosition.y - e.clientY;
                
                // 圍繞目標點旋轉
                const offset = new THREE.Vector3().subVectors(this.map3D.camera.position, this.target);
                const spherical = new THREE.Spherical();
                spherical.setFromVector3(offset);
                
                spherical.theta -= deltaX * 0.01;
                spherical.phi += deltaY * 0.01;
                spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
                
                offset.setFromSpherical(spherical);
                this.map3D.camera.position.copy(this.target).add(offset);
                this.map3D.camera.lookAt(this.target);
                
                this.previousMousePosition = { x: e.clientX, y: e.clientY };
                e.preventDefault();
            }
        };
        
        this.mouseUpHandler = () => {
            this.isRotating = false;
        };
        
        this.wheelHandler = (e) => {
            if (this.map3D.isStreetViewMode) return;
            e.preventDefault();
            const delta = -e.deltaY * this.map3D.zoomSpeed;
            const direction = new THREE.Vector3().subVectors(this.map3D.camera.position, this.target).normalize();
            this.map3D.camera.position.add(direction.multiplyScalar(delta));
        };
        
        canvas.addEventListener('mousedown', this.mouseDownHandler);
        canvas.addEventListener('mousemove', this.mouseMoveHandler);
        canvas.addEventListener('mouseup', this.mouseUpHandler);
        canvas.addEventListener('wheel', this.wheelHandler);
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    removeEventListeners() {
        const canvas = this.map3D.renderer.domElement;
        canvas.removeEventListener('mousedown', this.mouseDownHandler);
        canvas.removeEventListener('mousemove', this.mouseMoveHandler);
        canvas.removeEventListener('mouseup', this.mouseUpHandler);
        canvas.removeEventListener('wheel', this.wheelHandler);
    }
    
    updateTarget() {
        if (this.map3D.mapModels && Object.keys(this.map3D.mapModels).length > 0) {
            const box = new THREE.Box3();
            Object.values(this.map3D.mapModels).forEach(model => {
                if (model) box.expandByObject(model);
            });
            this.target = box.getCenter(new THREE.Vector3());
        } else {
            this.target = new THREE.Vector3(0, 0, 0);
        }
    }
}

// 代入系統2: 第一人稱控制模式
class FirstPersonInput {
    constructor(map3D) {
        this.map3D = map3D;
        this.name = 'First Person';
        this.enabled = false;
        this.isRotating = false;
        this.previousMousePosition = { x: 0, y: 0 };
        this.keys = {};
    }
    
    enable() {
        if (this.enabled) return;
        this.enabled = true;
        this.setupEventListeners();
        this.startUpdateLoop();
        console.log('✓ 第一人稱控制模式已啟用');
    }
    
    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this.removeEventListeners();
        this.stopUpdateLoop();
        console.log('✗ 第一人稱控制模式已停用');
    }
    
    setupEventListeners() {
        const canvas = this.map3D.renderer.domElement;
        
        this.mouseDownHandler = (e) => {
            if (this.map3D.isStreetViewMode) return;
            if (e.button === 0) {
                this.isRotating = true;
                this.previousMousePosition = { x: e.clientX, y: e.clientY };
                canvas.requestPointerLock();
                e.preventDefault();
            }
        };
        
        this.mouseMoveHandler = (e) => {
            if (this.map3D.isStreetViewMode) return;
            if (document.pointerLockElement === canvas && this.isRotating) {
                const deltaX = e.movementX || 0;
                const deltaY = e.movementY || 0;
                
                this.map3D.camera.rotation.order = 'YXZ';
                this.map3D.camera.rotation.y -= deltaX * 0.002;
                this.map3D.camera.rotation.x -= deltaY * 0.002;
                this.map3D.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.map3D.camera.rotation.x));
            }
        };
        
        this.mouseUpHandler = () => {
            this.isRotating = false;
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        };
        
        this.keyDownHandler = (e) => {
            if (this.map3D.isStreetViewMode) return;
            this.keys[e.key.toLowerCase()] = true;
        };
        
        this.keyUpHandler = (e) => {
            this.keys[e.key.toLowerCase()] = false;
        };
        
        canvas.addEventListener('mousedown', this.mouseDownHandler);
        document.addEventListener('mousemove', this.mouseMoveHandler);
        canvas.addEventListener('mouseup', this.mouseUpHandler);
        document.addEventListener('keydown', this.keyDownHandler);
        document.addEventListener('keyup', this.keyUpHandler);
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    removeEventListeners() {
        const canvas = this.map3D.renderer.domElement;
        canvas.removeEventListener('mousedown', this.mouseDownHandler);
        document.removeEventListener('mousemove', this.mouseMoveHandler);
        canvas.removeEventListener('mouseup', this.mouseUpHandler);
        document.removeEventListener('keydown', this.keyDownHandler);
        document.removeEventListener('keyup', this.keyUpHandler);
    }
    
    startUpdateLoop() {
        const update = () => {
            if (!this.enabled) return;
            
            const moveSpeed = 0.5;
            const direction = new THREE.Vector3();
            this.map3D.camera.getWorldDirection(direction);
            
            if (this.keys['w']) {
                this.map3D.camera.position.add(direction.multiplyScalar(moveSpeed));
            }
            if (this.keys['s']) {
                this.map3D.camera.position.add(direction.multiplyScalar(-moveSpeed));
            }
            
            const right = new THREE.Vector3();
            right.setFromMatrixColumn(this.map3D.camera.matrixWorld, 0);
            right.normalize();
            
            if (this.keys['a']) {
                this.map3D.camera.position.add(right.multiplyScalar(-moveSpeed));
            }
            if (this.keys['d']) {
                this.map3D.camera.position.add(right.multiplyScalar(moveSpeed));
            }
            
            requestAnimationFrame(update);
        };
        
        this.updateLoop = update();
    }
    
    stopUpdateLoop() {
        this.updateLoop = null;
    }
}

// 導出到全域
window.InputSystemManager = InputSystemManager;

