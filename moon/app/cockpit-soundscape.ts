// Quiet, original equipment sounds synthesized locally. No additional audio downloads.
export type EquipmentSound = 'relay' | 'console' | 'metal' | 'static' | 'carrier' | 'motor';
export const soundTiming = {
  middle: [16, 32], distant: [90, 180], music: [75, 125], silence: [25, 50],
  fadeIn: 18, fadeOut: 16, musicLevel: .12,
} as const;
const between = (range: readonly number[]) => range[0] + Math.random() * (range[1] - range[0]);

/** Shared by real-time playback and the offline mix verification. */
export function createCabinGraph(ctx: BaseAudioContext, output: AudioNode = ctx.destination, bedLevel = 1) {
  const master = ctx.createGain(); master.gain.value = 0; master.connect(output);
  const bed = ctx.createGain(); bed.gain.value = bedLevel; bed.connect(master);
  const music = ctx.createGain(); music.gain.value = 0; music.connect(master);
  const noise = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const continuous: AudioScheduledSourceNode[] = [];
  const transients = new Set<() => void>();
  const hum = (frequency: number, level: number) => {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.frequency.value = frequency; gain.gain.value = level;
    osc.connect(gain).connect(bed); osc.start(); continuous.push(osc);
  };
  hum(73, .018); hum(146.3, .006);
  const fan = ctx.createBufferSource(), low = ctx.createBiquadFilter(), high = ctx.createBiquadFilter(), air = ctx.createGain();
  fan.buffer = noise; fan.loop = true;
  high.type = 'highpass'; high.frequency.value = 100;
  low.type = 'lowpass'; low.frequency.value = 430; low.Q.value = .45;
  air.gain.value = .09;
  fan.connect(high).connect(low).connect(air).connect(bed); fan.start(); continuous.push(fan);

  const voice = (at: number, duration: number, peak: number, frequency: number, endFrequency: number, pan: number, noisy = false, attack = .025) => {
    const source = noisy ? ctx.createBufferSource() : ctx.createOscillator();
    const filter = ctx.createBiquadFilter(), gain = ctx.createGain(), position = ctx.createStereoPanner();
    if (source instanceof AudioBufferSourceNode) { source.buffer = noise; source.loop = true; }
    else { source.type = 'sine'; source.frequency.setValueAtTime(frequency, at); source.frequency.exponentialRampToValueAtTime(endFrequency, at + duration); }
    filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = noisy ? .7 : .3;
    position.pan.value = pan;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + attack);
    // Keep a recognizable body; the old exponential tail made beeps almost single clicks.
    gain.gain.setValueAtTime(peak * .8, at + Math.max(attack, duration * .55));
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    gain.gain.setValueAtTime(0, at + duration + .01);
    source.connect(filter).connect(gain).connect(position).connect(master);
    const cleanup = () => { try { source.stop(); } catch {} source.disconnect(); filter.disconnect(); gain.disconnect(); position.disconnect(); transients.delete(cleanup); };
    source.onended = cleanup; transients.add(cleanup);
    source.start(at); source.stop(at + duration + .02);
  };
  const event = (kind: EquipmentSound, at = ctx.currentTime) => {
    const pan = (Math.random() - .5) * 1.1, variation = .85 + Math.random() * .3;
    switch (kind) {
      case 'relay':
        voice(at, .085, .28 * variation, 1350, 1350, pan, true, .004);
        voice(at + .14, .065, .18 * variation, 950, 950, pan, true, .003); break;
      case 'console': voice(at, .34, .085 * variation, 760, 760, pan, false, .025); break;
      case 'metal':
        voice(at, .95, .065 * variation, 470, 464, pan, false, .015);
        voice(at + .01, .6, .032 * variation, 781, 769, pan, false, .02); break;
      case 'static': voice(at, 2.2, .16, 1350, 1350, pan, true, .32); break;
      case 'carrier': voice(at, 2.6, .05, 550, 850, pan, false, .65); break;
      case 'motor':
        voice(at, 3.8, .055, 95, 150, pan, false, 1.1);
        voice(at, 3.6, .022, 285, 450, pan, false, 1.1);
        voice(at, 3.7, .12, 480, 480, pan, true, 1.2); break;
    }
  };
  const clearEvents = () => { for (const stop of [...transients]) stop(); };
  return {master, bed, music, event, clearEvents, dispose() {
    clearEvents(); for (const source of continuous) { source.stop(); source.disconnect(); }
    air.disconnect(); low.disconnect(); high.disconnect(); bed.disconnect(); music.disconnect(); master.disconnect();
  }};
}

