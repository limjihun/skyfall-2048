const GAME_VERSION = 3;

export class GameState {
    constructor() {
        this.grid = this.createGrid();
        this.score = 0;
        this.nextBlock = null;
        this.isGameOver = false;
        this.hatchCount = 0;
        this.generateNextBlock();
    }

    save(decoData) {
        const data = {
            version: GAME_VERSION,
            grid: this.grid,
            score: this.score,
            nextBlock: this.nextBlock,
            hatchCount: this.hatchCount,
            decorations: decoData || null,
        };
        localStorage.setItem('skyfall2048_save', JSON.stringify(data));
    }

    load() {
        const raw = localStorage.getItem('skyfall2048_save');
        if (!raw) return false;
        try {
            const data = JSON.parse(raw);
            if (data.version !== GAME_VERSION) return false;
            this.grid = data.grid;
            this.score = data.score;
            this.nextBlock = data.nextBlock;
            this.hatchCount = data.hatchCount || 0;
            this.decoSaveData = data.decorations || null;
            this.isGameOver = false;
            return true;
        } catch (e) {
            return false;
        }
    }

    static clearSave() {
        localStorage.removeItem('skyfall2048_save');
    }

    createGrid() {
        const grid = [];
        for (let x = 0; x < 4; x++) {
            grid[x] = [];
            for (let y = 0; y < 4; y++) {
                grid[x][y] = [];
                for (let z = 0; z < 4; z++) {
                    grid[x][y][z] = 0;
                }
            }
        }
        return grid;
    }

    getCell(x, y, z) {
        if (x < 0 || x >= 4 || y < 0 || y >= 4 || z < 0 || z >= 4) return -1;
        return this.grid[x][y][z];
    }

    setCell(x, y, z, value) {
        if (x < 0 || x >= 4 || y < 0 || y >= 4 || z < 0 || z >= 4) return;
        this.grid[x][y][z] = value;
    }

    getColumnHeight(x, z) {
        for (let y = 3; y >= 0; y--) {
            if (this.grid[x][y][z] !== 0) return y + 1;
        }
        return 0;
    }

    getMaxBlockValue() {
        let max = 0;
        for (let x = 0; x < 4; x++)
            for (let y = 0; y < 4; y++)
                for (let z = 0; z < 4; z++)
                    if (this.grid[x][y][z] > max) max = this.grid[x][y][z];
        return max;
    }

    getAvailableBlocks() {
        const maxBlock = this.getMaxBlockValue() || 2;
        const k = Math.log2(maxBlock);
        const maxIndex = Math.max(3, Math.floor(k - 4));
        const blocks = [];
        let v = 2;
        for (let i = 0; i <= maxIndex; i++) {
            blocks.push(v);
            v *= 2;
        }
        return blocks;
    }

    generateNextBlock() {
        const blocks = this.getAvailableBlocks();
        const maxBlock = this.getMaxBlockValue() || 2;
        const k = Math.log2(maxBlock);
        const center = Math.max(0, k - 9);
        const sigma = 1.2;

        const minWeight = 0.02;
        let totalWeight = 0;
        const weights = blocks.map((v, i) => {
            const w = Math.max(minWeight, Math.exp(-0.5 * Math.pow((i - center) / sigma, 2)));
            totalWeight += w;
            return w;
        });

        let rand = Math.random() * totalWeight;
        let value = blocks[0];
        for (let i = 0; i < weights.length; i++) {
            rand -= weights[i];
            if (rand <= 0) { value = blocks[i]; break; }
        }

        const x = Math.floor(Math.random() * 4);
        const z = Math.floor(Math.random() * 4);
        this.nextBlock = { value, x, z };
    }

    onEggHatch() {
        this.hatchCount++;
    }

    move(direction) {
        const axis = direction[0];
        const sign = direction[1] === '+' ? 1 : -1;

        let anyMoved = true;
        let everMoved = false;
        while (anyMoved) {
            anyMoved = false;

            const blocks = this.getAllBlocks();
            blocks.sort((a, b) => {
                const aVal = axis === 'x' ? a.x : a.z;
                const bVal = axis === 'x' ? b.x : b.z;
                return sign > 0 ? bVal - aVal : aVal - bVal;
            });

            for (const block of blocks) {
                const result = this.moveBlockOneStep(block.x, block.y, block.z, axis, sign);
                if (result) { anyMoved = true; everMoved = true; }
            }

            const gravityResult = this.applyGravity();
            if (gravityResult) { anyMoved = true; everMoved = true; }
        }

        return everMoved;
    }

    moveBlockOneStep(x, y, z, axis, sign) {
        const value = this.getCell(x, y, z);
        if (value === 0) return false;

        let nx = x, nz = z;
        if (axis === 'x') nx = x + sign;
        else nz = z + sign;

        if (nx < 0 || nx >= 4 || nz < 0 || nz >= 4) return false;

        const target = this.getCell(nx, y, nz);
        if (target === 0) {
            this.setCell(nx, y, nz, value);
            this.setCell(x, y, z, 0);
            return true;
        } else if (target === value) {
            this.setCell(nx, y, nz, value * 2);
            this.setCell(x, y, z, 0);
            this.score += value * 2;
            return true;
        }
        return false;
    }

    applyGravity() {
        let fell = false;
        for (let x = 0; x < 4; x++) {
            for (let z = 0; z < 4; z++) {
                for (let y = 1; y < 4; y++) {
                    const value = this.getCell(x, y, z);
                    if (value === 0) continue;

                    const below = this.getCell(x, y - 1, z);
                    if (below === 0) {
                        this.setCell(x, y - 1, z, value);
                        this.setCell(x, y, z, 0);
                        fell = true;
                    } else if (below === value) {
                        this.setCell(x, y - 1, z, value * 2);
                        this.setCell(x, y, z, 0);
                        this.score += value * 2;
                        fell = true;
                    }
                }
            }
        }
        return fell;
    }

    dropBlock(x, z, value) {
        const height = this.getColumnHeight(x, z);
        const below = height > 0 ? this.getCell(x, height - 1, z) : 0;

        if (height >= 4) {
            if (below === value) {
                this.setCell(x, height - 1, z, value * 2);
                this.score += value * 2;
                this.applyGravity();
                return true;
            }
            this.isGameOver = true;
            return false;
        }

        if (height > 0 && below === value) {
            this.setCell(x, height - 1, z, value * 2);
            this.score += value * 2;
            this.applyGravity();
        } else {
            this.setCell(x, height, z, value);
        }

        return true;
    }

    getAllBlocks() {
        const blocks = [];
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                for (let z = 0; z < 4; z++) {
                    if (this.grid[x][y][z] !== 0) {
                        blocks.push({ x, y, z, value: this.grid[x][y][z] });
                    }
                }
            }
        }
        return blocks;
    }

    checkNoValidMoves() {
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                for (let z = 0; z < 4; z++) {
                    const val = this.grid[x][y][z];
                    if (val === 0) return false;
                    if (x < 3 && this.grid[x + 1][y][z] === val) return false;
                    if (z < 3 && this.grid[x][y][z + 1] === val) return false;
                    if (y < 3 && this.grid[x][y + 1][z] === val) return false;
                }
            }
        }
        return true;
    }

    checkGameOver() {
        for (let x = 0; x < 4; x++) {
            for (let z = 0; z < 4; z++) {
                if (this.getColumnHeight(x, z) > 4) {
                    this.isGameOver = true;
                    return true;
                }
            }
        }
        return false;
    }
}
