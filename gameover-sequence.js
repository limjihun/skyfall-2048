import * as THREE from 'three';
import { GameState } from './game.js';

export class GameOverSequence {
    constructor(renderer, decorations, audio) {
        this.renderer = renderer;
        this.scene = renderer.scene;
        this.camera = renderer.camera;
        this.decorations = decorations;
        this.audio = audio;
        this.meteorMesh = null;
        this.explosionEl = null;
        this.titleEl = null;
    }

    start(dropX, dropZ, dropValue, collideY = 4) {
        this.renderer.updatePreview(null);
        this.hideHUD();

        const mesh = this.renderer.createBlockMesh(dropValue);
        mesh.position.set(dropX, 8, dropZ);
        this.scene.add(mesh);
        this.meteorMesh = mesh;

        this.skyProgress = 0;
        this.originalBackground = this.scene.background;

        if (this.audio) this.audio.playFallWhoosh(3.4);

        this.phase1Collide(mesh, dropX, dropZ, dropValue, collideY);
    }

    hideHUD() {
        const ids = ['ui-overlay', 'ranking-toggle', 'settings-toggle', 'settings-panel', 'camera-controls'];
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        }
    }

    updateSkyDoom(progress) {
        this.skyProgress = progress;
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 256);

        const r = progress;
        const topR = Math.round(74 + (140 - 74) * r);
        const topG = Math.round(144 + (40 - 144) * r);
        const topB = Math.round(200 + (30 - 200) * r);
        const midR = Math.round(106 + (180 - 106) * r);
        const midG = Math.round(160 + (50 - 160) * r);
        const midB = Math.round(192 + (20 - 192) * r);
        const botR = Math.round(74 + (60 - 74) * r);
        const botG = Math.round(58 + (20 - 58) * r);
        const botB = Math.round(42 + (15 - 42) * r);

        grad.addColorStop(0, `rgb(${topR},${topG},${topB})`);
        grad.addColorStop(0.5, `rgb(${midR},${midG},${midB})`);
        grad.addColorStop(1.0, `rgb(${botR},${botG},${botB})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1, 256);

        const texture = new THREE.CanvasTexture(canvas);
        if (this.scene.background && this.scene.background !== this.originalBackground) {
            this.scene.background.dispose();
        }
        this.scene.background = texture;

        document.body.style.background = `linear-gradient(to bottom, rgb(${topR},${topG},${topB}) 0%, rgb(${midR},${midG},${midB}) 50%, rgb(${botR},${botG},${botB}) 100%)`;
    }

    phase1Collide(mesh, dropX, dropZ, dropValue, collideY) {
        const startY = 8;
        const hitY = collideY + 0.5;
        const duration = 400;
        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const t = progress * progress;

            mesh.position.y = startY + (hitY - startY) * t;
            this.updateSkyDoom(progress * 0.1);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.phase1Bounce(mesh, dropX, dropZ, dropValue);
            }
        };
        animate();
    }

    phase1Bounce(mesh, dropX, dropZ, dropValue) {
        const startX = mesh.position.x;
        const startZ = mesh.position.z;
        const startY = mesh.position.y;

        const dirX = (startX - 1.5) || (Math.random() - 0.5);
        const dirZ = (startZ - 1.5) || (Math.random() - 0.5);
        const len = Math.sqrt(dirX * dirX + dirZ * dirZ) || 1;
        const nx = dirX / len;
        const nz = dirZ / len;

        const bounceDistX = nx * 6;
        const bounceDistZ = nz * 6;
        const peakY = startY + 3;
        const endY = -8;
        const duration = 1200;
        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            mesh.position.x = startX + bounceDistX * progress;
            mesh.position.z = startZ + bounceDistZ * progress;

            if (progress < 0.3) {
                const up = progress / 0.3;
                mesh.position.y = startY + (peakY - startY) * up;
            } else {
                const down = (progress - 0.3) / 0.7;
                mesh.position.y = peakY + (endY - peakY) * (down * down);
            }

            mesh.rotation.x += 0.08;
            mesh.rotation.z += 0.06;

            this.updateMeteorHeat(mesh, progress);
            this.updateSkyDoom(0.1 + progress * 0.2);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.phase2ClearAndFall(mesh, dropX, dropZ, dropValue);
            }
        };
        animate();
    }

    phase2ClearAndFall(mesh, dropX, dropZ, dropValue) {
        for (const [key, blockMesh] of this.renderer.blockMeshes) {
            this.scene.remove(blockMesh);
        }
        this.renderer.blockMeshes.clear();

        this.renderer.ground.visible = false;
        if (this.renderer.ceilingWarnings) {
            this.renderer.ceilingWarnings.forEach(w => w.mesh.visible = false);
        }

        this.scene.children.forEach(child => {
            if (child === mesh) return;
            if (child.isLight) return;
            child.visible = false;
        });

        this.decorations.group.visible = false;

        mesh.position.set(0, 15, 0);
        const endY = -10;
        const duration = 1000;
        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const t = progress * progress * progress;

            mesh.position.y = 15 + (endY - 15) * t;
            mesh.rotation.x += 0.05;
            mesh.rotation.z += 0.04;

            this.updateMeteorHeat(mesh, 0.5 + progress * 0.5);
            this.updateSkyDoom(0.3 + progress * 0.3);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.phase3ShowDecoAndImpact(mesh, dropValue);
            }
        };
        animate();
    }

    phase3ShowDecoAndImpact(mesh, dropValue) {
        this.decorations.group.visible = true;
        this.decorations.group.position.set(1.5, 2, 1.5);

        this.camera.position.set(1.5, 6, 10);
        this.camera.lookAt(1.5, 2, 1.5);
        if (this.renderer.controls) {
            this.renderer.controls.target.set(1.5, 2, 1.5);
            this.renderer.controls.enabled = false;
        }

        mesh.position.set(1.5, 12, 1.5);

        if (this.audio) this.audio.playFallWhoosh(0.8);

        const endY = 2.3;
        const duration = 800;
        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const t = progress * progress * progress;

            mesh.position.y = 12 + (endY - 12) * t;
            mesh.rotation.x += 0.06;
            mesh.rotation.z += 0.05;

            this.updateMeteorHeat(mesh, 1.0);
            this.updateSkyDoom(0.6 + progress * 0.4);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.phase4Explosion(mesh);
            }
        };
        animate();
    }

    phase4Explosion(mesh) {
        this.scene.remove(mesh);
        this.disposeMesh(mesh);

        if (this.audio) this.audio.playExplosion();

        const container = document.getElementById('game-container');
        this.explosionEl = document.createElement('div');
        this.explosionEl.className = 'gameover-explosion';
        this.explosionEl.textContent = '💥';
        container.appendChild(this.explosionEl);

        setTimeout(() => {
            this.explosionEl.classList.add('fade-out');
            this.phase4StartFire();
        }, 800);
    }

    phase4StartFire() {
        this.decorations.removeSparkles();

        const fireSprites = [];

        for (const c of this.decorations.creatures) {
            const size = c.mesh.scale.x;
            this.replaceWithFire(c.mesh, size, fireSprites);
        }
        this.decorations.creatures = [];

        if (this.decorations.eggMesh) {
            const size = this.decorations.eggMesh.scale.x;
            this.replaceWithFire(this.decorations.eggMesh, size, fireSprites);
            this.decorations.eggMesh = null;
        }

        if (this.audio) this.audio.playBurning();

        this.phase4Burn(fireSprites);
    }

    replaceWithFire(originalMesh, size, fireSprites) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.font = '96px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔥', 64, 64);

        const texture = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.1 });
        const sprite = new THREE.Sprite(mat);

        sprite.position.copy(originalMesh.position);
        sprite.scale.set(size * 1.2, size * 1.2, 1);

        this.decorations.group.remove(originalMesh);
        originalMesh.material.map.dispose();
        originalMesh.material.dispose();

        this.decorations.group.add(sprite);
        fireSprites.push({ mesh: sprite, baseX: sprite.position.x, baseY: sprite.position.y });
    }

    phase4Burn(fireSprites) {
        const duration = 1500;
        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            for (const f of fireSprites) {
                f.mesh.position.x = f.baseX + Math.sin(elapsed * 0.01 + f.baseX * 5) * 0.05;
                f.mesh.position.y = f.baseY + Math.sin(elapsed * 0.013 + f.baseY * 3) * 0.04;
                f.mesh.scale.multiplyScalar(0.998);
            }

            if (progress > 0.4) {
                const fadeProgress = (progress - 0.4) / 0.6;
                const alpha = 1 - fadeProgress;
                for (const f of fireSprites) {
                    f.mesh.material.opacity = alpha;
                }
                this.decorations.platform.material.opacity = alpha;
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                for (const f of fireSprites) {
                    this.decorations.group.remove(f.mesh);
                    f.mesh.material.map.dispose();
                    f.mesh.material.dispose();
                }
                this.decorations.group.visible = false;
                this.phase5Title();
            }
        };
        animate();
    }

    phase5Title() {
        const container = document.getElementById('game-container');
        const scoreRaw = document.getElementById('score-value').textContent;
        const score = Number(scoreRaw.replace(/,/g, '')).toLocaleString();

        this.titleEl = document.createElement('div');
        this.titleEl.className = 'gameover-title';
        const maxBlock = this.maxBlock ? this.maxBlock.toLocaleString() : '-';
        this.titleEl.innerHTML = `
            <h1>SKYFALL 2048</h1>
            <p class="gameover-score">SCORE: ${score}</p>
            <p class="gameover-score gameover-maxblock">최고블록: ${maxBlock}</p>
            <p class="gameover-rank" id="gameover-rank-text"></p>
            <button class="gameover-restart" id="gameover-restart-btn">다시 시작</button>
            <button class="gameover-ranking-btn" id="gameover-ranking-btn">랭킹 보기</button>
        `;

        container.appendChild(this.titleEl);

        document.getElementById('gameover-restart-btn').addEventListener('click', () => {
            sessionStorage.setItem('skyfall2048_restart', '1');
            GameState.clearSave();
            location.reload();
        });

        document.getElementById('gameover-ranking-btn').addEventListener('click', () => {
            document.getElementById('ranking-panel').classList.add('open');
            if (typeof window.loadRanking === 'function') window.loadRanking();
        });

        setTimeout(() => this.phase6ShowBoard(), 800);
    }

    phase6ShowBoard() {
        if (!this.lastGrid) return;

        this.renderer.ground.visible = true;
        this.renderer.boardGroup.visible = true;

        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                for (let z = 0; z < 4; z++) {
                    const value = this.lastGrid[x][y][z];
                    if (value === 0) continue;
                    const mesh = this.renderer.createBlockMesh(value);
                    mesh.position.set(x, y + 0.45, z);
                    mesh.scale.set(0, 0, 0);
                    this.scene.add(mesh);
                    this.renderer.blockMeshes.set(`${x},${y},${z}`, mesh);
                }
            }
        }

        this.camera.position.copy(this.renderer.initialCameraPos);
        this.renderer.controls.target.set(1.5, 4.5, 1.5);
        this.renderer.controls.enabled = true;
        this.renderer.controls.update();

        this.titleEl.classList.add('gameover-title-top');

        const meshes = [...this.renderer.blockMeshes.values()];
        const duration = 400;
        const startTime = performance.now();

        const animate = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const t = 1 - Math.pow(1 - progress, 3);

            for (const mesh of meshes) {
                mesh.scale.setScalar(t);
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }


    updateMeteorHeat(mesh, progress) {
        const heatColor = new THREE.Color().lerpColors(
            new THREE.Color(0x8a8a8a),
            new THREE.Color(0xff2200),
            progress
        );
        const emissiveColor = new THREE.Color().lerpColors(
            new THREE.Color(0x000000),
            new THREE.Color(0xff4400),
            progress
        );

        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(mat => {
                mat.emissive = emissiveColor;
                mat.emissiveIntensity = progress * 1.5;
            });
        }
    }

    disposeMesh(mesh) {
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
        } else {
            if (mesh.material.map) mesh.material.map.dispose();
            mesh.material.dispose();
        }
        mesh.geometry.dispose();
    }
}