// Uses audio time, so background suspension never queues a burst of missed sounds.
export class AmbientScore {
  private nextMiddle = 0;
  private nextDistant = 0;
  private nextMusic = 0;
  private lastEvent = -100;
  private musicPresent = true;
  private lastMiddle = -1;
  private lastDistant = -1;
  private middleBag: number[] = [];
  private distantBag: number[] = [];
  private initialized = false;
  private pausedAt: number | null = null;
  private fadeEnd = 0;
  private pick(bag: number[], previous: number) {
    if (!bag.length) {
      bag.push(0, 1, 2);
      for (let i = 2; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
      if (bag[2] === previous) [bag[0], bag[2]] = [bag[2], bag[0]];
    }
    return bag.pop()!;
  }
  constructor(private ctx: BaseAudioContext, private graph: ReturnType<typeof createCabinGraph>, private musicLevel: number = soundTiming.musicLevel) {}
  start() {
    const now = this.ctx.currentTime, g = this.graph;
    if (this.initialized) {
      if (this.pausedAt !== null) {
        const elapsed = now - this.pausedAt;
        this.nextMiddle += elapsed; this.nextDistant += elapsed; this.nextMusic += elapsed;
        this.lastEvent += elapsed; this.fadeEnd += elapsed;
        if (this.fadeEnd > now) g.music.gain.linearRampToValueAtTime(this.musicPresent ? this.musicLevel : 0, this.fadeEnd);
        this.pausedAt = null;
      }
      return;
    }
    this.initialized = true;
    g.clearEvents();
    g.music.gain.cancelScheduledValues(now); g.music.gain.setValueAtTime(0, now);
    this.fadeEnd = now + soundTiming.fadeIn;
    g.music.gain.linearRampToValueAtTime(this.musicLevel, this.fadeEnd);
    this.musicPresent = true;
    this.nextMusic = now + soundTiming.fadeIn + between(soundTiming.music);
    this.nextMiddle = now + between([8, 12]); this.nextDistant = now + between([35, 55]); this.lastEvent = now;
  }
  pause() {
    if (!this.initialized || this.pausedAt !== null) return;
    this.pausedAt = this.ctx.currentTime;
    this.graph.music.gain.cancelAndHoldAtTime(this.pausedAt); this.graph.clearEvents();
  }
  tick() {
    if (!this.initialized || this.pausedAt !== null) return;
    const now = this.ctx.currentTime, g = this.graph;
    if (now >= this.nextMusic) {
      const duration = this.musicPresent ? soundTiming.fadeOut : soundTiming.fadeIn;
      g.music.gain.setValueAtTime(this.musicPresent ? this.musicLevel : 0, now);
      g.music.gain.linearRampToValueAtTime(this.musicPresent ? 0 : this.musicLevel, now + duration);
      this.fadeEnd = now + duration;
      this.musicPresent = !this.musicPresent;
      this.nextMusic = now + duration + between(this.musicPresent ? soundTiming.music : soundTiming.silence);
    }
    if (now >= this.nextDistant && now - this.lastEvent >= 8) {
      this.lastDistant = this.pick(this.distantBag, this.lastDistant);
      g.event((['static', 'carrier', 'motor'] as const)[this.lastDistant]);
      this.lastEvent = now; this.nextDistant = now + between(soundTiming.distant); this.nextMiddle = Math.max(this.nextMiddle, now + 12);
    } else if (now >= this.nextMiddle && now - this.lastEvent >= 8) {
      this.lastMiddle = this.pick(this.middleBag, this.lastMiddle);
      g.event((['relay', 'console', 'metal'] as const)[this.lastMiddle]);
      this.lastEvent = now; this.nextMiddle = now + between(soundTiming.middle);
    }
  }
}

export class CockpitSoundscape {
  private ctx: AudioContext | null = null;
  private graph: ReturnType<typeof createCabinGraph> | null = null;
  private player: HTMLAudioElement | null = null;
  private musicSource: MediaElementAudioSourceNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pauseTimer: ReturnType<typeof setTimeout> | null = null;
  private wanted = false;
  private disposed = false;
  private volume = .35;
  private score: AmbientScore | null = null;
  constructor(private src: string, private status: (playing: boolean, failed: boolean) => void) {}

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.graph && this.wanted) {
      this.graph.master.gain.cancelAndHoldAtTime(this.ctx.currentTime);
      this.graph.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, .06);
    }
  }
  start() {
    if (this.disposed) return;
    this.wanted = true;
    if (this.pauseTimer) { clearTimeout(this.pauseTimer); this.pauseTimer = null; }
    try {
      if (!this.ctx) {
        const ctx = this.ctx = new AudioContext();
        this.graph = createCabinGraph(ctx);
        this.score = new AmbientScore(ctx, this.graph);
        const player = this.player = new Audio(this.src); player.loop = true; player.preload = 'none';
        this.musicSource = ctx.createMediaElementSource(player); this.musicSource.connect(this.graph.music);
        player.addEventListener('error', this.mediaError);
        ctx.addEventListener('statechange', this.contextState);
      }
      // Both calls happen inside the gesture; never await one before unlocking the other.
      void this.ctx.resume().then(() => this.sync()).catch(() => { if (!this.disposed && this.wanted) this.status(false, true); });
      if (this.player!.paused) void this.player!.play().catch(error => {
        if (!this.disposed && this.wanted && error?.name !== 'NotAllowedError' && error?.name !== 'AbortError') this.mediaError();
      });
      this.sync();
    } catch { this.status(false, true); }
  }
  private mediaError = () => { if (!this.disposed) this.status(!!this.timer, true); };
  private contextState = () => this.sync();
  private sync() {
    const c = this.ctx, g = this.graph;
    if (this.disposed || !c || !g) return;
    if (!this.wanted || c.state !== 'running') {
      this.score?.pause();
      if (!this.wanted) this.player?.pause();
      if (this.timer) clearInterval(this.timer); this.timer = null;
      this.status(false, false); return;
    }
    if (this.timer) return;
    const now = c.currentTime;
    g.master.gain.cancelScheduledValues(now); g.master.gain.setValueAtTime(0, now);
    g.master.gain.linearRampToValueAtTime(this.volume, now + 1.8);
    this.score?.start();
    this.timer = setInterval(() => {if(this.wanted && c.state === 'running') this.score?.tick();}, 500);
    this.status(true, false);
  }
  pause() {
    this.wanted = false;
    this.score?.pause();
    if (this.timer) clearInterval(this.timer); this.timer = null;
    this.status(false, false);
    const c = this.ctx, g = this.graph;
    if (c && g) { g.master.gain.cancelScheduledValues(c.currentTime); g.master.gain.setTargetAtTime(0, c.currentTime, .015); }
    if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.pauseTimer = setTimeout(() => {
      this.pauseTimer = null; if (this.wanted || this.disposed) return;
      this.player?.pause(); this.graph?.clearEvents(); void this.ctx?.suspend().catch(() => {});
    }, 100);
  }
  dispose() {
    this.disposed = true; this.wanted = false;
    if (this.timer) clearInterval(this.timer); if (this.pauseTimer) clearTimeout(this.pauseTimer);
    this.timer = null; this.pauseTimer = null;
    if (this.player) { this.player.removeEventListener('error', this.mediaError); this.player.pause(); this.player.removeAttribute('src'); this.player.load(); }
    this.ctx?.removeEventListener('statechange', this.contextState);
    this.musicSource?.disconnect(); this.graph?.dispose(); void this.ctx?.close().catch(() => {});
  }
}
