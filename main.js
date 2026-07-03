import { Renderer } from './renderer.js';
import { GameState } from './game.js';
import { InputHandler } from './input.js';
import { Effects } from './effects.js';
import { Decorations } from './decorations.js';
import { GameOverSequence } from './gameover-sequence.js';
import { Audio } from './audio.js';
import * as THREE from 'three';

const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const game = new GameState();
const effects = new Effects(renderer.scene);
const audio = new Audio();
const decorations = new Decorations(renderer.camera, renderer.scene, audio, () => game.onEggHatch());

let isProcessing = false;
let gameStarted = false;

function copyGrid(gameState) {
    const copy = [];
    for (let x = 0; x < 4; x++) {
        copy[x] = [];
        for (let y = 0; y < 4; y++) {
            copy[x][y] = [];
            for (let z = 0; z < 4; z++) {
                copy[x][y][z] = gameState.grid[x][y][z];
            }
        }
    }
    return copy;
}

function findMerges(before, after) {
    const merges = [];
    for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 4; y++) {
            for (let z = 0; z < 4; z++) {
                const newVal = after[x][y][z];
                if (newVal === 0) continue;
                const oldVal = before[x][y][z];
                if (newVal > oldVal && oldVal !== 0) {
                    merges.push({ x, y, z, value: newVal });
                }
            }
        }
    }
    return merges;
}

function hasSaveData() {
    const raw = localStorage.getItem('skyfall2048_save');
    if (!raw) return false;
    try {
        const data = JSON.parse(raw);
        return data && data.version === 3;
    } catch (e) {
        return false;
    }
}

function showStartScreen() {
    const isRestart = sessionStorage.getItem('skyfall2048_restart');
    if (isRestart) {
        sessionStorage.removeItem('skyfall2048_restart');
        GameState.clearSave();
        document.getElementById('start-screen').classList.add('hidden');
        startGame(false);
        return;
    }

    const startScreen = document.getElementById('start-screen');
    const continueBtn = document.getElementById('start-continue-btn');
    const newBtn = document.getElementById('start-new-btn');

    input.enabled = false;
    renderer.ground.visible = false;
    renderer.boardGroup.visible = false;

    if (hasSaveData()) {
        continueBtn.disabled = false;
    }

    newBtn.addEventListener('click', () => {
        GameState.clearSave();
        startScreen.classList.add('hidden');
        startGame(false);
    });

    continueBtn.addEventListener('click', () => {
        startScreen.classList.add('hidden');
        startGame(true);
    });
}

function startGame(loadSave) {
    gameStarted = true;

    if (loadSave) {
        const loaded = game.load();
        if (loaded) {
            displayScore = game.score;
            renderer.syncBlocks(game, null);
            renderer.updatePreview(game.nextBlock, game.nextBlock ? game.getColumnHeight(game.nextBlock.x, game.nextBlock.z) : 0);
            decorations.loadSaveData(game.decoSaveData);
            updateUI();
            playIntroSequence();
            return;
        }
    }

    game.dropBlock(
        Math.floor(Math.random() * 4),
        Math.floor(Math.random() * 4),
        Math.random() < 0.8 ? 2 : 4
    );
    game.dropBlock(
        Math.floor(Math.random() * 4),
        Math.floor(Math.random() * 4),
        Math.random() < 0.8 ? 2 : 4
    );
    game.generateNextBlock();

    playIntroSequence();
}

