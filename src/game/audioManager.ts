export type SoundCategory = 'music' | 'sfx' | 'ui' | 'ambient';

export interface SoundConfig {
  volume: number; // 0.0 to 1.0
  loop: boolean;
  category: SoundCategory;
}

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private gainNodes: Map<SoundCategory, GainNode> = new Map();
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  
  // Volume levels per category (0.0 to 1.0)
  private volumes: Record<SoundCategory, number> = {
    music: 0.3,
    sfx: 0.5,
    ui: 0.4,
    ambient: 0.2
  };

  private isMuted = false;
  private isInitialized = false;

  constructor() {
    // AudioContext will be initialized on user interaction
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create gain nodes for each category
      const categories: SoundCategory[] = ['music', 'sfx', 'ui', 'ambient'];
      for (const category of categories) {
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = this.volumes[category];
        gainNode.connect(this.audioContext.destination);
        this.gainNodes.set(category, gainNode);
      }

      // Load all sounds
      await this.loadSounds();

      this.isInitialized = true;
      console.log('[AudioManager] Initialized');
      console.log(`[AudioManager] Loaded ${this.buffers.size} sounds`);
      console.log(`[AudioManager] Music buffer exists: ${this.buffers.has('music_bg')}`);
    } catch (error) {
      console.warn('[AudioManager] Failed to initialize:', error);
    }
  }

  private async loadSounds(): Promise<void> {
    const soundFiles = [
      // Music
      { name: 'music_bg', file: 'Cpunk_log.ogg', category: 'music' },
      // Tower Fire
      { name: 'tower_zap', file: 'zap.wav', category: 'sfx' },
      { name: 'tower_laser', file: 'laser.wav', category: 'sfx' },
      { name: 'tower_canon', file: 'canon.wav', category: 'sfx' },
      { name: 'tower_rocket', file: 'rocket.wav', category: 'sfx' },
      // Impacts
      { name: 'impact_small', file: 'impact_small.wav', category: 'sfx' },
      { name: 'blip', file: 'blip.wav', category: 'sfx' },
      { name: 'bloop', file: 'bloop.wav', category: 'sfx' },
      // Deaths
      { name: 'death_bzap', file: 'bzap.wav', category: 'sfx' },
      { name: 'death_zap2', file: 'zap2.wav', category: 'sfx' },
      { name: 'death_zoink', file: 'zoink.wav', category: 'sfx' },
      // Skills
      { name: 'skill_emp', file: 'emp.wav', category: 'sfx' },
      { name: 'skill_sweep', file: 'sweeps.wav', category: 'sfx' },
      { name: 'skill_fall', file: 'falling.wav', category: 'sfx' },
      // UI
      { name: 'ui_shot', file: 'shot.wav', category: 'ui' },
      { name: 'ui_shot2', file: 'shot2.wav', category: 'ui' },
      // Game State
      { name: 'data_gain', file: 'data_gain.wav', category: 'sfx' },
      { name: 'data_lost', file: 'data_lost.wav', category: 'sfx' },
      { name: 'klaxon', file: 'klaxon.wav', category: 'sfx' },
      { name: 'klaxon2', file: 'klaxon2.wav', category: 'sfx' },
      // Ambient
      { name: 'ambient_process', file: 'processing.wav', category: 'ambient' },
      { name: 'ambient_wind', file: 'wind_down.wav', category: 'ambient' },
      // Extra SFX
      { name: 'sfx_blop', file: 'bloop.wav', category: 'sfx' },
      { name: 'sfx_zap_small', file: 'zap_small.wav', category: 'sfx' },
      { name: 'sfx_skip_zap', file: 'skip-zap.wav', category: 'sfx' },
      { name: 'sfx_long_zap', file: 'lomg-zap.wav', category: 'sfx' },
    ];

    for (const sound of soundFiles) {
      try {
        const buffer = await this.loadSoundFile(`/sounds/${sound.file}`);
        this.buffers.set(sound.name, buffer);
      } catch (error) {
        console.warn(`[AudioManager] Failed to load ${sound.file}:`, error);
      }
    }
  }

  private async loadSoundFile(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await this.audioContext!.decodeAudioData(arrayBuffer);
  }

  play(soundName: string, overrideVolume?: number): void {
    if (!this.isInitialized || this.isMuted) return;

    const buffer = this.buffers.get(soundName);
    if (!buffer || !this.audioContext) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Determine category and get appropriate gain node
    let category: SoundCategory = 'sfx';
    if (soundName.startsWith('music')) category = 'music';
    else if (soundName.startsWith('ui')) category = 'ui';
    else if (soundName.startsWith('ambient')) category = 'ambient';

    const gainNode = this.gainNodes.get(category);
    if (gainNode) {
      source.connect(gainNode);
    }

    if (overrideVolume !== undefined) {
      const categoryGain = this.gainNodes.get(category);
      if (categoryGain) {
        categoryGain.gain.value = overrideVolume;
      }
    }

    source.start(0);
  }

  playMusic(): void {
    if (!this.isInitialized || this.isMuted) return;
    if (!this.audioContext) return;

    // Resume audio context if suspended (browser policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(() => {
        this._startMusic();
      }).catch(err => {
        console.warn('[AudioManager] Failed to resume:', err);
      });
    } else {
      this._startMusic();
    }
  }

  private _startMusic(): void {
    // Get music buffer from loaded sounds
    const musicBuffer = this.buffers.get('music_bg');
    if (!musicBuffer) {
      console.warn('[AudioManager] Music buffer not loaded');
      return;
    }

    // Stop existing music
    this.stopMusic();

    this.musicSource = this.audioContext!.createBufferSource();
    this.musicSource.buffer = musicBuffer;
    this.musicSource.loop = true;

    const gainNode = this.gainNodes.get('music');
    if (gainNode) {
      this.musicSource.connect(gainNode);
    }

    this.musicSource.start(0);
    console.log('[AudioManager] Playing music');
  }

  /**
   * Call this on first user interaction to enable audio and start music
   */
  async enableAudio(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('[AudioManager] Audio enabled via user interaction');
      // Start music now that audio is enabled
      this._startMusic();
    } else if (this.audioContext && this.audioContext.state === 'running' && !this.musicSource) {
      // Audio already enabled but music hasn't started
      this._startMusic();
    }
  }

  stopMusic(): void {
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch (e) {
        // Already stopped
      }
      this.musicSource = null;
    }
  }

  setVolume(category: SoundCategory, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.volumes[category] = clamped;
    
    const gainNode = this.gainNodes.get(category);
    if (gainNode && this.audioContext) {
      gainNode.gain.value = clamped;
    }
  }

  getVolume(category: SoundCategory): number {
    return this.volumes[category];
  }

  mute(): void {
    this.isMuted = true;
    if (this.gainNodes.size > 0) {
      this.gainNodes.forEach(node => {
        node.gain.value = 0;
      });
    }
  }

  unmute(): void {
    this.isMuted = false;
    // Restore volumes
    this.gainNodes.forEach((node, category) => {
      node.gain.value = this.volumes[category];
    });
  }

  isMutedState(): boolean {
    return this.isMuted;
  }

  resume(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}

// Global audio manager instance
export const audioManager = new AudioManager();
