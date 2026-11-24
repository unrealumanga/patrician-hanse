import type { CueKind } from "../sim/index.ts"

/**
 * Tactile Inkline Audio Engine:
 * Filtered noise quill scratches, parchment rustles, wax-seal thuds,
 * brass harbor bells, and plucked medieval lute phrases.
 */
export class HanseAudio {
  private ctx: AudioContext | null = null
  private muted = false

  public isMuted(): boolean {
    return this.muted
  }

  public toggleMute(): boolean {
    this.muted = !this.muted
    return this.muted
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null
    if (!this.ctx && typeof window !== "undefined") {
      const Ctor = window.AudioContext
      if (Ctor) this.ctx = new Ctor()
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume()
    }
    return this.ctx
  }

  private playNoiseBurst(
    ctx: AudioContext,
    dur: number,
    centerFreq: number,
    q: number,
    gainPeak: number,
    offset = 0
  ): void {
    const sampleCount = Math.max(128, Math.floor(ctx.sampleRate * dur))
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount)
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = centerFreq
    filter.Q.value = q

    const gain = ctx.createGain()
    const start = ctx.currentTime + offset
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.linearRampToValueAtTime(gainPeak, start + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)

    src.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    src.start(start)
  }

  private playPluck(
    ctx: AudioContext,
    freq: number,
    dur: number,
    gainPeak: number,
    offset = 0
  ): void {
    const now = ctx.currentTime + offset
    const osc = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "triangle"
    osc2.type = "sine"
    osc.frequency.setValueAtTime(freq, now)
    osc2.frequency.setValueAtTime(freq * 2, now)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    osc.connect(gain)
    osc2.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc2.start(now)
    osc.stop(now + dur + 0.02)
    osc2.stop(now + dur + 0.02)
  }

  public play(kind: CueKind): void {
    const ctx = this.ensureContext()
    if (!ctx) return

    switch (kind) {
      case "select":
        // Crisp quill scratch on parchment
        this.playNoiseBurst(ctx, 0.045, 2400, 2.2, 0.04)
        break
      case "coin":
        // Silver pfennig clink + quill ledger entry
        this.playPluck(ctx, 1318, 0.14, 0.035, 0)
        this.playPluck(ctx, 1760, 0.16, 0.028, 0.045)
        break
      case "crane":
        // Wooden pulley creak + silver coin chime
        this.playNoiseBurst(ctx, 0.09, 680, 4.5, 0.045, 0)
        this.playPluck(ctx, 1175, 0.13, 0.032, 0.05)
        break
      case "sail":
        // Canvas sail snap + wind rush
        this.playNoiseBurst(ctx, 0.14, 950, 1.4, 0.05, 0)
        this.playPluck(ctx, 392, 0.22, 0.032, 0.04)
        break
      case "arrive":
        // Twin brass harbor bell
        this.playPluck(ctx, 784, 0.34, 0.045, 0)
        this.playPluck(ctx, 1046, 0.42, 0.038, 0.14)
        break
      case "build":
        // Timber hammer thud
        this.playNoiseBurst(ctx, 0.07, 420, 1.6, 0.065, 0)
        this.playNoiseBurst(ctx, 0.06, 520, 1.8, 0.05, 0.09)
        break
      case "battle":
        // Distant cannon thump
        this.playNoiseBurst(ctx, 0.28, 160, 1.2, 0.09, 0)
        this.playNoiseBurst(ctx, 0.22, 140, 1.1, 0.07, 0.13)
        break
      case "alert":
        // Muted warning horn
        this.playPluck(ctx, 293, 0.24, 0.045, 0)
        this.playPluck(ctx, 261, 0.26, 0.04, 0.11)
        break
      case "rankUp":
      case "victory":
        // Wax-seal stamp thud + medieval lute fifth arpeggio
        this.playNoiseBurst(ctx, 0.08, 280, 1.4, 0.07, 0)
        this.playPluck(ctx, 392, 0.28, 0.042, 0.05)
        this.playPluck(ctx, 494, 0.28, 0.042, 0.16)
        this.playPluck(ctx, 587, 0.35, 0.046, 0.27)
        if (kind === "victory") {
          this.playPluck(ctx, 784, 0.55, 0.052, 0.39)
        }
        break
    }
  }
}