function playIntroSequence() {
    input.enabled = false;

    renderer.ground.visible = false;
    renderer.boardGroup.visible = false;
    renderer.blockMeshes.forEach((mesh) => mesh.visible = false);
    if (renderer.previewMesh) renderer.previewMesh.visible = false;
    if (renderer.ghostMesh) renderer.ghostMesh.visible = false;
    if (renderer.shadowMesh) renderer.shadowMesh.visible = false;
    if (renderer.dropLine) renderer.dropLine.visible = false;
    if (renderer.ceilingWarnings) renderer.ceilingWarnings.forEach(w => w.mesh.visible = false);

    const normalGroupPos = { x: 1.5, y: 7, z: 1.5 };
    decorations.group.position.set(1.5, 4, 1.5);

    const introCamPos = { x: 1.5, y: 5, z: 7 };
    const introCamTarget = { x: 1.5, y: 4, z: 1.5 };
    renderer.camera.position.set(introCamPos.x, introCamPos.y, introCamPos.z);
    renderer.camera.lookAt(introCamTarget.x, introCamTarget.y, introCamTarget.z);
    if (renderer.controls) {
        renderer.controls.target.set(introCamTarget.x, introCamTarget.y, introCamTarget.z);
    }

    function shakeOnce(duration, callback) {
        const start = performance.now();
        decorations.eggShake = 0.5;
        function tick() {
            const elapsed = performance.now() - start;
            if (elapsed < duration) {
                requestAnimationFrame(tick);
            } else {
                callback();
            }
        }
        tick();
    }

    function shakePhase() {
        shakeOnce(600, () => {
            setTimeout(() => {
                shakeOnce(600, () => {
                    setTimeout(() => {
                        zoomOutPhase();
                    }, 500);
                });
            }, 500);
        });
    }

    function zoomOutPhase() {
        const duration = 1200;
        const startTime = performance.now();

        const startCamPos = { ...introCamPos };
        const endCamPos = { x: renderer.initialCameraPos.x, y: renderer.initialCameraPos.y, z: renderer.initialCameraPos.z };
        const startTarget = { ...introCamTarget };
        const endTarget = { x: renderer.initialCameraTarget.x, y: renderer.initialCameraTarget.y, z: renderer.initialCameraTarget.z };

        const startGroupY = 4;
        const endGroupY = normalGroupPos.y;

        function animateZoom() {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const t = 1 - Math.pow(1 - progress, 3);

            renderer.camera.position.set(
                startCamPos.x + (endCamPos.x - startCamPos.x) * t,
                startCamPos.y + (endCamPos.y - startCamPos.y) * t,
                startCamPos.z + (endCamPos.z - startCamPos.z) * t
            );

            const tx = startTarget.x + (endTarget.x - startTarget.x) * t;
            const ty = startTarget.y + (endTarget.y - startTarget.y) * t;
            const tz = startTarget.z + (endTarget.z - startTarget.z) * t;
            renderer.camera.lookAt(tx, ty, tz);
            if (renderer.controls) {
                renderer.controls.target.set(tx, ty, tz);
            }

            decorations.group.position.y = startGroupY + (endGroupY - startGroupY) * t;

            if (progress < 1) {
                requestAnimationFrame(animateZoom);
            } else {
                finishIntro();
            }
        }
        animateZoom();
    }

    function finishIntro() {
        renderer.ground.visible = true;
        renderer.boardGroup.visible = true;
        renderer.blockMeshes.forEach((mesh) => mesh.visible = true);
        if (renderer.ceilingWarnings) renderer.ceilingWarnings.forEach(w => w.mesh.visible = true);

        document.getElementById('ui-overlay').style.display = '';
        document.getElementById('ranking-toggle').style.display = '';
        document.getElementById('settings-toggle').style.display = '';
        document.getElementById('camera-controls').style.display = '';

        renderer.syncBlocks(game, null);
        renderer.updatePreview(game.nextBlock, game.nextBlock ? game.getColumnHeight(game.nextBlock.x, game.nextBlock.z) : 0);
        updateUI();
        input.enabled = true;
        audio.startBGM();
    }

    shakePhase();
}

