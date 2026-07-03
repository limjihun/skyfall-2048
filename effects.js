import * as THREE from 'three';

export class Effects {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    setupBackgroundMeteors() {
        const count = 30;
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = [];

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 40;
            positions[i * 3 + 1] = Math.random() * 30 + 10;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
            velocities.push({
                x: (Math.random() - 0.5) * 0.02,
                y: -(Math.random() * 0.08 + 0.04),
                z: (Math.random() - 0.5) * 0.02,
            });
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0xff6600,
            size: 0.3,
            transparent: true,
            opacity: 0.7,
        });

        this.meteorPoints = new THREE.Points(geo, mat);
        this.meteorVelocities = velocities;
        this.scene.add(this.meteorPoints);
    }

    spawnDropTrail(x, z, startY, endY) {
        const trailCount = 8;
        for (let i = 0; i < trailCount; i++) {
            const geo = new THREE.SphereGeometry(0.08);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xff4400,
                transparent: true,
                opacity: 1,
            });
            const particle = new THREE.Mesh(geo, mat);
            particle.position.set(
                x + (Math.random() - 0.5) * 0.3,
                startY - i * 0.5,
                z + (Math.random() - 0.5) * 0.3
            );
            this.scene.add(particle);
            this.particles.push({
                mesh: particle,
                vy: -(Math.random() * 0.05 + 0.02),
                life: 1.0,
                decay: 0.02 + Math.random() * 0.02,
            });
        }
    }

    update(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.mesh.position.y += p.vy;
            p.life -= p.decay;
            p.mesh.material.opacity = p.life;

            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.particles.splice(i, 1);
            }
        }
    }
}
