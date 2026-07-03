import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = new THREE.Scene();
        this.blockMeshes = new Map();
        this.blockGroups = new Map();
        this.animations = [];
        this.mergeEffects = [];
        this.textureCache = new Map();

        this.setupRenderer();
        this.setupCamera();
        this.setupLighting();
        this.setupGround();
        this.setupPreview();
        this.setupCeiling();
    }

    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;

        this.resizeRenderer();
        window.addEventListener('resize', () => this.resizeRenderer());
    }

    resizeRenderer() {
        const container = this.canvas.parentElement;
        const w = container.clientWidth;
        const h = container.clientHeight;
        this.renderer.setSize(w, h);
        if (this.camera) {
            this.camera.aspect = w / h;
            this.camera.fov = w / h < 1 ? 65 : 50;
            this.camera.updateProjectionMatrix();
        }
    }

    setupCamera() {
        const container = this.canvas.parentElement;
        this.camera = new THREE.PerspectiveCamera(
            50,
            container.clientWidth / container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(3.75, 10, 12);
        this.camera.lookAt(1.5, 3, 1.5);

        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.target.set(1.5, 3, 1.5);
        this.controls.enablePan = false;
        this.controls.enableZoom = true;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 20;
        this.controls.minPolarAngle = 0.3;
        this.controls.maxPolarAngle = Math.PI / 2.2;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.enabled = false;

        this.initialCameraPos = this.camera.position.clone();
        this.initialCameraTarget = this.controls.target.clone();
    }

    setupLighting() {
        const ambient = new THREE.AmbientLight(0xffeedd, 0.7);
        this.scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        dirLight.position.set(5, 10, 5);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        const pointLight = new THREE.PointLight(0xff6644, 0.4, 20);
        pointLight.position.set(1.5, 8, 1.5);
        this.scene.add(pointLight);
    }

    setupGround() {
        const gridSize = 7;
        const groundGeo = new THREE.PlaneGeometry(gridSize, gridSize);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x9e8a72,
            roughness: 0.8,
            metalness: 0.05,
            depthWrite: true,
        });
        this.ground = new THREE.Mesh(groundGeo, groundMat);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.set(1.5, -0.01, 1.5);
        this.ground.receiveShadow = true;
        this.ground.visible = false;
        this.scene.add(this.ground);

        this.setupSky();

        this.setupGridOverlay();
        this.setupDirectionLabels();
    }

    setupSky() {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0, '#4a90c8');
        grad.addColorStop(0.4, '#6aa0c0');
        grad.addColorStop(0.7, '#8a7055');
        grad.addColorStop(1.0, '#4a3a2a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1, 256);

        const skyTexture = new THREE.CanvasTexture(canvas);
        this.scene.background = skyTexture;
        this.scene.fog = new THREE.Fog(0x4a3a2a, 25, 60);

        this.clouds = [];
        for (let i = 0; i < 8; i++) {
            const cloud = this.createCloud();
            cloud.position.set(
                (Math.random() - 0.5) * 40,
                8 + Math.random() * 6,
                -10 - Math.random() * 20
            );
            cloud.userData.speed = 0.2 + Math.random() * 0.3;
            this.scene.add(cloud);
            this.clouds.push(cloud);
        }
    }

    createCloud() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        const numBlobs = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < numBlobs; i++) {
            const x = 60 + Math.random() * 136;
            const y = 40 + Math.random() * 48;
            const rx = 30 + Math.random() * 40;
            const ry = 20 + Math.random() * 25;
            ctx.beginPath();
            ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.random() * 0.3})`;
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.7 });
        const sprite = new THREE.Sprite(mat);
        const scale = 4 + Math.random() * 4;
        sprite.scale.set(scale, scale * 0.5, 1);
        return sprite;
    }

    updateClouds(delta) {
        for (const cloud of this.clouds) {
            cloud.position.x += cloud.userData.speed * delta;
            if (cloud.position.x > 25) {
                cloud.position.x = -25;
                cloud.position.z = -10 - Math.random() * 20;
                cloud.position.y = 8 + Math.random() * 6;
            }
        }
    }

    setupGridOverlay() {
        this.boardGroup = new THREE.Group();

        const gridGeo = new THREE.PlaneGeometry(4, 4);
        const gridMat = new THREE.MeshStandardMaterial({
            color: 0xb8a088,
            roughness: 0.7,
            metalness: 0.05,
            transparent: true,
            opacity: 0.8,
        });
        const gridMesh = new THREE.Mesh(gridGeo, gridMat);
        gridMesh.rotation.x = -Math.PI / 2;
        gridMesh.position.set(1.5, 0.0, 1.5);
        gridMesh.receiveShadow = true;
        this.boardGroup.add(gridMesh);

        const edgeMat = new THREE.LineBasicMaterial({ color: 0xd4c4a8, transparent: true, opacity: 0.5 });
        for (let i = 0; i <= 4; i++) {
            const xPoints = [
                new THREE.Vector3(i - 0.5, 0.01, -0.5),
                new THREE.Vector3(i - 0.5, 0.01, 3.5),
            ];
            const xGeo = new THREE.BufferGeometry().setFromPoints(xPoints);
            this.boardGroup.add(new THREE.Line(xGeo, edgeMat));

            const zPoints = [
                new THREE.Vector3(-0.5, 0.01, i - 0.5),
                new THREE.Vector3(3.5, 0.01, i - 0.5),
            ];
            const zGeo = new THREE.BufferGeometry().setFromPoints(zPoints);
            this.boardGroup.add(new THREE.Line(zGeo, edgeMat));
        }

        this.boardGroup.visible = false;
        this.scene.add(this.boardGroup);
    }

    setupDirectionLabels() {
        const labels = [
            { text: 'W', x: 1.5, z: -1.4 },
            { text: 'S', x: 1.5, z: 4.4 },
            { text: 'A', x: -1.4, z: 1.5 },
            { text: 'D', x: 4.4, z: 1.5 },
        ];

        for (const label of labels) {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');

            ctx.font = '900 160px "Black Ops One", Impact, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillText(label.text, 128, 128);

            const texture = new THREE.CanvasTexture(canvas);
            const mat = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
            });
            const geo = new THREE.PlaneGeometry(1.4, 1.4);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.renderOrder = -1;
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(label.x, 0.005, label.z);
            this.boardGroup.add(mesh);
        }
    }

    setupPreview() {
        this.ghostMesh = null;
        this.shadowMesh = null;
        this.dropLine = null;
        this.showGhost = true;
        this.showShadow = true;
    }

    setupCeiling() {
        this.ceilingWarnings = [];
        for (let x = 0; x < 4; x++) {
            for (let z = 0; z < 4; z++) {
                const geo = new THREE.PlaneGeometry(0.9, 0.9);
                const mat = new THREE.MeshBasicMaterial({
                    color: 0xff2200,
                    transparent: true,
                    opacity: 0,
                    side: THREE.DoubleSide,
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.rotation.x = -Math.PI / 2;
                mesh.position.set(x, 4.0, z);
                this.scene.add(mesh);
                this.ceilingWarnings.push({ mesh, mat, x, z });
            }
        }
    }

    updateCeilingWarnings(gameState) {
        for (const w of this.ceilingWarnings) {
            const height = gameState.getColumnHeight(w.x, w.z);
            w.mat.opacity = height >= 4 ? 0.4 : height === 3 ? 0.15 : 0;
        }
    }

    getBlockAppearance(value) {
        const appearances = {
            2:    { color: 0x8a8a8a, emissive: 0x000000, emissiveIntensity: 0 },
            4:    { color: 0xa08060, emissive: 0x000000, emissiveIntensity: 0 },
            8:    { color: 0xb86b30, emissive: 0x331100, emissiveIntensity: 0.15 },
            16:   { color: 0xd97020, emissive: 0x662200, emissiveIntensity: 0.25 },
            32:   { color: 0xe87010, emissive: 0x993300, emissiveIntensity: 0.35 },
            64:   { color: 0xff6600, emissive: 0xcc3300, emissiveIntensity: 0.5 },
            128:  { color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.6 },
            256:  { color: 0xff2200, emissive: 0xff0000, emissiveIntensity: 0.7 },
            512:  { color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.8 },
            1024: { color: 0xffcc00, emissive: 0xff6600, emissiveIntensity: 0.9 },
            2048:  { color: 0xffff00, emissive: 0xffaa00, emissiveIntensity: 1.0 },
            4096:  { color: 0xffaa00, emissive: 0xff5500, emissiveIntensity: 1.0 },
            8192:  { color: 0xff7700, emissive: 0xcc3300, emissiveIntensity: 1.0 },
            16384: { color: 0xdd3300, emissive: 0xaa1100, emissiveIntensity: 1.0 },
            32768: { color: 0xbb0033, emissive: 0x880022, emissiveIntensity: 1.0 },
            65536:    { color: 0x990055, emissive: 0x660033, emissiveIntensity: 1.0 },
            131072:   { color: 0x7700aa, emissive: 0x550077, emissiveIntensity: 1.0 },
            262144:   { color: 0x5500cc, emissive: 0x3300aa, emissiveIntensity: 1.0 },
            524288:   { color: 0x3311dd, emissive: 0x2200bb, emissiveIntensity: 1.0 },
            1048576:  { color: 0x1a1000, emissive: 0xffd700, emissiveIntensity: 1.2 },
            2097152:  { color: 0x1a0800, emissive: 0xffaa00, emissiveIntensity: 1.2 },
            4194304:  { color: 0x1a0500, emissive: 0xff6600, emissiveIntensity: 1.2 },
            8388608:  { color: 0x1a0000, emissive: 0xff3333, emissiveIntensity: 1.2 },
            16777216: { color: 0x15000a, emissive: 0xff0066, emissiveIntensity: 1.2 },
            33554432: { color: 0x10001a, emissive: 0xcc33ff, emissiveIntensity: 1.2 },
            67108864: { color: 0x0a001a, emissive: 0x8855ff, emissiveIntensity: 1.2 },
            134217728:{ color: 0x00001a, emissive: 0x44aaff, emissiveIntensity: 1.2 },
        };
        return appearances[value] || appearances[134217728];
    }

    getBlockLabel(value) {
        if (value >= 1048576) {
            const m = value / 1048576;
            return m % 1 === 0 ? m + 'M' : m.toFixed(0) + 'M';
        }
        return value.toString();
    }

    createFaceTexture(value, bgColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 512, 512);

        const label = this.getBlockLabel(value);
        const isMega = value >= 1048576;
        let fontSize;
        if (isMega) {
            fontSize = label.length <= 2 ? 160 : label.length <= 3 ? 144 : 112;
        } else {
            fontSize = value >= 1024 ? 112 : value >= 128 ? 128 : value >= 16 ? 144 : 160;
        }
        ctx.font = `900 ${fontSize}px "Black Ops One", "Impact", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 10;
        ctx.strokeText(label, 256, 256);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, 256, 256);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    getCachedTexture(value) {
        if (this.textureCache.has(value)) return this.textureCache.get(value);
        const appearance = this.getBlockAppearance(value);
        const hexColor = '#' + appearance.color.toString(16).padStart(6, '0');
        const texture = this.createFaceTexture(value, hexColor);
        this.textureCache.set(value, texture);
        return texture;
    }

    createBlockMesh(value, opts = {}) {
        const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        const appearance = this.getBlockAppearance(value);
        const transparent = opts.transparent || false;
        const opacity = opts.opacity || 1.0;
        const texture = this.getCachedTexture(value);

        const faceMat = () => new THREE.MeshStandardMaterial({
            map: texture,
            emissive: appearance.emissive,
            emissiveIntensity: appearance.emissiveIntensity * 0.5,
            roughness: 0.7,
            metalness: 0.05,
            flatShading: true,
            transparent,
            opacity,
        });

        const materials = [
            faceMat(),  // +X
            faceMat(),  // -X
            faceMat(),  // +Y (top)
            faceMat(),  // -Y (bottom)
            faceMat(),  // +Z
            faceMat(),  // -Z
        ];

        const mesh = new THREE.Mesh(geo, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.blockValue = value;
        return mesh;
    }

    syncBlocks(gameState, previousState) {
        const newBlocks = new Map();
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                for (let z = 0; z < 4; z++) {
                    const value = gameState.getCell(x, y, z);
                    if (value !== 0) {
                        newBlocks.set(`${x},${y},${z}`, { x, y, z, value });
                    }
                }
            }
        }

        const reusable = [];
        for (const [key, mesh] of this.blockMeshes) {
            if (!newBlocks.has(key) || newBlocks.get(key).value !== mesh.userData.blockValue) {
                reusable.push({ key, mesh });
            }
        }

        const nextMeshes = new Map();

        for (const [key, pos] of newBlocks) {
            const targetPos = new THREE.Vector3(pos.x, pos.y + 0.45, pos.z);
            const existing = this.blockMeshes.get(key);

            if (existing && existing.userData.blockValue === pos.value) {
                existing.position.copy(targetPos);
                nextMeshes.set(key, existing);
                this.blockMeshes.delete(key);
                continue;
            }

            let mesh = null;
            if (previousState) {
                for (let i = 0; i < reusable.length; i++) {
                    const r = reusable[i];
                    if (r.mesh.userData.blockValue === pos.value) {
                        mesh = r.mesh;
                        this.blockMeshes.delete(r.key);
                        reusable.splice(i, 1);
                        break;
                    }
                }
            }

            if (!mesh) {
                mesh = this.createBlockMesh(pos.value);
                this.scene.add(mesh);
            }

            if (previousState) {
                const fromPos = mesh.position.clone();
                if (fromPos.distanceTo(targetPos) > 0.01) {
                    this.animations.push({
                        mesh,
                        from: fromPos,
                        to: targetPos.clone(),
                        progress: 0,
                        speed: 6,
                    });
                } else {
                    mesh.position.copy(targetPos);
                }
            } else {
                mesh.position.copy(targetPos);
            }

            nextMeshes.set(key, mesh);
        }

        for (const [key, mesh] of this.blockMeshes) {
            this.scene.remove(mesh);
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
            } else {
                if (mesh.material.map) mesh.material.map.dispose();
                mesh.material.dispose();
            }
            mesh.geometry.dispose();
        }

        this.blockMeshes = nextMeshes;
    }

    spawnMergeEffect(x, y, z) {
        const geo = new THREE.SphereGeometry(0.4, 8, 8);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffee44,
            transparent: true,
            opacity: 0.5,
        });
        const sphere = new THREE.Mesh(geo, mat);
        sphere.position.set(x, y + 0.45, z);
        this.scene.add(sphere);
        this.mergeEffects.push({
            mesh: sphere,
            life: 0.5,
            decay: 0.05,
        });
    }

    animateDropBlock(x, z, targetY, value, onComplete) {
        const mesh = this.createBlockMesh(value);
        const startY = 7;
        mesh.position.set(x, startY, z);
        this.scene.add(mesh);

        this.animations.push({
            mesh,
            from: new THREE.Vector3(x, startY, z),
            to: new THREE.Vector3(x, targetY + 0.45, z),
            progress: 0,
            speed: 8.5,
            easing: 'gravity',
            onComplete: () => {
                this.scene.remove(mesh);
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
                } else {
                    if (mesh.material.map) mesh.material.map.dispose();
                    mesh.material.dispose();
                }
                mesh.geometry.dispose();
                if (onComplete) onComplete();
            },
        });
    }

    updateAnimations(delta) {
        this.updateClouds(delta);

        for (let i = this.animations.length - 1; i >= 0; i--) {
            const anim = this.animations[i];
            anim.progress += delta * anim.speed;
            if (anim.progress >= 1) {
                anim.mesh.position.copy(anim.to);
                if (anim.onComplete) anim.onComplete();
                this.animations.splice(i, 1);
            } else {
                const t = anim.easing === 'gravity'
                    ? this.easeInCubic(anim.progress)
                    : this.easeOutCubic(anim.progress);
                anim.mesh.position.lerpVectors(anim.from, anim.to, t);
            }
        }

        for (let i = this.mergeEffects.length - 1; i >= 0; i--) {
            const effect = this.mergeEffects[i];
            effect.life -= effect.decay;
            effect.mesh.material.opacity = effect.life;
            effect.mesh.scale.setScalar(1 + (1 - effect.life) * 1.5);
            if (effect.life <= 0) {
                this.scene.remove(effect.mesh);
                effect.mesh.geometry.dispose();
                effect.mesh.material.dispose();
                this.mergeEffects.splice(i, 1);
            }
        }
    }

    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    easeInCubic(t) {
        return t * t * t;
    }

    get isAnimating() {
        return this.animations.length > 0;
    }

    updatePreview(nextBlock, landingY = 0) {
        if (this.ghostMesh) {
            this.scene.remove(this.ghostMesh);
            if (Array.isArray(this.ghostMesh.material)) {
                this.ghostMesh.material.forEach(m => {
                    if (m.map) m.map.dispose();
                    m.dispose();
                });
            } else {
                if (this.ghostMesh.material.map) this.ghostMesh.material.map.dispose();
                this.ghostMesh.material.dispose();
            }
            this.ghostMesh.geometry.dispose();
            this.ghostMesh = null;
        }
        if (this.shadowMesh) {
            this.scene.remove(this.shadowMesh);
            this.shadowMesh.geometry.dispose();
            this.shadowMesh.material.dispose();
            this.shadowMesh = null;
        }
        if (this.dropLine) {
            this.scene.remove(this.dropLine);
            this.dropLine.geometry.dispose();
            this.dropLine.material.dispose();
            this.dropLine = null;
        }

        if (!nextBlock) return;

        if (this.showGhost) {
            this.ghostMesh = this.createBlockMesh(nextBlock.value, { transparent: true, opacity: 0.8 });
            this.ghostMesh.castShadow = false;
            this.ghostMesh.position.set(nextBlock.x, 5.5, nextBlock.z);
            this.ghostMesh.renderOrder = 100;
            if (Array.isArray(this.ghostMesh.material)) {
                this.ghostMesh.material.forEach(m => { m.depthTest = false; });
            } else {
                this.ghostMesh.material.depthTest = false;
            }
            this.scene.add(this.ghostMesh);

            const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(nextBlock.x, 4.9, nextBlock.z),
                new THREE.Vector3(nextBlock.x, landingY + 0.45, nextBlock.z),
            ]);
            const lineMat = new THREE.LineDashedMaterial({
                color: 0x00ccff,
                dashSize: 0.3,
                gapSize: 0.2,
                transparent: true,
                opacity: 0.4,
            });
            this.dropLine = new THREE.Line(lineGeo, lineMat);
            this.dropLine.computeLineDistances();
            this.scene.add(this.dropLine);
        }

        if (this.showShadow) {
            const isOverflow = landingY >= 4;
            const shadowGeo = new THREE.RingGeometry(0.25, 0.45, 16);
            const shadowMat = new THREE.MeshBasicMaterial({
                color: isOverflow ? 0xff2200 : 0x00ffcc,
                transparent: true,
                opacity: isOverflow ? 0.8 : 0.6,
                side: THREE.DoubleSide,
            });
            this.shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
            this.shadowMesh.rotation.x = -Math.PI / 2;
            const shadowY = landingY > 0 ? landingY - 0.03 : 0.02;
            this.shadowMesh.position.set(nextBlock.x, shadowY, nextBlock.z);
            this.scene.add(this.shadowMesh);
        }
    }

    animatePreview(time) {
        if (this.ghostMesh) {
            this.ghostMesh.position.y = 5.5 + Math.sin(time * 2) * 0.15;
        }
        if (this.shadowMesh) {
            this.shadowMesh.material.opacity = 0.4 + Math.sin(time * 3) * 0.2;
            this.shadowMesh.rotation.z = time * 0.5;
        }
        if (this.dropLine) {
            this.dropLine.material.opacity = 0.2 + Math.sin(time * 2.5) * 0.15;
        }
    }

    setCameraMode(enabled) {
        this.controls.enabled = enabled;
    }

    resetCamera() {
        this.camera.position.copy(this.initialCameraPos);
        this.controls.target.copy(this.initialCameraTarget);
        this.controls.update();
    }

    render() {
        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