function handleMove(direction) {
    if (game.isGameOver) return;
    if (isProcessing) return;

    isProcessing = true;

    const before = copyGrid(game);
    const scoreBefore = game.score;
    game.move(direction);
    const afterMove = copyGrid(game);
    const moveMerges = findMerges(before, afterMove);
    const moveDamage = game.score - scoreBefore;

    renderer.syncBlocks(game, before);
    for (const m of moveMerges) {
        renderer.spawnMergeEffect(m.x, m.y, m.z);
    }
    let moveMergeValue = 0;
    if (moveDamage > 0) {
        moveMergeValue = moveMerges.reduce((max, m) => Math.max(max, m.value), 4);
        audio.playMerge(moveMergeValue);
        decorations.onBlockCreated(moveDamage, game.getMaxBlockValue());
    }

    updateUI(moveMergeValue);
    renderer.updatePreview(null);

    const next = game.nextBlock;
    const dropX = next.x;
    const dropZ = next.z;
    const dropValue = next.value;
    const targetY = game.getColumnHeight(dropX, dropZ);

    const willGameOver = targetY >= 4 && game.getCell(dropX, targetY - 1, dropZ) !== dropValue;

    if (willGameOver) {
        game.isGameOver = true;
        renderer.updatePreview(null);
        updateUI(moveMergeValue);
        isProcessing = false;
        sessionStorage.setItem('skyfall2048_restart', '1');
        GameState.clearSave();
        setTimeout(() => showGameOver(dropX, dropZ, dropValue), 300);
    } else {
        renderer.animateDropBlock(dropX, dropZ, targetY, dropValue, () => {
            audio.playLand();
            const beforeDrop = copyGrid(game);
            const scoreBeforeDrop = game.score;
            game.dropBlock(dropX, dropZ, dropValue);
            const afterDrop = copyGrid(game);
            const dropMerges = findMerges(beforeDrop, afterDrop);
            const dropDamage = game.score - scoreBeforeDrop;

            game.checkGameOver();

            renderer.syncBlocks(game, null);
            for (const m of dropMerges) {
                renderer.spawnMergeEffect(m.x, m.y, m.z);
            }
            let dropMergeValue = 0;
            if (dropDamage > 0) {
                dropMergeValue = dropMerges.reduce((max, m) => Math.max(max, m.value), 4);
                audio.playMerge(dropMergeValue);
                decorations.onBlockCreated(dropDamage, game.getMaxBlockValue());
            }

            if (game.isGameOver) {
                renderer.updatePreview(null);
                updateUI(dropMergeValue);
                isProcessing = false;
                sessionStorage.setItem('skyfall2048_restart', '1');
                GameState.clearSave();
                setTimeout(() => showGameOver(dropX, dropZ, dropValue), 300);
            } else {
                game.generateNextBlock();
                renderer.updatePreview(game.nextBlock, game.nextBlock ? game.getColumnHeight(game.nextBlock.x, game.nextBlock.z) : 0);
                updateUI(dropMergeValue);
                isProcessing = false;
            }
        });
    }
}

function waitForAnimations(callback) {
    function check() {
        if (renderer.isAnimating) {
            requestAnimationFrame(check);
        } else {
            callback();
        }
    }
    check();
}

let displayScore = 0;
let scoreAnimId = null;

function getMergeDuration(value) {
    let steps = 1;
    if (value >= 64 && value <= 256) steps = 2;
    else if (value >= 512 && value <= 1024) steps = 3;
    else if (value >= 2048) steps = 3 + Math.floor(Math.log2(value) - 10);
    steps = Math.min(8, steps);
    return Math.min(0.2, 0.06 + steps * 0.02) * 1000;
}

function animateScore(target, mergeValue) {
    if (scoreAnimId) cancelAnimationFrame(scoreAnimId);
    const el = document.getElementById('score-value');
    const diff = target - displayScore;
    if (diff <= 0) {
        displayScore = target;
        el.textContent = target.toLocaleString();
        return;
    }
    const duration = mergeValue ? getMergeDuration(mergeValue) : 100;
    const startTime = performance.now();
    const startScore = displayScore;

    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        displayScore = Math.floor(startScore + diff * progress);
        el.textContent = displayScore.toLocaleString();
        if (progress < 1) {
            scoreAnimId = requestAnimationFrame(tick);
        } else {
            displayScore = target;
            el.textContent = target.toLocaleString();
            scoreAnimId = null;
        }
    }
    scoreAnimId = requestAnimationFrame(tick);
}

let bestScore = 0;
let displayBest = 0;
let bestAnimId = null;
let trackedMaxBlock = 0;
let lastRankSubmitTime = 0;

function animateBestScore(target, mergeValue) {
    if (bestAnimId) cancelAnimationFrame(bestAnimId);
    const el = document.getElementById('best-value');
    const diff = target - displayBest;
    if (diff <= 0) {
        displayBest = target;
        el.textContent = target.toLocaleString();
        return;
    }
    const duration = mergeValue ? getMergeDuration(mergeValue) : 100;
    const startTime = performance.now();
    const startVal = displayBest;

    function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        displayBest = Math.floor(startVal + diff * progress);
        el.textContent = displayBest.toLocaleString();
        if (progress < 1) {
            bestAnimId = requestAnimationFrame(tick);
        } else {
            displayBest = target;
            el.textContent = target.toLocaleString();
            bestAnimId = null;
        }
    }
    bestAnimId = requestAnimationFrame(tick);
}

function loadBestScore() {
    bestScore = parseInt(localStorage.getItem('skyfall2048_best') || '0');
    trackedMaxBlock = parseInt(localStorage.getItem('skyfall2048_maxblock') || '0');
    displayBest = bestScore;
    document.getElementById('best-value').textContent = bestScore.toLocaleString();
}
loadBestScore();


