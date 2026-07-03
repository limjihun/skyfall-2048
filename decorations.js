import * as THREE from 'three';

const DINO_STAGES = [
    '🦎', '🐍', '🐇', '🐈', '🐢', '🐓', '🐕', '🦆', '🪿', '🦌',
    '🐊', '🦢', '🦩', '🦉', '🐎', '🦚', '🦜', '🦅', '🐄', '🐪',
    '🦘', '🦬', '🦛', '🦏', '🐘', '🦒', '🦕', '🦖', '🐉',
];
const DINO_SIZES = [
    1.0, 1.0, 1.05, 1.05, 1.1, 1.1, 1.1, 1.15, 1.15, 1.15,
    1.2, 1.2, 1.2, 1.3, 1.3, 1.4, 1.4, 1.5, 1.5, 1.6,
    1.6, 1.7, 1.7, 1.75, 1.8, 1.85, 1.9, 1.95, 2.0,
];
const HUE_VARIANTS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

export class Decorations {
    constructor(camera, scene, audio, onHatch) {
        this.camera = camera;
        this.scene = scene;
        this.audio = audio;
        this.onHatchCallback = onHatch || null;
        this.creatures = [];
        this.fadeOuts = [];
        this.fadeIns = [];

        this.eggHP = 512;
        this.eggMaxHP = 512;
        this.eggMesh = null;
        this.eggShake = 0;
        this.eggCracks = 0;
        this.dinoStage = 0;
        this.eggHue = 0;

        this.setupPlatform();
        this.spawnEgg();
    }

