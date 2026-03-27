/**
 * DriveSense AI — Driving Scenario Simulator
 * Generates realistic driver physiological data based on driving scenarios
 */
class Simulation {
  constructor() {
    this.scenario = null;
    this.elapsed = 0;
    this.speed = 1;        // simulation speed multiplier
    this.paused = false;
    this.totalDistance = 0;
    this.driverData = {};
    this.events = [];      // notable events during drive
    
    // Internal state for smooth data generation
    this._fatigueAccum = 0;
    this._blinkTimer = 0;
    this._yawnTimer = 0;
    this._microsleepTimer = 0;
    this._headDriftPhase = Math.random() * Math.PI * 2;
    this._gazePhase = Math.random() * Math.PI * 2;
    this._coffeeBreakAt = -1;
    this._coffeeEffect = 0;
  }

  /**
   * Initialize with a scenario
   */
  loadScenario(scenarioKey) {
    this.scenario = { ...CONFIG.SCENARIOS[scenarioKey] };
    this.reset();

    // Random coffee break for long scenarios
    if (this.scenario.duration > 3600) {
      this._coffeeBreakAt = 1800 + Math.random() * 1200; // between 30-50 min
    }

    return this.scenario;
  }

  reset() {
    this.elapsed = 0;
    this.totalDistance = 0;
    this._fatigueAccum = 0;
    this._blinkTimer = 0;
    this._yawnTimer = Math.random() * 120;
    this._microsleepTimer = 0;
    this._headDriftPhase = Math.random() * Math.PI * 2;
    this._gazePhase = Math.random() * Math.PI * 2;
    this._coffeeEffect = 0;
    this.events = [];
    this.driverData = {};
  }

