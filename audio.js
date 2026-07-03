export class Audio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.playing = new Set();
        this._unlocked = false;
        this._unlock = this._unlock.bind(this);
        document.addEventListener('touchstart', this._unlock);
        document.addEventListener('touchend', this._unlock);
        document.addEventListener('click', this._unlock);
        document.addEventListener('keydown', this._unlock);
        this._resumeOnTouch = () => {
            if (this.ctx && this.ctx.state !== 'running') {
                this.ctx.resume();
            }
            this._removeResumeListeners();
        };
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.ctx) {
                this.ctx.resume().catch(() => {});
                if (this.ctx.state !== 'running') {
                    this._addResumeListeners();
                }
            }
        });
    }

    _unlock() {
        if (this._unlocked) return;
        this.init();
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().then(() => this._onUnlocked());
            return;
        }
        if (this.ctx.state === 'running') {
            this._onUnlocked();
        }
    }

    _onUnlocked() {
        if (this._unlocked) return;
        this._unlocked = true;
        document.removeEventListener('touchstart', this._unlock);
        document.removeEventListener('touchend', this._unlock);
        document.removeEventListener('click', this._unlock);
        document.removeEventListener('keydown', this._unlock);
        if (this._pendingBGM) {
            this._pendingBGM = false;
            this.startBGM();
        }
    }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 3.0;
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -6;
        this.compressor.knee.value = 12;
        this.compressor.ratio.value = 4;
        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
    }

    get output() {
        return this.masterGain;
    }

    _addResumeListeners() {
        if (this._resumeListening) return;
        this._resumeListening = true;
        document.addEventListener('touchstart', this._resumeOnTouch);
        document.addEventListener('touchend', this._resumeOnTouch);
        document.addEventListener('click', this._resumeOnTouch);
    }

    _removeResumeListeners() {
        if (!this._resumeListening) return;
        this._resumeListening = false;
        document.removeEventListener('touchstart', this._resumeOnTouch);
        document.removeEventListener('touchend', this._resumeOnTouch);
        document.removeEventListener('click', this._resumeOnTouch);
    }

    ensureContext() {
        if (!this.enabled) return false;
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
            this.ctx.resume();
        }
        return this.ctx.state === 'running';
    }

    claim(name, duration) {
        if (this.playing.has(name)) return false;
        this.playing.add(name);
        setTimeout(() => this.playing.delete(name), duration);
        return true;
    }

    playMerge(value) {
        if (!this.ensureContext()) return;
        if (!this.claim('merge', 200)) return;
        const t = this.ctx.currentTime;

        let steps = 1;
        if (value >= 64 && value <= 256) steps = 2;
        else if (value >= 512 && value <= 1024) steps = 3;
        else if (value >= 2048) steps = 3 + Math.floor(Math.log2(value) - 10);
        steps = Math.min(8, steps);
        const dur = Math.min(0.2, 0.06 + steps * 0.02);
        const stepDur = dur / (steps + 1);

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.output);

        osc.type = 'sine';
        const baseFreq = 880;
        osc.frequency.setValueAtTime(baseFreq, t);
        for (let i = 1; i <= steps; i++) {
            const freq = i % 2 === 1 ? baseFreq * 1.5 : baseFreq;
            osc.frequency.setValueAtTime(freq, t + i * stepDur);
        }

        gain.gain.setValueAtTime(0.06, t);
        gain.gain.setValueAtTime(0.06, t + dur - 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.start(t);
        osc.stop(t + dur);
    }

    playDrop() {
        if (!this.ensureContext()) return;
        if (!this.claim('drop', 200)) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.output);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(200, t + 0.25);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, t);

        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.start(t);
        osc.stop(t + 0.25);
    }

    playLand() {
        if (!this.ensureContext()) return;
        if (!this.claim('land', 150)) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.output);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, t);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

        osc.start(t);
        osc.stop(t + 0.15);
    }

    playFallWhoosh(duration = 0.8) {
        if (!this.ensureContext()) return;
        if (!this.claim('whoosh', duration * 1000)) return;
        const t = this.ctx.currentTime;

        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.output);

        filter.type = 'bandpass';
        filter.Q.setValueAtTime(2, t);
        filter.frequency.setValueAtTime(300, t);
        filter.frequency.exponentialRampToValueAtTime(1500, t + duration);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + duration * 0.9);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        noise.start(t);
        noise.stop(t + duration);
    }

    playExplosion() {
        if (!this.ensureContext()) return;
        if (!this.claim('explosion', 2000)) return;
        const t = this.ctx.currentTime;
        const duration = 1.8;

        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const env = Math.pow(1 - i / bufferSize, 1.2);
            data[i] = (Math.random() * 2 - 1) * env;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.output);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(60, t + 1.5);

        gain.gain.setValueAtTime(0.5, t);
        gain.gain.setValueAtTime(0.4, t + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        noise.start(t);

        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.connect(oscGain);
        oscGain.connect(this.output);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(80, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + duration);

        oscGain.gain.setValueAtTime(0.3, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.start(t);
        osc.stop(t + duration);
    }

    playBurning() {
        if (!this.ensureContext()) return;
        if (!this.claim('burning', 2000)) return;
        const t = this.ctx.currentTime;
        const duration = 1.8;

        const bufferSize = Math.floor(this.ctx.sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const env = Math.pow(1 - i / bufferSize, 0.8);
            data[i] = (Math.random() * 2 - 1) * env;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        const filter2 = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        noise.connect(filter);
        filter.connect(filter2);
        filter2.connect(gain);
        gain.connect(this.output);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + duration);
        filter.Q.setValueAtTime(1.5, t);

        filter2.type = 'lowpass';
        filter2.frequency.setValueAtTime(600, t);
        filter2.frequency.exponentialRampToValueAtTime(150, t + duration);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.25, t + 0.2);
        gain.gain.setValueAtTime(0.25, t + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        noise.start(t);
        noise.stop(t + duration);
    }

    playCreature() {
        if (!this.ensureContext()) return;
        if (!this.claim('creature', 400)) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.output);

        const baseFreq = 340;
        const duration = 0.25;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(baseFreq, t);
        osc.frequency.setValueAtTime(baseFreq * 1.2, t + duration * 0.3);
        osc.frequency.setValueAtTime(baseFreq * 0.8, t + duration * 0.6);
        osc.frequency.setValueAtTime(baseFreq * 0.6, t + duration);

        osc2.type = 'square';
        osc2.frequency.setValueAtTime(baseFreq * 0.5, t);
        osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.3, t + duration);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.08, t + 0.03);
        gain.gain.setValueAtTime(0.08, t + duration * 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.start(t);
        osc2.start(t);
        osc.stop(t + duration);
        osc2.stop(t + duration);
    }

    playGameOver() {
        if (!this.ensureContext()) return;
        if (!this.claim('gameOver', 1000)) return;
        const notes = [200, 180, 150, 100];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.output);

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.2);

            gain.gain.setValueAtTime(0, this.ctx.currentTime + i * 0.2);
            gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + i * 0.2 + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.2 + 0.2);

            osc.start(this.ctx.currentTime + i * 0.2);
            osc.stop(this.ctx.currentTime + i * 0.2 + 0.25);
        });
    }

    startBGM() {
        if (!this._unlocked) {
            this._pendingBGM = true;
            return;
        }
        if (!this.ensureContext()) return;
        if (this.bgmPlaying) return;
        this.bgmPlaying = true;

        const ctx = this.ctx;
        const bpm = 80;
        const beatDur = 60 / bpm;
        const loopDur = 32 * beatDur;

        const bgmGain = ctx.createGain();
        bgmGain.gain.value = 0.04;
        bgmGain.connect(this.output);
        this.bgmGain = bgmGain;

        const scheduleLoop = (startTime) => {
            // Bb major scale: Bb C D Eb F G A Bb C D Eb F
            const scale = [233.1, 261.6, 293.7, 311.1, 349.2, 392.0, 440.0, 466.2, 523.3, 587.3, 622.3, 698.5];

            // Chord progression: I(Bb) - vi(Gm) - IV(Eb) - V(F) - I - vi - IV - V
            // Melody uses dotted rhythms and 6th/3rd leaps like Zelda field themes
            const melody = [
                // Phrase 1 (I - Bb): soaring opening
                { note: 7, beat: 0, dur: 1.5 },  { note: 9, beat: 1.5, dur: 0.5 }, { note: 11, beat: 2, dur: 2 },
                { note: 9, beat: 4, dur: 1 },    { note: 7, beat: 5, dur: 1 },     { note: 5, beat: 6, dur: 2 },
                // Phrase 2 (vi - Gm): stepping down with grace
                { note: 7, beat: 8, dur: 1.5 },  { note: 5, beat: 9.5, dur: 0.5 }, { note: 4, beat: 10, dur: 1.5 },
                { note: 2, beat: 11.5, dur: 0.5 },{ note: 4, beat: 12, dur: 2 },   { note: 5, beat: 14, dur: 2 },
                // Phrase 3 (IV - Eb): hopeful rise
                { note: 4, beat: 16, dur: 1 },   { note: 5, beat: 17, dur: 1 },    { note: 7, beat: 18, dur: 2 },
                { note: 9, beat: 20, dur: 1.5 }, { note: 8, beat: 21.5, dur: 0.5 },{ note: 7, beat: 22, dur: 2 },
                // Phrase 4 (V - F): resolve back home
                { note: 5, beat: 24, dur: 1.5 }, { note: 7, beat: 25.5, dur: 0.5 },{ note: 9, beat: 26, dur: 2 },
                { note: 8, beat: 28, dur: 1 },   { note: 7, beat: 29, dur: 1.5 },  { note: 7, beat: 31, dur: 1 },
            ];

            // Arpeggios follow the chord changes
            const arp = [
                // I (Bb: 0-2-4)
                { note: 0, beat: 0 },   { note: 2, beat: 0.5 }, { note: 4, beat: 1 },   { note: 2, beat: 1.5 },
                { note: 0, beat: 2 },   { note: 2, beat: 2.5 }, { note: 4, beat: 3 },   { note: 2, beat: 3.5 },
                { note: 0, beat: 4 },   { note: 2, beat: 4.5 }, { note: 4, beat: 5 },   { note: 2, beat: 5.5 },
                { note: 0, beat: 6 },   { note: 2, beat: 6.5 }, { note: 4, beat: 7 },   { note: 2, beat: 7.5 },
                // vi (Gm: 5-0-2)
                { note: 5, beat: 8 },   { note: 0, beat: 8.5 }, { note: 2, beat: 9 },   { note: 0, beat: 9.5 },
                { note: 5, beat: 10 },  { note: 0, beat: 10.5 },{ note: 2, beat: 11 },  { note: 0, beat: 11.5 },
                { note: 5, beat: 12 },  { note: 0, beat: 12.5 },{ note: 2, beat: 13 },  { note: 0, beat: 13.5 },
                { note: 5, beat: 14 },  { note: 0, beat: 14.5 },{ note: 2, beat: 15 },  { note: 0, beat: 15.5 },
                // IV (Eb: 3-5-0)
                { note: 3, beat: 16 },  { note: 5, beat: 16.5 },{ note: 0, beat: 17 },  { note: 5, beat: 17.5 },
                { note: 3, beat: 18 },  { note: 5, beat: 18.5 },{ note: 0, beat: 19 },  { note: 5, beat: 19.5 },
                { note: 3, beat: 20 },  { note: 5, beat: 20.5 },{ note: 0, beat: 21 },  { note: 5, beat: 21.5 },
                { note: 3, beat: 22 },  { note: 5, beat: 22.5 },{ note: 0, beat: 23 },  { note: 5, beat: 23.5 },
                // V (F: 4-6-1)
                { note: 4, beat: 24 },  { note: 6, beat: 24.5 },{ note: 1, beat: 25 },  { note: 6, beat: 25.5 },
                { note: 4, beat: 26 },  { note: 6, beat: 26.5 },{ note: 1, beat: 27 },  { note: 6, beat: 27.5 },
                { note: 4, beat: 28 },  { note: 6, beat: 28.5 },{ note: 1, beat: 29 },  { note: 6, beat: 29.5 },
                { note: 4, beat: 30 },  { note: 6, beat: 30.5 },{ note: 1, beat: 31 },  { note: 6, beat: 31.5 },
            ];

            // Bass follows chord roots
            const bass = [
                { note: 0, beat: 0 },  { note: 0, beat: 2 },  { note: 0, beat: 4 },  { note: 0, beat: 6 },
                { note: 5, beat: 8 },  { note: 5, beat: 10 }, { note: 5, beat: 12 }, { note: 5, beat: 14 },
                { note: 3, beat: 16 }, { note: 3, beat: 18 }, { note: 3, beat: 20 }, { note: 3, beat: 22 },
                { note: 4, beat: 24 }, { note: 4, beat: 26 }, { note: 4, beat: 28 }, { note: 4, beat: 30 },
            ];

            for (const m of melody) {
                const t = startTime + m.beat * beatDur;
                const freq = scale[m.note];
                const dur = beatDur * (m.dur || 0.9);

                const osc = ctx.createOscillator();
                const env = ctx.createGain();
                osc.connect(env);
                env.connect(bgmGain);

                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, t);

                env.gain.setValueAtTime(0, t);
                env.gain.linearRampToValueAtTime(0.4, t + 0.03);
                env.gain.setValueAtTime(0.28, t + dur * 0.4);
                env.gain.exponentialRampToValueAtTime(0.001, t + dur);

                osc.start(t);
                osc.stop(t + dur);
            }

            for (const a of arp) {
                const t = startTime + a.beat * beatDur;
                const freq = scale[a.note] * 2;
                const dur = beatDur * 0.4;

                const osc = ctx.createOscillator();
                const env = ctx.createGain();
                osc.connect(env);
                env.connect(bgmGain);

                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, t);

                env.gain.setValueAtTime(0, t);
                env.gain.linearRampToValueAtTime(0.15, t + 0.02);
                env.gain.exponentialRampToValueAtTime(0.001, t + dur);

                osc.start(t);
                osc.stop(t + dur);
            }

            for (const b of bass) {
                const t = startTime + b.beat * beatDur;
                const freq = scale[b.note] * 0.5;
                const dur = beatDur * 1.8;

                const osc = ctx.createOscillator();
                const env = ctx.createGain();
                osc.connect(env);
                env.connect(bgmGain);

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, t);

                env.gain.setValueAtTime(0, t);
                env.gain.linearRampToValueAtTime(0.7, t + 0.05);
                env.gain.setValueAtTime(0.5, t + dur * 0.5);
                env.gain.exponentialRampToValueAtTime(0.001, t + dur);

                osc.start(t);
                osc.stop(t + dur);
            }

            // Pad 1 - root (follows chord: Bb - G - Eb - F)
            const pad = ctx.createOscillator();
            const padEnv = ctx.createGain();
            pad.connect(padEnv);
            padEnv.connect(bgmGain);

            pad.type = 'sine';
            pad.frequency.setValueAtTime(116.5, startTime);
            pad.frequency.setValueAtTime(98.0, startTime + loopDur * 0.25);
            pad.frequency.setValueAtTime(155.6, startTime + loopDur * 0.5);
            pad.frequency.setValueAtTime(174.6, startTime + loopDur * 0.75);

            padEnv.gain.setValueAtTime(0, startTime);
            padEnv.gain.linearRampToValueAtTime(0.5, startTime + 0.5);
            padEnv.gain.setValueAtTime(0.5, startTime + loopDur - 0.5);
            padEnv.gain.linearRampToValueAtTime(0, startTime + loopDur);

            pad.start(startTime);
            pad.stop(startTime + loopDur);

            // Pad 2 - third (Bb:D - Gm:Bb - Eb:G - F:A)
            const pad2 = ctx.createOscillator();
            const pad2Env = ctx.createGain();
            pad2.connect(pad2Env);
            pad2Env.connect(bgmGain);

            pad2.type = 'sine';
            pad2.frequency.setValueAtTime(146.8, startTime);
            pad2.frequency.setValueAtTime(116.5, startTime + loopDur * 0.25);
            pad2.frequency.setValueAtTime(196.0, startTime + loopDur * 0.5);
            pad2.frequency.setValueAtTime(220.0, startTime + loopDur * 0.75);

            pad2Env.gain.setValueAtTime(0, startTime);
            pad2Env.gain.linearRampToValueAtTime(0.35, startTime + 1);
            pad2Env.gain.setValueAtTime(0.35, startTime + loopDur - 1);
            pad2Env.gain.linearRampToValueAtTime(0, startTime + loopDur);

            pad2.start(startTime);
            pad2.stop(startTime + loopDur);

            // Pad 3 - fifth (Bb:F - Gm:D - Eb:Bb - F:C)
            const pad3 = ctx.createOscillator();
            const pad3Env = ctx.createGain();
            pad3.connect(pad3Env);
            pad3Env.connect(bgmGain);

            pad3.type = 'sine';
            pad3.frequency.setValueAtTime(174.6, startTime);
            pad3.frequency.setValueAtTime(146.8, startTime + loopDur * 0.25);
            pad3.frequency.setValueAtTime(233.1, startTime + loopDur * 0.5);
            pad3.frequency.setValueAtTime(261.6, startTime + loopDur * 0.75);

            pad3Env.gain.setValueAtTime(0, startTime);
            pad3Env.gain.linearRampToValueAtTime(0.15, startTime + 2);
            pad3Env.gain.setValueAtTime(0.15, startTime + loopDur - 2);
            pad3Env.gain.linearRampToValueAtTime(0, startTime + loopDur);

            pad3.start(startTime);
            pad3.stop(startTime + loopDur);
        };

        const now = ctx.currentTime + 0.1;
        let nextStart = now;
        scheduleLoop(nextStart);
        nextStart += loopDur;
        scheduleLoop(nextStart);

        this.bgmInterval = setInterval(() => {
            if (!this.bgmPlaying) return;
            if (ctx.currentTime > nextStart - loopDur * 0.5) {
                nextStart += loopDur;
                scheduleLoop(nextStart);
            }
        }, 1000);
    }

    stopBGM() {
        this.bgmPlaying = false;
        if (this.bgmInterval) {
            clearInterval(this.bgmInterval);
            this.bgmInterval = null;
        }
        if (this.bgmGain) {
            this.bgmGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
        }
    }
}