    setupPlatform() {
        this.group = new THREE.Group();
        this.group.position.set(1.5, 7, 1.5);
        this.scene.add(this.group);

        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(107, 90, 69, 0.4)';
        ctx.beginPath();
        ctx.ellipse(128, 64, 120, 50, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(80, 65, 45, 0.5)';
        ctx.lineWidth = 4;
        ctx.stroke();

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.1 });
        this.platform = new THREE.Sprite(mat);
        this.platform.scale.set(5, 2.5, 1);
        this.platform.position.set(0, -0.3, 0);
        this.platform.renderOrder = 0;
        this.platform.material.depthWrite = false;
        this.platform.material.depthTest = false;
        this.group.add(this.platform);
    }

    spawnEgg() {
        const isMaxStage = this.dinoStage >= DINO_STAGES.length - 1;
        const isShiny = isMaxStage || Math.random() < 0.1;
        this.eggHue = isShiny ? HUE_VARIANTS[Math.floor(Math.random() * HUE_VARIANTS.length)] : 0;

        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.font = '96px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🥚', 64, 64);
        if (this.eggHue) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `hsl(${this.eggHue}, 70%, 60%)`;
            ctx.globalAlpha = 0.45;
            ctx.fillRect(0, 0, 128, 128);
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
        }

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.1, depthTest: false });
        const sprite = new THREE.Sprite(mat);

        sprite.position.set(0, 0.5, 0);
        sprite.scale.set(0, 0, 1);
        sprite.renderOrder = 1;
        this.group.add(sprite);

        this.eggMesh = sprite;
        this.eggCanvas = canvas;
        this.eggCtx = ctx;
        this.eggTexture = texture;
        this.crackSeeds = [];
        this.crackLastX = 36;
        this.crackLastY = 56;
        this.lastCrackCount = 0;

        this.removeSparkles();

        if (this.eggHue) {
            this.eggSparkles = this.createSparkles();
        }

        this.fadeIns.push({
            mesh: sprite,
            targetScaleX: 1.2,
            targetScaleY: 1.4,
            progress: 0,
        });
    }

    createSparkles() {
        const sparkles = [];
        for (let i = 0; i < 8; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.font = '32px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = `hsl(${this.eggHue}, 80%, 55%)`;
            ctx.fillText('✦', 32, 32);

            const texture = new THREE.CanvasTexture(canvas);
            const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.05 });
            const sprite = new THREE.Sprite(mat);

            const angle = Math.random() * Math.PI * 2;
            const rx = 0.4 + Math.random() * 0.2;
            const ry = 0.4 + Math.random() * 0.15;
            sprite.position.set(Math.cos(angle) * rx, 0.6 + Math.sin(angle) * ry, 0);
            sprite.scale.set(0.25, 0.25, 1);
            sprite.material.opacity = 0;
            this.group.add(sprite);

            sparkles.push({
                mesh: sprite,
                phase: Math.random() * Math.PI * 2,
                speed: 1.5 + Math.random() * 1.5,
            });
        }
        return sparkles;
    }

    removeSparkles() {
        if (!this.eggSparkles) return;
        for (const s of this.eggSparkles) {
            this.group.remove(s.mesh);
            s.mesh.material.map.dispose();
            s.mesh.material.dispose();
        }
        this.eggSparkles = null;
    }

    repositionSparkle(s) {
        const angle = Math.random() * Math.PI * 2;
        const rx = 0.4 + Math.random() * 0.2;
        const ry = 0.4 + Math.random() * 0.15;
        s.mesh.position.set(Math.cos(angle) * rx, 0.6 + Math.sin(angle) * ry, 0);
    }

    renderEgg() {
        const ctx = this.eggCtx;
        ctx.clearRect(0, 0, 128, 128);
        ctx.font = '96px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🥚', 64, 64);
        if (this.eggHue) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = `hsl(${this.eggHue}, 70%, 60%)`;
            ctx.globalAlpha = 0.45;
            ctx.fillRect(0, 0, 128, 128);
            ctx.globalAlpha = 1.0;
            ctx.globalCompositeOperation = 'source-over';
        }

        const crackRatio = 1 - (this.eggHP / this.eggMaxHP);
        if (crackRatio > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(64, 64, 28, 36, 0, 0, Math.PI * 2);
            ctx.clip();

            ctx.strokeStyle = '#4a3520';
            ctx.lineWidth = 2;
            const numSegments = Math.floor(crackRatio * 10) + 1;

            if (!this.crackSeeds || this.crackSeeds.length < numSegments) {
                this.crackSeeds = this.crackSeeds || [];
                if (this.crackSeeds.length === 0) {
                    this.crackLastX = 36;
                    this.crackLastY = 56;
                }
                while (this.crackSeeds.length < numSegments) {
                    const goDown = this.crackSeeds.length % 2 === 0;
                    const len = 7 + Math.random() * 5;
                    const dx = len * Math.cos(Math.PI / 4) + (Math.random() - 0.5) * 2;
                    const dy = (goDown ? 1 : -1) * len * Math.sin(Math.PI / 4);
                    const endX = this.crackLastX + dx;
                    const endY = this.crackLastY + dy;
                    this.crackSeeds.push({
                        x1: this.crackLastX,
                        y1: this.crackLastY,
                        x2: endX,
                        y2: endY,
                    });
                    this.crackLastX = endX;
                    this.crackLastY = endY;
                }
            }

            for (let i = 0; i < numSegments; i++) {
                const seg = this.crackSeeds[i];
                ctx.beginPath();
                ctx.moveTo(seg.x1, seg.y1);
                ctx.lineTo(seg.x2, seg.y2);
                ctx.stroke();
            }

            ctx.restore();
        }

        this.eggTexture.needsUpdate = true;
    }

    onMerge(value) {
        if (!this.eggMesh) {
            this.pendingDamage = (this.pendingDamage || 0) + value;
            return;
        }
        value += (this.pendingDamage || 0);
        this.pendingDamage = 0;
        this.applyDamage(value);
    }

    applyDamage(value) {
        this.eggHP -= value;
        this.eggShake = 0.4;

        if (this.eggHP <= 0) {
            const overflow = -this.eggHP;
            this.hatchEgg(overflow);
        } else {
            const crackRatio = 1 - (this.eggHP / this.eggMaxHP);
            const numSegments = Math.floor(crackRatio * 10) + 1;
            if (numSegments !== this.lastCrackCount) {
                this.lastCrackCount = numSegments;
                this.renderEgg();
            }
        }
    }

    hatchEgg(overflow = 0) {
        if (this.eggMesh) {
            this.fadeOuts.push({ mesh: this.eggMesh, opacity: 1.0 });
            this.eggMesh = null;
        }
        this.removeSparkles();

        for (const c of this.creatures) {
            this.shrinkAnimations = this.shrinkAnimations || [];
            this.shrinkAnimations.push({
                mesh: c.mesh,
                startScale: c.mesh.scale.x,
                targetScale: c.mesh.scale.x * 0.95,
                progress: 0,
            });
        }

        const hue = this.eggHue;
        const isMaxStage = this.dinoStage >= DINO_STAGES.length - 1;

        if (isMaxStage) {
            const randomStage = Math.floor(Math.random() * DINO_STAGES.length);
            this.spawnDino(randomStage, hue);
        } else {
            this.spawnDino(this.dinoStage, hue);
        }

        if (this.onHatchCallback) this.onHatchCallback();

        if (!isMaxStage) {
            this.dinoStage = Math.min(this.dinoStage + 1, DINO_STAGES.length - 1);
        }
        this.eggMaxHP = Math.floor(512 * Math.pow(1.25, this.creatures.length) + (this.maxBlockValue || 0) / 2);
        this.eggHP = this.eggMaxHP;
        this.eggCracks = 0;
        this.pendingDamage = overflow;

        setTimeout(() => {
            this.spawnEgg();
            this.renderEgg();
            if (this.pendingDamage > 0) {
                const dmg = this.pendingDamage;
                this.pendingDamage = 0;
                this.applyDamage(dmg);
            }
        }, 600);

        if (this.audio) this.audio.playCreature();
    }

    spawnDino(stageIdx, hue = 0) {
        const emoji = DINO_STAGES[stageIdx];
        const size = DINO_SIZES[Math.min(this.creatures.length, DINO_SIZES.length - 1)];

        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.font = '96px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (hue) {
            ctx.filter = `hue-rotate(${hue}deg)`;
        }
        ctx.fillText(emoji, 64, 64);
        ctx.filter = 'none';

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.1 });
        const sprite = new THREE.Sprite(mat);

        sprite.position.set(0, 0.5, 0);
        sprite.scale.set(0, 0, 1);
        this.group.add(sprite);

        const targetPos = this.getRandomPositionOnPlatform();

        this.fadeIns.push({
            mesh: sprite,
            targetScaleX: size,
            targetScaleY: size,
            progress: 0,
        });

        this.jumpAnimations = this.jumpAnimations || [];
        this.jumpAnimations.push({
            mesh: sprite,
            startX: 0,
            startY: 0.5,
            endX: targetPos.x,
            endY: targetPos.y,
            progress: 0,
        });

        this.creatures.push({
            mesh: sprite,
            hue: hue,
            baseX: targetPos.x,
            baseY: targetPos.y,
            walkRadius: 0.2 + Math.random() * 0.3,
            offset: Math.random() * Math.PI * 2,
            speed: 0.8 + Math.random() * 0.8,
            jumping: true,
        });
    }

    onBlockCreated(value, maxBlockValue) {
        this.maxBlockValue = maxBlockValue || 0;
        this.onMerge(value);
    }

    getSaveData() {
        return {
            eggHP: this.eggHP,
            eggMaxHP: this.eggMaxHP,
            dinoStage: this.dinoStage,
            eggHue: this.eggHue,
            crackSeeds: this.crackSeeds,
            crackLastX: this.crackLastX,
            crackLastY: this.crackLastY,
            lastCrackCount: this.lastCrackCount,
            creatures: this.creatures.map((c, i) => ({
                stage: Math.min(i, DINO_STAGES.length - 1),
                hue: c.hue || 0,
                baseX: c.baseX,
                baseY: c.baseY,
                walkRadius: c.walkRadius,
                offset: c.offset,
                speed: c.speed,
            })),
        };
    }

    loadSaveData(data) {
        if (!data) return;

        this.eggHP = data.eggHP;
        this.eggMaxHP = data.eggMaxHP;
        this.dinoStage = data.dinoStage;
        this.eggHue = data.eggHue || 0;
        this.crackSeeds = data.crackSeeds || [];
        this.crackLastX = data.crackLastX || 36;
        this.crackLastY = data.crackLastY || 64;
        this.lastCrackCount = data.lastCrackCount || 0;

        for (const saved of (data.creatures || [])) {
            const stageIdx = Math.min(saved.stage, DINO_STAGES.length - 1);
            const emoji = DINO_STAGES[stageIdx];
            const size = DINO_SIZES[stageIdx];
            const hue = saved.hue || 0;

            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            ctx.font = '96px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            if (hue) {
                ctx.filter = `hue-rotate(${hue}deg)`;
            }
            ctx.fillText(emoji, 64, 64);
            ctx.filter = 'none';

            const texture = new THREE.CanvasTexture(canvas);
            const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.1 });
            const sprite = new THREE.Sprite(mat);

            sprite.position.set(saved.baseX, saved.baseY || -0.5, 0);
            sprite.scale.set(size, size, 1);
            this.group.add(sprite);

            this.creatures.push({
                mesh: sprite,
                hue: hue,
                baseX: saved.baseX,
                baseY: saved.baseY || -0.5,
                walkRadius: saved.walkRadius,
                offset: saved.offset,
                speed: saved.speed,
                jumping: false,
            });
        }

        this.removeSparkles();
        if (this.eggHue && this.eggMesh) {
            this.eggSparkles = this.createSparkles();
        }

        this.renderEgg();
    }

    getRandomPositionOnPlatform() {
        const x = (Math.random() - 0.5) * 3.0;
        const y = -0.3 - Math.random() * 0.8;
        return { x, y };
    }

    update(time) {
        this.group.quaternion.copy(this.camera.quaternion);

        if (this.eggMesh && this.eggShake > 0) {
            this.eggMesh.position.x = Math.sin(time * 40) * this.eggShake * 0.15;
            this.eggShake *= 0.92;
            if (this.eggShake < 0.01) {
                this.eggShake = 0;
                this.eggMesh.position.x = 0;
            }
        }

        if (this.eggSparkles) {
            for (const s of this.eggSparkles) {
                const v = Math.sin(time * s.speed + s.phase);
                if (v > 0.7) {
                    s.mesh.material.opacity = (v - 0.7) / 0.3;
                } else if (v < -0.7 && s.mesh.material.opacity > 0) {
                    s.mesh.material.opacity = 0;
                    this.repositionSparkle(s);
                } else {
                    s.mesh.material.opacity = 0;
                }
            }
        }

        for (const c of this.creatures) {
            if (c.jumping) continue;
            const t = time * c.speed + c.offset;
            const wx = c.baseX + Math.sin(t * 0.4) * c.walkRadius;
            c.mesh.position.x = Math.max(-2.2, Math.min(2.2, wx));
            c.mesh.position.y = c.baseY + Math.abs(Math.sin(t * 1.6)) * 0.04;
            c.mesh.renderOrder = 2 + Math.round(c.mesh.scale.x * 10);
        }

        if (this.jumpAnimations) {
            for (let i = this.jumpAnimations.length - 1; i >= 0; i--) {
                const j = this.jumpAnimations[i];
                j.progress += 0.025;
                if (j.progress >= 1) {
                    j.mesh.position.x = j.endX;
                    j.mesh.position.y = j.endY;
                    const c = this.creatures.find(c => c.mesh === j.mesh);
                    if (c) c.jumping = false;
                    this.jumpAnimations.splice(i, 1);
                } else {
                    const t = j.progress;
                    j.mesh.position.x = j.startX + (j.endX - j.startX) * t;
                    j.mesh.position.y = j.startY + (j.endY - j.startY) * t - Math.sin(t * Math.PI) * 0.5;
                }
            }
        }

        if (this.shrinkAnimations) {
            for (let i = this.shrinkAnimations.length - 1; i >= 0; i--) {
                const s = this.shrinkAnimations[i];
                s.progress += 0.03;
                if (s.progress >= 1) {
                    s.mesh.scale.set(s.targetScale, s.targetScale, 1);
                    this.shrinkAnimations.splice(i, 1);
                } else {
                    const t = s.progress;
                    const scale = s.startScale + (s.targetScale - s.startScale) * t;
                    s.mesh.scale.set(scale, scale, 1);
                }
            }
        }

        for (let i = this.fadeOuts.length - 1; i >= 0; i--) {
            const f = this.fadeOuts[i];
            f.opacity -= 0.03;
            f.mesh.material.opacity = f.opacity;
            f.mesh.scale.multiplyScalar(0.97);
            if (f.opacity <= 0) {
                this.group.remove(f.mesh);
                f.mesh.material.map.dispose();
                f.mesh.material.dispose();
                this.fadeOuts.splice(i, 1);
            }
        }

        for (let i = this.fadeIns.length - 1; i >= 0; i--) {
            const f = this.fadeIns[i];
            f.progress += 0.05;
            if (f.progress >= 1) {
                f.mesh.scale.set(f.targetScaleX, f.targetScaleY, 1);
                this.fadeIns.splice(i, 1);
            } else {
                const t = 1 - Math.pow(1 - f.progress, 3);
                f.mesh.scale.set(f.targetScaleX * t, f.targetScaleY * t, 1);
            }
        }
    }
}
