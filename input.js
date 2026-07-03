export class InputHandler {
    constructor(onMove, onGameInput) {
        this.onMove = onMove;
        this.onGameInput = onGameInput || null;
        this.enabled = true;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.minSwipeDistance = 30;

        this.setupKeyboard();
        this.setupTouch();
    }

    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            let direction = null;
            const key = e.key;
            const code = e.code;

            switch (true) {
                case key === 'ArrowLeft' || key === 'a' || key === 'A' || key === 'ㅁ' || code === 'KeyA':
                    direction = 'x-'; break;
                case key === 'ArrowRight' || key === 'd' || key === 'D' || key === 'ㅇ' || code === 'KeyD':
                    direction = 'x+'; break;
                case key === 'ArrowUp' || key === 'w' || key === 'W' || key === 'ㅈ' || code === 'KeyW':
                    direction = 'z-'; break;
                case key === 'ArrowDown' || key === 's' || key === 'S' || key === 'ㄴ' || code === 'KeyS':
                    direction = 'z+'; break;
            }

            if (direction) {
                e.preventDefault();
                if (!this.enabled && this.onGameInput) {
                    this.onGameInput();
                }
                if (!this.enabled) return;
                this.onMove(direction);
            }
        });
    }

    setupTouch() {
        const canvas = document.getElementById('game-canvas');

        canvas.addEventListener('touchstart', (e) => {
            if (!this.enabled) return;
            const touch = e.touches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
        }, { passive: true });

        canvas.addEventListener('touchend', (e) => {
            if (!this.enabled) return;
            const touch = e.changedTouches[0];
            const dx = touch.clientX - this.touchStartX;
            const dy = touch.clientY - this.touchStartY;

            if (Math.abs(dx) < this.minSwipeDistance && Math.abs(dy) < this.minSwipeDistance) return;

            let direction;
            if (Math.abs(dx) > Math.abs(dy)) {
                direction = dx > 0 ? 'x+' : 'x-';
            } else {
                direction = dy > 0 ? 'z+' : 'z-';
            }

            this.onMove(direction);
        }, { passive: true });
    }
}
