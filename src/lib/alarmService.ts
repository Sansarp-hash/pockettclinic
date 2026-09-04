/**
 * Web Audio API Alarm Sound Synthesizer for PockettClinic
 * Plays a continuous, high-priority incoming consultation chime ringtone
 * until manually stopped or muted.
 */

class AudioAlarmService {
  private audioCtx: AudioContext | null = null;
  private isPlaying = false;
  private isMutedState = false;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private inConsultation = false;

  private initCtx() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  public init() {
    this.initCtx();
  }

  /**
   * Start looping alarm chime sound
   */
  public start() {
    if (this.inConsultation) return;
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.initCtx();

    const playBeepPair = () => {
      if (!this.isPlaying || this.isMutedState) return;
      if (!this.audioCtx) return;

      try {
        const now = this.audioCtx.currentTime;

        // First Chime Tone (E5 - 659Hz)
        const osc1 = this.audioCtx.createOscillator();
        const gain1 = this.audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now);
        gain1.gain.setValueAtTime(0.25, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc1.connect(gain1);
        gain1.connect(this.audioCtx.destination);
        osc1.start(now);
        if (osc1 && typeof osc1.stop === 'function') {
          osc1.stop(now + 0.35);
        }

        // Second Chime Tone (A5 - 880Hz)
        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.2);
        gain2.gain.setValueAtTime(0.3, now + 0.2);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        osc2.start(now + 0.2);
        if (osc2 && typeof osc2.stop === 'function') {
          osc2.stop(now + 0.6);
        }
      } catch (err) {
        console.warn("Audio Context playback error:", err);
      }
    };

    // Play immediately then loop every 1.1s
    playBeepPair();
    this.timerId = setInterval(playBeepPair, 1100);
  }

  /**
   * Stop looping alarm chime sound completely
   */
  public stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Toggle mute state
   */
  public toggleMute(): boolean {
    this.isMutedState = !this.isMutedState;
    if (this.isMutedState) {
      // Temporarily silent
    } else if (this.isPlaying) {
      this.initCtx();
    }
    return this.isMutedState;
  }

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public isAlarmPlaying(): boolean {
    return this.isPlaying;
  }

  public setInConsultation(val: boolean) {
    this.inConsultation = val;
    if (val) {
      this.stop();
    }
  }

  public isInConsultation(): boolean {
    return this.inConsultation;
  }
}

export const alarmService = new AudioAlarmService();
export default alarmService;