function updateUI(mergeValue) {
    animateScore(game.score, mergeValue);
    renderer.updateCeilingWarnings(game);
    if (!game.isGameOver) {
        game.save(decorations.getSaveData());
        trySubmitRanking();
    }
}

function submitEndScore() {
    trySubmitRanking();
}

function trySubmitRanking() {
    const maxBlock = game.getMaxBlockValue();
    const newMaxBlock = maxBlock > trackedMaxBlock;
    const newBestScore = game.score > bestScore;

    if (!newMaxBlock && !newBestScore) return;

    if (newBestScore) {
        bestScore = game.score;
        animateBestScore(bestScore);
        localStorage.setItem('skyfall2048_best', bestScore.toString());
    }

    if (newMaxBlock) {
        trackedMaxBlock = maxBlock;
        localStorage.setItem('skyfall2048_maxblock', maxBlock.toString());
    }
}

function showGameOver(dropX, dropZ, dropValue) {
    input.enabled = false;
    submitEndScore();
    audio.stopBGM();
    audio.playGameOver();
    const collideY = game.getColumnHeight(dropX, dropZ);
    const sequence = new GameOverSequence(renderer, decorations, audio);
    sequence.maxBlock = game.getMaxBlockValue();
    sequence.lastGrid = copyGrid(game);
    sequence.start(dropX, dropZ, dropValue, collideY);
}

const input = new InputHandler(handleMove, () => disableCameraMode());

showStartScreen();

document.getElementById('toggle-ghost').addEventListener('change', (e) => {
    renderer.showGhost = e.target.checked;
    renderer.updatePreview(game.nextBlock, game.nextBlock ? game.getColumnHeight(game.nextBlock.x, game.nextBlock.z) : 0);
});

document.getElementById('toggle-shadow').addEventListener('change', (e) => {
    renderer.showShadow = e.target.checked;
    renderer.updatePreview(game.nextBlock, game.nextBlock ? game.getColumnHeight(game.nextBlock.x, game.nextBlock.z) : 0);
});

document.getElementById('toggle-sound').addEventListener('change', (e) => {
    audio.enabled = e.target.checked;
});

document.getElementById('toggle-bgm').addEventListener('change', (e) => {
    if (e.target.checked) {
        audio.startBGM();
    } else {
        audio.stopBGM();
    }
});

let cameraMode = false;
const cameraToggleBtn = document.getElementById('camera-toggle');
const cameraResetBtn = document.getElementById('camera-reset');

function disableCameraMode() {
    if (!cameraMode) return;
    cameraMode = false;
    renderer.setCameraMode(false);
    input.enabled = true;
    cameraToggleBtn.classList.remove('active');
}

cameraToggleBtn.addEventListener('click', () => {
    cameraMode = !cameraMode;
    renderer.setCameraMode(cameraMode);
    input.enabled = !cameraMode;
    cameraToggleBtn.classList.toggle('active', cameraMode);
});

cameraResetBtn.addEventListener('click', () => {
    disableCameraMode();
    renderer.resetCamera();
});

document.getElementById('restart-game').addEventListener('click', () => {
    document.getElementById('settings-panel').classList.remove('open');
    GameState.clearSave();
    const next = game.nextBlock;
    if (next) {
        showGameOver(next.x, next.z, next.value);
    } else {
        showGameOver(1, 1, 2);
    }
});

document.getElementById('ranking-toggle').addEventListener('click', () => {
    const panel = document.getElementById('ranking-panel');
    const isOpen = panel.classList.toggle('open');
    if (isOpen) loadRanking();
});

document.getElementById('ranking-close').addEventListener('click', () => {
    document.getElementById('ranking-panel').classList.remove('open');
});

window.loadRanking = loadRanking;
function loadRanking() {
    const listEl = document.getElementById('ranking-list');
    const myInfoEl = document.getElementById('ranking-my-info');
    const localMaxBlock = parseInt(localStorage.getItem('skyfall2048_maxblock') || '0');
    myInfoEl.textContent = `점수: ${bestScore.toLocaleString()} · 최고블록: ${localMaxBlock ? localMaxBlock.toLocaleString() : '-'}`;
    listEl.innerHTML = '<div class="ranking-loading">로컬 모드 - 랭킹 미지원</div>';
}

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    effects.update(delta);
    decorations.update(time);
    renderer.updateAnimations(delta);
    renderer.animatePreview(time);
    renderer.render();
}

animate();