  /**
   * Advance the simulation by one frame
   * @param {number} dt - Delta time in seconds
   * @returns {Object} Raw driver data for AI processing
   */
  tick(dt) {
    if (this.paused || !this.scenario) return null;

    const adjustedDt = dt * this.speed;
    this.elapsed += adjustedDt;

    const t = this.elapsed;
    const sc = this.scenario;

    // ── Calculate base fatigue accumulation ──
    const circadian = Utils.circadianFactor((sc.timeOfDay + t / 3600) % 24);
    const monotonyFactor = sc.roadMonotony;
    const durationFactor = Math.min(t / 7200, 1); // ramps up over 2 hours

    this._fatigueAccum += sc.baseFatigueRate * adjustedDt * (1 + monotonyFactor) * (1 + durationFactor * 0.5);

    // ── Coffee break effect ──
    if (this._coffeeBreakAt > 0 && t > this._coffeeBreakAt) {
      const coffeeAge = t - this._coffeeBreakAt;
      if (coffeeAge < 1800) { // 30 min of effect
        this._coffeeEffect = Math.max(0, 0.25 * (1 - coffeeAge / 1800));
        if (coffeeAge < 2) {
          this.events.push({ time: t, type: 'coffee', message: '☕ Coffee break — alertness boost!' });
        }
      } else {
        this._coffeeEffect = 0;
      }
    }

    const effectiveFatigue = Utils.clamp(this._fatigueAccum - this._coffeeEffect, 0, 1);

    // ── Eye behavior ──
    const baseEyeOpenness = 1 - effectiveFatigue * 0.7;
    const blinkNoise = Utils.smoothNoise(t * 0.5, 2) * 0.1;
    
    // Occasional long blinks when fatigued
    const longBlinkChance = effectiveFatigue * 0.02;
    const isLongBlink = Math.random() < longBlinkChance;
    const eyeFlutter = isLongBlink ? -0.4 : 0;

    // Microsleep events at high fatigue
    let microsleepEffect = 0;
    if (effectiveFatigue > 0.7) {
      this._microsleepTimer -= adjustedDt;
      if (this._microsleepTimer <= 0) {
        // Random microsleep duration: 0.5-3 seconds
        const msChance = (effectiveFatigue - 0.7) * 0.15;
        if (Math.random() < msChance) {
          this._microsleepTimer = 0.5 + Math.random() * 2.5;
          this.events.push({ time: t, type: 'microsleep', message: '⚠️ Microsleep detected!' });
        } else {
          this._microsleepTimer = 0.5 + Math.random() * 2;
        }
      }
      if (this._microsleepTimer > 0) {
        microsleepEffect = -0.8;
      }
    }

    const eyeOpenness = Utils.clamp(
      baseEyeOpenness + blinkNoise + eyeFlutter + microsleepEffect,
      0, 1
    );

    // ── Blink rate ── 
    // Increases with fatigue, then decreases at extreme fatigue (heavy eyelids)
    const baseBlink = CONFIG.AI.BLINK_NORMAL;
    let blinkRate;
    if (effectiveFatigue < 0.5) {
      blinkRate = baseBlink + effectiveFatigue * 12; // increases
    } else {
      blinkRate = baseBlink + 6 - (effectiveFatigue - 0.5) * 10; // starts decreasing
    }
    blinkRate += Utils.gaussianRandom(0, 2);
    blinkRate = Math.max(3, blinkRate);

    // ── Head pose ──
    this._headDriftPhase += adjustedDt * 0.3;
    const headDriftAmplitude = effectiveFatigue * 0.8;
    
    // Slow head nodding when drowsy
    const headYaw = Utils.smoothNoise(this._headDriftPhase, 0.4) * 
                    CONFIG.AI.HEAD_YAW_LIMIT * headDriftAmplitude +
                    Utils.gaussianRandom(0, 1) * effectiveFatigue;
    
    const headPitch = Utils.smoothNoise(this._headDriftPhase * 0.7 + 2, 0.3) * 
                      CONFIG.AI.HEAD_PITCH_LIMIT * headDriftAmplitude +
                      (effectiveFatigue > 0.6 ? effectiveFatigue * 5 : 0); // head dropping

    // ── Gaze direction ──
    this._gazePhase += adjustedDt * 0.2;
    const gazeWander = effectiveFatigue * 0.3;
    const gazeX = Utils.smoothNoise(this._gazePhase, 0.5) * gazeWander +
                  Utils.gaussianRandom(0, 0.05);
    const gazeY = Utils.smoothNoise(this._gazePhase * 0.6 + 1, 0.4) * gazeWander +
                  Utils.gaussianRandom(0, 0.05) -
                  (effectiveFatigue > 0.5 ? effectiveFatigue * 0.15 : 0); // eyes droop

    // ── Yawn detection ──
    this._yawnTimer -= adjustedDt;
    let isYawning = false;
    let mouthOpenness = 0.05 + Utils.gaussianRandom(0, 0.02);

    if (this._yawnTimer <= 0) {
      // Yawn frequency increases with fatigue
      const yawnInterval = Math.max(30, 180 - effectiveFatigue * 200);
      this._yawnTimer = yawnInterval + Utils.gaussianRandom(0, 20);
      
      if (effectiveFatigue > 0.25) {
        isYawning = true;
        mouthOpenness = 0.7 + Math.random() * 0.3;
      }
    }

    // ── Speed variation (correlates with fatigue) ──
    const speedVariation = effectiveFatigue * CONFIG.SIM.SPEED_VARIATION;
    const currentSpeed = sc.baseSpeed + 
                         Utils.smoothNoise(t * 0.1, 0.5) * speedVariation +
                         Utils.gaussianRandom(0, 2);
    
    this.totalDistance += (Math.abs(currentSpeed) / 3600) * adjustedDt;

    // ── Lane position (drift increases with fatigue) ──
    const laneDrift = Utils.smoothNoise(t * 0.15, 0.3) * effectiveFatigue * 1.5;
    const steeringCorrection = effectiveFatigue > 0.5 ? 
      Utils.smoothNoise(t * 2, 1) * 0.3 : 0; // jerky corrections

    // ── Package data ──
    this.driverData = {
      eyeOpenness,
      blinkRate,
      headYaw,
      headPitch,
      gazeX: Utils.clamp(gazeX, -1, 1),
      gazeY: Utils.clamp(gazeY, -1, 1),
      mouthOpenness: Utils.clamp(mouthOpenness, 0, 1),
      isYawning,
      speed: Math.max(0, currentSpeed),
      laneDrift,
      steeringCorrection,
      effectiveFatigue
    };

    return this.driverData;
  }

  setSpeed(multiplier) {
    this.speed = Utils.clamp(multiplier, 0.5, 10);
  }

  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }

  getElapsedFormatted() {
    return Utils.formatTime(this.elapsed);
  }

  getScenarioProgress() {
    if (!this.scenario) return 0;
    return Utils.clamp(this.elapsed / this.scenario.duration, 0, 1);
  }
}
