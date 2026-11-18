import { settings } from '../settings';

/**
 * Moteur audio 100 % synthétisé (Web Audio) : aucun fichier son.
 */
class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private noiseBuf!: AudioBuffer;
  private reverb!: ConvolverNode;
  private last = new Map<string, number>();
  private voices = 0;
  // musique
  private biome: 'vallee' | 'marais' | 'cendre' | 'menu' = 'menu';
  intensity = 0;
  private step = 0;
  private nextTime = 0;
  private seqTimer = 0;

  /** À appeler sur un geste utilisateur. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.connect(comp);
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    // bruit blanc
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // réverbération générée
    const len = ctx.sampleRate * 1.8;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const rv = ctx.createGain();
    rv.gain.value = 0.28;
    this.reverb.connect(rv);
    rv.connect(this.master);
    this.applyVolumes();
    this.nextTime = ctx.currentTime + 0.1;
    this.seqTimer = window.setInterval(() => this.schedule(), 90);
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = settings.volMaster;
    this.music.gain.value = settings.volMusic * 0.55;
    this.sfx.gain.value = settings.volSfx * 0.7;
  }

  setBiome(b: 'vallee' | 'marais' | 'cendre' | 'menu') {
    this.biome = b;
    this.step = 0;
  }

  // ------------------------------------------------ briques de synthèse

  private env(g: GainNode, t: number, a: number, peak: number, dec: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number, out: AudioNode, rev = false) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g);
    g.connect(out);
    if (rev) g.connect(this.reverb);
    o.start(t);
    o.stop(t + dur + 0.05);
    this.voices++;
    o.onended = () => this.voices--;
  }

  private noise(t: number, dur: number, vol: number, filter: BiquadFilterType, f0: number, f1: number, out: AudioNode, q = 1) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = filter;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.004, vol, dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
    this.voices++;
    s.onended = () => this.voices--;
  }

  /** Joue un effet ; limite le nombre de voix et regroupe les sons identiques. */
  play(name: string, vol = 1) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || settings.volSfx <= 0) return;
    const now = ctx.currentTime;
    const minGap = name === 'arrow' || name === 'hit' ? 0.045 : 0.03;
    if ((this.last.get(name) ?? -1) > now - minGap) return;
    if (this.voices > 40) return;
    this.last.set(name, now);
    const o = this.sfx;
    const t = now + 0.005;
    const r = 0.92 + Math.random() * 0.16;
    switch (name) {
      case 'arrow':
        this.noise(t, 0.08, 0.18 * vol, 'bandpass', 4000 * r, 1500, o, 2);
        this.tone('sine', 900 * r, 320, t, 0.08, 0.05 * vol, o);
        break;
      case 'bolt':
        this.tone('triangle', 380 * r, 1300, t, 0.18, 0.12 * vol, o, true);
        this.tone('sine', 1200 * r, 2400, t + 0.02, 0.12, 0.04 * vol, o, true);
        break;
      case 'frost':
        this.tone('sine', 1600 * r, 900, t, 0.25, 0.07 * vol, o, true);
        this.noise(t, 0.2, 0.06 * vol, 'highpass', 6000, 3000, o);
        break;
      case 'arcane':
        this.tone('sawtooth', 220 * r, 880, t, 0.22, 0.06 * vol, o, true);
        this.tone('sine', 660 * r, 1760, t, 0.22, 0.07 * vol, o, true);
        break;
      case 'shell':
        this.tone('sine', 140 * r, 45, t, 0.25, 0.3 * vol, o);
        this.noise(t, 0.12, 0.12 * vol, 'lowpass', 1800, 300, o);
        break;
      case 'turret':
        // détonation sèche du petit canon de forge, plus courte et plus aiguë que celle de l'artillerie
        this.noise(t, 0.07, 0.2 * vol, 'bandpass', 2600 * r, 700, o, 1.5);
        this.tone('sine', 210 * r, 70, t, 0.14, 0.2 * vol, o);
        this.noise(t + 0.02, 0.16, 0.05 * vol, 'lowpass', 900, 200, o);
        break;
      case 'catapult':
        // grincement du bras, sifflement du rocher, choc sourd contre la butée
        this.noise(t, 0.22, 0.12 * vol, 'bandpass', 700 * r, 2400, o, 3);
        this.tone('triangle', 95 * r, 55, t + 0.14, 0.18, 0.22 * vol, o);
        this.noise(t + 0.14, 0.08, 0.1 * vol, 'lowpass', 900, 200, o);
        break;
      case 'explosion':
        this.noise(t, 0.55, 0.32 * vol, 'lowpass', 2200 * r, 120, o);
        this.tone('sine', 90 * r, 30, t, 0.45, 0.35 * vol, o, true);
        break;
      case 'tesla':
        this.tone('square', 90 * r, 140, t, 0.14, 0.05 * vol, o);
        this.noise(t, 0.16, 0.12 * vol, 'bandpass', 3000 * r, 7000, o, 4);
        break;
      case 'build':
        for (let k = 0; k < 3; k++) this.noise(t + k * 0.07, 0.05, 0.25 * vol, 'bandpass', 900 + k * 200, 700, o, 6);
        this.tone('triangle', 660, 660, t + 0.22, 0.25, 0.07 * vol, o, true);
        this.tone('triangle', 990, 990, t + 0.3, 0.3, 0.06 * vol, o, true);
        break;
      case 'upgrade':
        [523, 659, 784, 1047].forEach((f, k) => this.tone('triangle', f, f, t + k * 0.06, 0.25, 0.07 * vol, o, true));
        break;
      case 'sell':
        this.tone('sine', 1760, 1760, t, 0.12, 0.08 * vol, o);
        this.tone('sine', 2349, 2349, t + 0.08, 0.2, 0.08 * vol, o);
        break;
      case 'death':
        this.tone('square', 300 * r, 80, t, 0.12, 0.04 * vol, o);
        this.noise(t, 0.1, 0.06 * vol, 'bandpass', 800 * r, 300, o, 2);
        break;
      case 'bigdeath':
        this.tone('sawtooth', 160 * r, 40, t, 0.5, 0.12 * vol, o, true);
        this.noise(t, 0.5, 0.2 * vol, 'lowpass', 1500, 100, o);
        break;
      case 'hit':
        this.noise(t, 0.05, 0.1 * vol, 'bandpass', 2500 * r, 1800, o, 8);
        this.tone('square', 1800 * r, 1700, t, 0.04, 0.02 * vol, o);
        break;
      case 'leak':
        this.tone('sawtooth', 220, 140, t, 0.5, 0.1 * vol, o, true);
        this.tone('sawtooth', 165, 110, t + 0.1, 0.5, 0.08 * vol, o, true);
        break;
      case 'wave': {
        const f = this.lowpass(900);
        this.tone('sawtooth', 196, 196, t, 0.35, 0.16 * vol, f, true);
        this.tone('sawtooth', 294, 294, t + 0.32, 0.7, 0.16 * vol, f, true);
        this.tone('sawtooth', 147, 147, t, 1.0, 0.1 * vol, f, true);
        break;
      }
      case 'boss':
        this.tone('sawtooth', 73, 55, t, 1.6, 0.25 * vol, this.lowpass(400), true);
        this.noise(t, 1.2, 0.15 * vol, 'lowpass', 300, 60, o);
        break;
      case 'meteor':
        this.noise(t, 0.9, 0.15 * vol, 'bandpass', 600, 2400, o, 1);
        break;
      // ---- sons propres à chaque sort général (SPELLS), 100 % synthétisés
      case 'sp_meteor':
        this.tone('sawtooth', 900, 120, t, 0.9, 0.07 * vol, this.lowpass(2500), true);
        this.noise(t, 1.0, 0.14 * vol, 'bandpass', 500, 2600, o, 1);
        break;
      case 'sp_renfort':
        [262, 330, 392, 523].forEach((f, k) => this.tone('triangle', f, f, t + k * 0.07, 0.28, 0.07 * vol, o, true));
        this.noise(t + 0.2, 0.25, 0.08 * vol, 'lowpass', 500, 120, o);
        break;
      case 'sp_sables':
        this.noise(t, 1.2, 0.17 * vol, 'bandpass', 700, 250, o, 0.8);
        this.tone('sine', 90, 50, t, 1.0, 0.12 * vol, this.lowpass(300));
        break;
      case 'sp_poison':
        this.noise(t, 0.9, 0.12 * vol, 'highpass', 3500, 6000, o, 1);
        [180, 215, 190].forEach((f, k) => this.tone('sine', f, f * 0.6, t + k * 0.12, 0.3, 0.08 * vol, this.lowpass(700)));
        break;
      case 'sp_soin':
        [523, 659, 784, 1047, 1319].forEach((f, k) => this.tone('sine', f, f, t + k * 0.06, 0.55, 0.06 * vol, o, true));
        break;
      case 'sp_blizzard':
        this.noise(t, 1.3, 0.16 * vol, 'highpass', 2500, 7000, o, 1.5);
        [1568, 1976, 2349].forEach((f, k) => this.tone('sine', f, f * 0.9, t + k * 0.09, 0.4, 0.04 * vol, o, true));
        break;
      case 'sp_malediction':
        this.tone('sawtooth', 220, 110, t, 1.1, 0.07 * vol, this.lowpass(500), true);
        this.tone('sawtooth', 233, 117, t, 1.1, 0.06 * vol, this.lowpass(500), true);
        this.noise(t, 0.9, 0.06 * vol, 'bandpass', 400, 150, o, 3);
        break;
      case 'sp_benediction':
        [392, 523, 659, 784].forEach((f, k) => this.tone('sine', f, f * 1.01, t + k * 0.09, 0.9, 0.055 * vol, o, true));
        this.tone('triangle', 1568, 1568, t + 0.35, 0.7, 0.03 * vol, o, true);
        break;
      case 'sp_foudre':
        this.noise(t, 0.12, 0.28 * vol, 'highpass', 1500, 6000, o, 0.7);
        this.tone('sawtooth', 2000, 90, t, 0.35, 0.09 * vol, this.lowpass(3500));
        this.noise(t + 0.1, 0.7, 0.14 * vol, 'lowpass', 400, 60, o);
        break;
      case 'sp_flammes':
        this.noise(t, 1.1, 0.2 * vol, 'bandpass', 900, 400, o, 0.6);
        this.tone('sawtooth', 110, 70, t, 0.9, 0.06 * vol, this.lowpass(350));
        break;
      case 'sp_seisme':
        this.tone('sine', 70, 28, t, 1.3, 0.22 * vol, this.lowpass(200));
        this.noise(t, 1.1, 0.2 * vol, 'lowpass', 280, 50, o);
        this.noise(t + 0.25, 0.5, 0.1 * vol, 'bandpass', 1500, 300, o, 1);
        break;
      case 'spell':
        [392, 494, 587].forEach((f, k) => this.tone('sine', f, f * 2, t + k * 0.05, 0.4, 0.06 * vol, o, true));
        break;
      case 'levelup':
        [523, 659, 784, 1047, 1319].forEach((f, k) => this.tone('square', f, f, t + k * 0.07, 0.2, 0.04 * vol, this.lowpass(3000), true));
        break;
      case 'click':
        this.tone('triangle', 900, 700, t, 0.05, 0.06 * vol, o);
        break;
      case 'deny':
        this.tone('square', 200, 160, t, 0.15, 0.05 * vol, this.lowpass(1200));
        break;
      case 'heal':
        [784, 988, 1175].forEach((f, k) => this.tone('sine', f, f, t + k * 0.05, 0.4, 0.05 * vol, o, true));
        break;
      case 'stun':
        this.tone('sine', 1200, 300, t, 0.3, 0.06 * vol, o, true);
        break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047].forEach((f, k) => this.tone('triangle', f, f, t + k * 0.16, 0.5, 0.1 * vol, o, true));
        break;
      case 'defeat':
        [392, 370, 349, 262].forEach((f, k) => this.tone('sawtooth', f, f * 0.98, t + k * 0.28, 0.6, 0.07 * vol, this.lowpass(1200), true));
        break;
    }
  }

  private lowpass(f: number) {
    const fl = this.ctx!.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = f;
    fl.connect(this.sfx);
    return fl;
  }

  // ------------------------------------------------ musique procédurale

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || settings.volMusic <= 0) return;
    const theme = THEMES[this.biome];
    const stepDur = 60 / theme.bpm / 2;
    while (this.nextTime < ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime, theme, stepDur);
      this.step++;
      this.nextTime += stepDur;
    }
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
  }

  private playStep(step: number, t: number, th: MusicTheme, sd: number) {
    const bar = Math.floor(step / 16) % th.chords.length;
    const s = step % 16;
    const chord = th.chords[bar];
    const root = th.root * Math.pow(2, chord[0] / 12);
    const m = this.music;
    const I = this.intensity;
    // nappe
    if (s === 0) {
      for (const iv of chord) {
        const f = th.root * Math.pow(2, iv / 12);
        this.pad(f, t, sd * 16, 0.035);
      }
    }
    // basse
    if (s % 4 === 0) this.tone('triangle', root / 2, root / 2, t, sd * 3, 0.09 + I * 0.04, m);
    // arpège
    if (I > 0.15 || this.biome === 'menu') {
      const pat = th.arp[s % th.arp.length];
      if (pat >= 0) {
        const iv = chord[pat % chord.length] + (pat >= chord.length ? 12 : 0);
        const f = th.root * 2 * Math.pow(2, iv / 12);
        this.tone(th.lead, f, f, t, sd * 0.9, 0.025 + I * 0.02, m);
      }
    }
    // percussions
    if (I > 0.3) {
      if (s % 8 === 0) this.tone('sine', 110, 40, t, 0.18, 0.18 * I, m);
      if (s % 8 === 4) this.noise(t, 0.12, 0.06 * I, 'bandpass', 2500, 1500, m, 1);
      if (I > 0.65 && s % 2 === 1) this.noise(t, 0.04, 0.03, 'highpass', 8000, 6000, m);
    }
  }

  private pad(f: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const fl = ctx.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = 900;
    o.type = 'sawtooth';
    o2.type = 'sawtooth';
    o.frequency.value = f;
    o2.frequency.value = f * 1.006;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(fl);
    o2.connect(fl);
    fl.connect(g);
    g.connect(this.music);
    g.connect(this.reverb);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.1);
    o2.stop(t + dur + 0.1);
  }
}

interface MusicTheme {
  root: number;
  bpm: number;
  chords: number[][];
  arp: number[];
  lead: OscillatorType;
}

const THEMES: Record<string, MusicTheme> = {
  // Ré majeur pastoral
  vallee: { root: 146.8, bpm: 100, chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14], [7, 11, 14]], arp: [0, -1, 1, 2, 3, -1, 2, 1], lead: 'triangle' },
  // La mineur brumeux
  marais: { root: 110, bpm: 84, chords: [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 10, 14]], arp: [0, -1, 2, -1, 1, -1, 3, 2], lead: 'sine' },
  // Ré mineur harmonique, martial
  cendre: { root: 73.4, bpm: 118, chords: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [7, 11, 14], [8, 12, 15], [7, 11, 14]], arp: [0, 1, 2, 1, 3, 2, 1, 2], lead: 'sawtooth' },
  menu: { root: 130.8, bpm: 76, chords: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], arp: [0, -1, 2, -1, 1, -1, 3, -1], lead: 'triangle' },
};

export const audio = new AudioEngine();
