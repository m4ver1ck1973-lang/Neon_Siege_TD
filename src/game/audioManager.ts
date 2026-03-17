export type SoundCategory = 'music' | 'sfx' | 'ui' | 'ambient' | 'voice';

export interface SoundConfig {
  volume: number; // 0.0 to 1.0
  loop: boolean;
  category: SoundCategory;
}

export interface PlaySoundOptions {
  pitchVariation?: number; // Range for random pitch variation (e.g., 0.1 = ±10%)
  pan?: number; // -1.0 (left) to 1.0 (right), overrides position-based panning
  position?: { x: number; y: number }; // Game position for auto-panning
  modulatedPan?: { frequency: number; amplitude: number }; // Sine wave modulation (Hz, -1 to 1 range)
}

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private gainNodes: Map<SoundCategory, GainNode> = new Map();
  private musicSource: AudioBufferSourceNode | null = null;
  private currentMusicIndex = 0;
  private musicPlaylist: string[] = ['music_bgm_2', 'music_bgm_1'];

  // Brownout low-pass filter
  private brownoutFilter: BiquadFilterNode | null = null;
  private isBrownout = false;

  // Tracking modulated pan sources for cleanup
  private modulatedPanSources: Map<AudioBufferSourceNode, { startTime: number; frequency: number; amplitude: number }> = new Map();

  // Volume levels per category (0.0 to 1.0)
  private volumes: Record<SoundCategory, number> = {
    music: 0.3,
    sfx: 0.5,
    ui: 0.4,
    ambient: 0.2,
    voice: 0.6
  };

  private isMuted = false;
  private isInitialized = false;
  private isLoading = false;
  private loadProgress = 0;
  private totalSoundsToLoad = 0;
  private onProgressCallback?: (loaded: number, total: number) => void;

  constructor() {
    // AudioContext will be initialized on user interaction
  }

  /**
   * Set callback for loading progress updates
   */
  onProgress(callback: (loaded: number, total: number) => void) {
    this.onProgressCallback = callback;
  }

  /**
   * Check if audio manager is fully loaded and ready
   */
  isReady(): boolean {
    return this.isInitialized && !this.isLoading;
  }

  /**
   * Get loading progress (0-1)
   */
  getLoadingProgress(): { loaded: number; total: number; percent: number } {
    return {
      loaded: this.loadProgress,
      total: this.totalSoundsToLoad,
      percent: this.totalSoundsToLoad > 0 ? this.loadProgress / this.totalSoundsToLoad : 0
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.isLoading = true;
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Create brownout low-pass filter (master filter for all audio)
      this.brownoutFilter = this.audioContext.createBiquadFilter();
      this.brownoutFilter.type = 'lowpass';
      this.brownoutFilter.frequency.value = 20000; // Full frequency when not in brownout
      this.brownoutFilter.connect(this.audioContext.destination);

      // Create gain nodes for each category
      const categories: SoundCategory[] = ['music', 'sfx', 'ui', 'ambient', 'voice'];
      for (const category of categories) {
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = this.volumes[category];
        gainNode.connect(this.brownoutFilter); // Connect to brownout filter instead of destination
        this.gainNodes.set(category, gainNode);
      }

      // Load all sounds with progress tracking
      await this.loadSounds();

      this.isInitialized = true;
      this.isLoading = false;
      console.log('[AudioManager] Initialized');
      console.log(`[AudioManager] Loaded ${this.buffers.size} sounds`);
    } catch (error) {
      this.isLoading = false;
      console.warn('[AudioManager] Failed to initialize:', error);
    }
  }

  private async loadSounds(): Promise<void> {
    console.log('[AudioManager] Starting loadSounds...');
    
    // Count total sounds to load (BGM + SFX, voice loads in background)
    const bgmFiles = ['Cpunk_log.ogg', 'neonsiege-2.ogg'];
    const sfxFiles = [
      'blip.wav', 'bloop.wav', 'bzap.wav', 'canon.wav', 'data_gain.wav', 'data_lost.wav',
      'debuff.wav', 'emp.wav', 'falling.wav', 'impact_small.wav', 'klaxon.wav', 'klaxon2.wav',
      'laser.wav', 'lomg-zap.wav', 'processing.wav', 'rocket.wav', 'shot.wav', 'shot2.wav',
      'skip-zap.wav', 'sweeps.wav', 'wind_down.wav', 'zap.wav', 'zap2.wav', 'zap_small.wav', 'zoink.wav'
    ];
    
    this.totalSoundsToLoad = bgmFiles.length + sfxFiles.length;
    this.loadProgress = 0;
    
    console.log(`[AudioManager] Total sounds to load: ${this.totalSoundsToLoad}`);

    // Load BGM FIRST so music can start immediately
    // BGM files are larger OGG files, so use longer timeout (30s)
    console.log('[AudioManager] Loading BGM files...');
    for (let i = 0; i < bgmFiles.length; i++) {
      console.log(`[AudioManager] Loading BGM ${i + 1}/${bgmFiles.length}: ${bgmFiles[i]}`);
      try {
        const buffer = await this.loadSoundFile(`/sounds/bgm/${bgmFiles[i]}`, 30000);
        this.buffers.set(`music_bgm_${i + 1}`, buffer);
        // Also store as music_bg for backwards compatibility
        if (i === 0) {
          this.buffers.set('music_bg', buffer);
        }
        this.loadProgress++;
        console.log(`[AudioManager] BGM progress: ${this.loadProgress}/${this.totalSoundsToLoad}`);
        if (this.onProgressCallback) {
          console.log('[AudioManager] Calling progress callback...');
          this.onProgressCallback(this.loadProgress, this.totalSoundsToLoad);
        }
        // Yield to main thread to allow UI update
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        this.loadProgress++;
        console.warn(`[AudioManager] Failed to load bgm/${bgmFiles[i]}:`, error);
      }
    }
    console.log('[AudioManager] BGM loaded, music ready');

    // Load SFX in parallel for faster loading, but with yielding
    console.log('[AudioManager] Loading SFX files...');
    const batchSize = 3; // Smaller batches for more frequent progress updates
    for (let i = 0; i < sfxFiles.length; i += batchSize) {
      const batch = sfxFiles.slice(i, i + batchSize);
      console.log(`[AudioManager] Loading SFX batch ${Math.floor(i / batchSize) + 1}: ${batch.join(', ')}`);
      
      const results = await Promise.allSettled(batch.map(async (file) => {
        try {
          const baseName = file.replace('.wav', '').replace('.ogg', '').replace(/\./g, '_');
          const buffer = await this.loadSoundFile(`/sounds/sfx/${file}`, 10000);
          this.buffers.set(`sfx_${baseName}`, buffer);
          this.buffers.set(baseName, buffer);
          return true;
        } catch (error) {
          console.warn(`[AudioManager] Failed to load sfx/${file}:`, error);
          return false;
        }
      }));
      
      // Update progress after each batch
      this.loadProgress += results.length;
      console.log(`[AudioManager] SFX progress: ${this.loadProgress}/${this.totalSoundsToLoad}`);
      if (this.onProgressCallback) {
        console.log('[AudioManager] Calling progress callback...');
        this.onProgressCallback(this.loadProgress, this.totalSoundsToLoad);
      }
      // Yield to main thread to allow UI update
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    console.log('[AudioManager] SFX loaded');

    // Create aliases for old sound names (after SFX are loaded)
    this.setupAliases();

    // Load voice files in background (lowest priority - don't block)
    console.log('[AudioManager] Voice files loading in background...');
    const voiceFiles = [
      'circuit_saturated.wav', 'core_exposed.wav', 'data_breach_imminent.wav',
      'firewall_crumbling.wav', 'grid_capacity_exceeded.wav', 'no_more_nodes.wav',
      'overclocking.wav', 'protocol_active.wav', 'safety_limiters_off.wav',
      'sentry_synced.wav', 'stabilizing_link.wav', 'system_overload_activated.wav',
      'tower_online.wav', 'vector_cleared.wav', 'wave_complete.wav'
    ];

    // Don't await voice loading - let it happen in background
    voiceFiles.forEach(async (file) => {
      try {
        const baseName = file.replace('.wav', '').replace('.ogg', '').replace(/\./g, '_');
        const buffer = await this.loadSoundFile(`/sounds/voice/${file}`, 10000);
        this.buffers.set(`voice_${baseName}`, buffer);
      } catch (error) {
        console.warn(`[AudioManager] Failed to load voice/${file}:`, error);
      }
    });
    console.log('[AudioManager] Voice loading in background');
  }

  /**
   * Setup aliases for backwards compatibility with old sound names
   */
  private setupAliases(): void {
    // Tower sounds
    this.buffers.set('tower_canon', this.buffers.get('canon'));
    this.buffers.set('tower_laser', this.buffers.get('laser'));
    this.buffers.set('tower_zap', this.buffers.get('zap'));
    this.buffers.set('tower_rocket', this.buffers.get('rocket'));
    
    // Death sounds
    this.buffers.set('death_bzap', this.buffers.get('bzap'));
    this.buffers.set('death_zap2', this.buffers.get('zap2'));
    this.buffers.set('death_zoink', this.buffers.get('zoink'));
    
    // Skill sounds
    this.buffers.set('skill_emp', this.buffers.get('emp'));
    this.buffers.set('skill_fall', this.buffers.get('falling'));
    this.buffers.set('skill_sweep', this.buffers.get('sweeps'));
    
    // UI sounds
    this.buffers.set('ui_shot', this.buffers.get('shot'));
    this.buffers.set('ui_shot2', this.buffers.get('shot2'));
    
    // SFX aliases
    this.buffers.set('sfx_zap_small', this.buffers.get('zap_small'));
    this.buffers.set('sfx_skip_zap', this.buffers.get('skip_zap'));
    this.buffers.set('sfx_long_zap', this.buffers.get('lomg_zap'));
    this.buffers.set('sfx_blop', this.buffers.get('bloop'));
    
    // Ambient aliases
    this.buffers.set('ambient_process', this.buffers.get('processing'));
    this.buffers.set('ambient_wind', this.buffers.get('wind_down'));
  }

  private async loadSoundFile(url: string, timeoutMs: number = 10000): Promise<AudioBuffer> {
    // Add timeout to prevent hanging on missing files
    // Default 10s, but BGM files can take longer to decode
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      console.log(`[AudioManager] Loading: ${url}`);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      console.log(`[AudioManager] Decoding: ${url} (${arrayBuffer.byteLength} bytes)`);
      const startTime = Date.now();
      
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      
      console.log(`[AudioManager] Decoded ${url} in ${Date.now() - startTime}ms (${audioBuffer.duration.toFixed(2)}s)`);
      return audioBuffer;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`[AudioManager] Failed to load ${url}:`, error);
      throw error;
    }
  }

  play(soundName: string, options?: PlaySoundOptions): void {
    // Auto-initialize if not already done
    if (!this.isInitialized) {
      this.initialize().catch(console.warn);
      return; // Sound will play on next call after initialization
    }

    if (this.isMuted) return;

    const buffer = this.buffers.get(soundName);
    if (!buffer || !this.audioContext) return;

    // Resume audio context if suspended (browser policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(console.warn);
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;

    // Apply pitch variation if requested
    if (options?.pitchVariation) {
      const variation = (Math.random() * 2 - 1) * options.pitchVariation; // -variation to +variation
      source.playbackRate.value = 1 + variation;
    }

    // Create panning node
    const panNode = this.audioContext.createStereoPanner();
    
    // Determine pan value
    let panValue = 0;
    
    if (options?.modulatedPan) {
      // Modulated panning - sine wave
      const { frequency, amplitude } = options.modulatedPan;
      this.modulatedPanSources.set(source, {
        startTime: this.audioContext.currentTime,
        frequency,
        amplitude
      });
      panValue = 0; // Will be modulated over time
    } else if (options?.pan !== undefined) {
      // Static pan override
      panValue = Math.max(-1, Math.min(1, options.pan));
    } else if (options?.position) {
      // Position-based panning (game coordinates to stereo pan)
      // Assuming game grid is roughly 0-20 width, center around middle
      const gameWidth = 20;
      const normalizedPos = options.position.x / gameWidth; // 0 to 1
      panValue = (normalizedPos - 0.5) * 2; // -1 to 1
    }
    
    panNode.pan.value = panValue;

    // Determine category and get appropriate gain node
    let category: SoundCategory = 'sfx';
    if (soundName.startsWith('music')) category = 'music';
    else if (soundName.startsWith('ui')) category = 'ui';
    else if (soundName.startsWith('ambient')) category = 'ambient';
    else if (soundName.startsWith('voice')) category = 'voice';

    const gainNode = this.gainNodes.get(category);
    if (gainNode) {
      // Connect: source -> pan -> gain -> brownout filter -> destination
      source.connect(panNode);
      panNode.connect(gainNode);
    }

    // Handle modulated panning over time
    if (options?.modulatedPan && this.audioContext) {
      const { frequency, amplitude } = options.modulatedPan;
      const startTime = this.audioContext.currentTime;
      
      // Create LFO for modulation
      const lfo = this.audioContext.createOscillator();
      const lfoGain = this.audioContext.createGain();
      
      lfo.type = 'sine';
      lfo.frequency.value = frequency;
      lfoGain.gain.value = amplitude;
      
      lfo.connect(lfoGain);
      lfoGain.connect(panNode.pan);
      lfo.start(startTime);
      
      // Stop LFO when source ends
      source.onended = () => {
        lfo.stop();
        this.modulatedPanSources.delete(source);
      };
    }

    source.start(0);
    
    // Auto-cleanup for modulated pan sources
    if (!options?.modulatedPan) {
      source.onended = () => {
        // Regular cleanup
      };
    }
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
    // Stop existing music
    this.stopMusic();

    // Get current track from playlist
    const trackName = this.musicPlaylist[this.currentMusicIndex];
    const musicBuffer = this.buffers.get(trackName);

    if (!musicBuffer) {
      console.warn(`[AudioManager] Music track ${trackName} not loaded`);
      return;
    }

    this.musicSource = this.audioContext!.createBufferSource();
    this.musicSource.buffer = musicBuffer;
    this.musicSource.loop = false; // Don't loop individual tracks

    // When track ends, play next track
    this.musicSource.onended = () => {
      // Advance to next track
      this.currentMusicIndex = (this.currentMusicIndex + 1) % this.musicPlaylist.length;
      // Start next track (don't check musicSource since we just set it)
      setTimeout(() => this._startMusic(), 100);
    };

    const gainNode = this.gainNodes.get('music');
    if (gainNode) {
      this.musicSource.connect(gainNode);
    }

    this.musicSource.start(0);
    console.log(`[AudioManager] Playing music: ${trackName} (${this.currentMusicIndex + 1}/${this.musicPlaylist.length})`);
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
    }
    // Always start music when this is called (first interaction)
    if (!this.musicSource) {
      this._startMusic();
    }
  }

  /**
   * Play a voice line by key name
   */
  playVoice(lineKey: string): void {
    const voiceName = `voice_${lineKey}`;
    this.play(voiceName);
  }

  /**
   * Play a voice line by phrase key from voice.txt
   * Maps standard lines to cyberpunk variations
   */
  playVoiceLine(context: 'grid_full' | 'losing' | 'win_wave' | 'build' | 'ultimate'): void {
    const voiceLines: Record<string, string[]> = {
      grid_full: ['voice_grid_capacity_exceeded', 'voice_circuit_saturated'],
      losing: ['voice_data_breach_imminent', 'voice_firewall_crumbling', 'voice_core_exposed'],
      win_wave: ['voice_wave_complete', 'voice_vector_cleared', 'voice_stabilizing_link'],
      build: ['voice_tower_online', 'voice_sentry_synced', 'voice_protocol_active'],
      ultimate: ['voice_system_overload_activated', 'voice_safety_limiters_off', 'voice_overclocking']
    };

    const options = voiceLines[context] || [];
    if (options.length > 0) {
      const randomLine = options[Math.floor(Math.random() * options.length)];
      const buffer = this.buffers.get(randomLine);
      if (buffer) {
        this.play(randomLine);
      }
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

  /**
   * Set brownout state - applies low-pass filter to all audio
   */
  setBrownout(enabled: boolean): void {
    this.isBrownout = enabled;
    if (this.brownoutFilter && this.audioContext) {
      // Smooth transition to avoid clicking
      this.brownoutFilter.frequency.setTargetAtTime(
        enabled ? 800 : 20000, // 800Hz when brownout, 20kHz normal
        this.audioContext.currentTime,
        0.5 // 0.5s transition
      );
    }
  }

  /**
   * Get current brownout state
   */
  isBrownoutActive(): boolean {
    return this.isBrownout;
  }
}

// Global audio manager instance
export const audioManager = new AudioManager();
