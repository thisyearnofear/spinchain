/**
 * Audio Mixer - Web Audio API-based mixing for workout audio
 * 
 * Core Principles:
 * - MODULAR: Self-contained audio engine
 * - PERFORMANT: Efficient gain scheduling, minimal GC
 * - CLEAN: Clear separation of mixing concerns
 */

import { AudioLayer, WorkoutAudioState } from './types';
import { AUDIO_PRIORITIES, DEFAULT_GAINS } from './constants';

class AudioMixer {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private layers: Map<string, AudioLayer> = new Map();
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  /**
   * Initialize audio context (must be called after user interaction)
   */
  async initialize(): Promise<void> {
    if (this.context) return;
    
    this.context = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    
    // Master gain
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.8;
    
    // Compressor for consistent levels
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -24;
    this.compressor.knee.value = 30;
    this.compressor.ratio.value = 12;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.25;
    
    // Analyser for visualization
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    
    // Chain: Master -> Compressor -> Analyser -> Destination
    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.context.destination);
  }

  /**
   * Resume audio context (needed after suspend)
   */
  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  /**
   * Create audio layer from ArrayBuffer
   */
  async createLayer(
    id: string,
    audioBuffer: ArrayBuffer,
    type: AudioLayer['type'],
    priority: number = AUDIO_PRIORITIES.sfx
  ): Promise<AudioLayer> {
    if (!this.context || !this.masterGain) {
      throw new Error('Audio mixer not initialized');
    }

    // Decode audio
    const buffer = await this.context.decodeAudioData(audioBuffer.slice(0));
    
    // Create source
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    
    // Create gain node for this layer
    const gainNode = this.context.createGain();
    gainNode.gain.value = DEFAULT_GAINS[type] ?? 0.5;
    
    // Connect: Source -> Gain -> Master
    source.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    const layer: AudioLayer = {
      id,
      source,
      gainNode,
      type,
      priority,
    };
    
    this.layers.set(id, layer);
    
    // Auto-cleanup when done
    source.onended = () => {
      this.layers.delete(id);
    };
    
    return layer;
  }

  /**
   * Play audio layer
   */
  playLayer(id: string, offset: number = 0): void {
    const layer = this.layers.get(id);
    if (!layer) return;
    
    if (layer.source instanceof AudioBufferSourceNode) {
      layer.source.start(0, offset);
    }
    
    // Apply ducking to lower priority layers
    this.applyDucking(layer.priority);
  }

  /**
   * Stop audio layer
   */
  stopLayer(id: string): void {
    const layer = this.layers.get(id);
    if (!layer) return;
    
    try {
      if (layer.source instanceof AudioBufferSourceNode) {
        layer.source.stop();
      } else {
        layer.source.pause();
        layer.source.currentTime = 0;
      }
    } catch {
      // Already stopped
    }
    
    this.layers.delete(id);
    this.releaseDucking();
  }

  /**
   * Stop all layers
   */
  stopAll(): void {
    this.layers.forEach((layer) => {
      try {
        if (layer.source instanceof AudioBufferSourceNode) {
          layer.source.stop();
        } else {
          layer.source.pause();
        }
      } catch {
        // Ignore
      }
    });
    this.layers.clear();
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    if (!this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(volume, this.context!.currentTime, 0.1);
  }

  /**
   * Set layer volume
   */
  setLayerVolume(id: string, volume: number): void {
    const layer = this.layers.get(id);
    if (!layer) return;
    
    layer.gainNode.gain.setTargetAtTime(volume, this.context!.currentTime, 0.1);
  }

  /**
   * Apply ducking to lower priority layers
   */
  private applyDucking(triggerPriority: number): void {
    this.layers.forEach((layer) => {
      if (layer.priority < triggerPriority) {
        // Duck by 30%
        const targetGain = (DEFAULT_GAINS[layer.type] ?? 0.5) * 0.7;
        layer.gainNode.gain.setTargetAtTime(targetGain, this.context!.currentTime, 0.05);
      }
    });
  }

  /**
   * Release ducking
   */
  private releaseDucking(): void {
    this.layers.forEach((layer) => {
      const targetGain = DEFAULT_GAINS[layer.type] ?? 0.5;
      layer.gainNode.gain.setTargetAtTime(targetGain, this.context!.currentTime, 0.3);
    });
  }

  /**
   * Get audio frequency data for visualization
   */
  getFrequencyData(): Uint8Array | null {
    if (!this.analyser) return null;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Get current state
   */
  getState(): WorkoutAudioState {
    return {
      isPlaying: this.layers.size > 0,
      currentIntensity: this.calculateIntensity(),
      layers: new Map(this.layers),
      masterGain: this.masterGain,
    };
  }

  /**
   * Calculate current audio intensity (for visual sync)
   */
  private calculateIntensity(): number {
    if (this.layers.size === 0) return 0;
    
    let totalGain = 0;
    this.layers.forEach((layer) => {
      totalGain += layer.gainNode.gain.value * (layer.priority / 10);
    });
    
    return Math.min(totalGain / this.layers.size, 1);
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.stopAll();
    this.context?.close();
    this.context = null;
    this.masterGain = null;
    this.compressor = null;
    this.analyser = null;
  }
}

// Singleton instance
let mixerInstance: AudioMixer | null = null;

export function getAudioMixer(): AudioMixer {
  if (!mixerInstance) {
    mixerInstance = new AudioMixer();
  }
  return mixerInstance;
}

export function resetAudioMixer(): void {
  mixerInstance?.dispose();
  mixerInstance = null;
}

export { AudioMixer };
