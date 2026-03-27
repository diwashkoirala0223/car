/**
 * DriveSense AI — Core AI Engine
 * Multi-factor fatigue detection and prediction model
 */
class AIEngine {
  constructor() {
    this.state = this.createInitialState();
    this.history = [];
    this.predictions = [];
  }

  createInitialState() {
    return {
      fatigue: 0,
      attention: 1,
      perclos: 0,
      blinkRate: 15,
      headYaw: 0,
      headPitch: 0,
      yawnCount: 0,
      yawnWindow: [],       // timestamps of recent yawns
      eyeOpenness: 1,       // 0 = closed, 1 = open
      gazeX: 0,             // -1 to 1 (left to right)
      gazeY: 0,             // -1 to 1 (down to up)
      mouthOpenness: 0,     // 0 = closed, 1 = open
      microsleepDetected: false,
      microsleepDuration: 0,
      components: {
        perclosScore: 1,
        blinkScore: 1,
        headScore: 1,
        yawnScore: 1,
        contextScore: 1
      }
    };
  }

  /**
   * Process a single frame of driver data and return updated state
   * @param {Object} rawData - Raw sensor/sim data for this frame
   * @param {number} elapsed - Total elapsed seconds
   * @param {Object} scenario - Current scenario config
   * @returns {Object} Updated driver state
   */
  process(rawData, elapsed, scenario) {
    const s = this.state;

    // ── Update raw values with smoothing ──
    s.eyeOpenness = Utils.ema(rawData.eyeOpenness, s.eyeOpenness, CONFIG.AI.EMA_ALPHA);
    s.blinkRate = Utils.ema(rawData.blinkRate, s.blinkRate, CONFIG.AI.EMA_ALPHA * 0.5);
    s.headYaw = Utils.ema(rawData.headYaw, s.headYaw, CONFIG.AI.EMA_ALPHA);
    s.headPitch = Utils.ema(rawData.headPitch, s.headPitch, CONFIG.AI.EMA_ALPHA);
    s.mouthOpenness = Utils.ema(rawData.mouthOpenness, s.mouthOpenness, CONFIG.AI.EMA_ALPHA);
    s.gazeX = Utils.ema(rawData.gazeX, s.gazeX, CONFIG.AI.EMA_ALPHA);
    s.gazeY = Utils.ema(rawData.gazeY, s.gazeY, CONFIG.AI.EMA_ALPHA);

    // ── PERCLOS calculation ──
    s.perclos = this.calculatePERCLOS(s.eyeOpenness);
    s.components.perclosScore = Utils.clamp(1 - (s.perclos / CONFIG.AI.PERCLOS_DANGER), 0, 1);

    // ── Blink rate anomaly ──
    const blinkDeviation = Math.abs(s.blinkRate - CONFIG.AI.BLINK_NORMAL) / CONFIG.AI.BLINK_NORMAL;
    s.components.blinkScore = Utils.clamp(1 - blinkDeviation, 0, 1);

    // ── Head pose stability ──
    const yawScore = Utils.clamp(1 - Math.abs(s.headYaw) / CONFIG.AI.HEAD_YAW_LIMIT, 0, 1);
    const pitchScore = Utils.clamp(1 - Math.abs(s.headPitch) / CONFIG.AI.HEAD_PITCH_LIMIT, 0, 1);
    s.components.headScore = (yawScore + pitchScore) / 2;

    // ── Yawn detection ──
    if (rawData.isYawning) {
      const now = elapsed;
      s.yawnWindow.push(now);
      s.yawnWindow = s.yawnWindow.filter(t => now - t < 300); // 5-min window
      s.yawnCount = s.yawnWindow.length;
    }
    s.components.yawnScore = Utils.clamp(1 - (s.yawnCount / (CONFIG.AI.YAWN_THRESHOLD * 2)), 0, 1);

    // ── Contextual factors ──
    const timeOfDay = (scenario.timeOfDay + elapsed / 3600) % 24;
    const circadian = Utils.circadianFactor(timeOfDay);
    const tripDurationFactor = Utils.clamp(1 - (elapsed / 14400), 0.2, 1); // degrades over 4 hrs
    s.components.contextScore = (circadian + tripDurationFactor) / 2;

    // ── Microsleep detection ──
    if (s.eyeOpenness < 0.2) {
      s.microsleepDuration += 1 / CONFIG.SIM.TICK_RATE;
      if (s.microsleepDuration > 0.5) {
        s.microsleepDetected = true;
      }
    } else {
      s.microsleepDuration = Math.max(0, s.microsleepDuration - 0.05);
      if (s.microsleepDuration < 0.1) {
        s.microsleepDetected = false;
      }
    }

    // ── Weighted fusion ──
    const rawFatigue = 1 - (
      s.components.perclosScore * CONFIG.AI.PERCLOS_WEIGHT +
      s.components.blinkScore * CONFIG.AI.BLINK_RATE_WEIGHT +
      s.components.headScore * CONFIG.AI.HEAD_POSE_WEIGHT +
      s.components.yawnScore * CONFIG.AI.YAWN_WEIGHT +
      s.components.contextScore * CONFIG.AI.CONTEXT_WEIGHT
    );

    s.fatigue = Utils.ema(rawFatigue, s.fatigue, CONFIG.AI.EMA_ALPHA);
    s.fatigue = Utils.clamp(s.fatigue, 0, 1);

    // Attention is inverse of fatigue + gaze focus
    const gazeFocus = Utils.clamp(1 - (Math.abs(s.gazeX) + Math.abs(s.gazeY)) / 2, 0, 1);
    s.attention = Utils.clamp((1 - s.fatigue * 0.7) * gazeFocus, 0, 1);

    // ── Record history ──
    this.history.push({
      time: elapsed,
      fatigue: s.fatigue,
      attention: s.attention,
      score: s.components
    });

    // Keep history bounded
    if (this.history.length > CONFIG.AI.HISTORY_LENGTH) {
      this.history.shift();
    }

    // ── Generate prediction ──
    this.predictions = this.predictFatigue(elapsed);

    return { ...s };
  }

  /**
   * PERCLOS: Percentage of time eyes are >80% closed over rolling 60-second window
   */
  calculatePERCLOS(currentOpenness) {
    // Use history to calculate
    const windowSize = 60; // seconds
    const recent = this.history.filter(
      h => h.time > (this.history[this.history.length - 1]?.time || 0) - windowSize
    );
    if (recent.length < 10) return 0;

    // Count frames where eyes were mostly closed
    // We approximate: if fatigue-related eye closure patterns exist in data
    const closedFrames = recent.filter(() => currentOpenness < 0.3).length;
    return closedFrames / recent.length;
  }

  /**
   * Predict fatigue level over the next N seconds using linear regression on recent trend
   */
  predictFatigue(currentTime) {
    const points = [];
    const lookback = Math.min(this.history.length, 60); // Use last 60 data points

    if (lookback < 10) {
      return [{ time: currentTime + 600, fatigue: this.state.fatigue }];
    }

    // Extract recent trend
    const recentHistory = this.history.slice(-lookback);
    
    // Simple linear regression
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = recentHistory.length;
    
    for (let i = 0; i < n; i++) {
      const x = recentHistory[i].time;
      const y = recentHistory[i].fatigue;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate prediction points
    const step = 60; // every 60 seconds
    const steps = CONFIG.AI.PREDICTION_WINDOW / step;
    
    for (let i = 1; i <= steps; i++) {
      const futureTime = currentTime + i * step;
      const predicted = Utils.clamp(slope * futureTime + intercept, 0, 1);
      points.push({ time: futureTime, fatigue: predicted });
    }

    return points;
  }

  /**
   * Get the predicted time until a fatigue threshold is reached
   */
  getTimeToThreshold(threshold) {
    const current = this.state.fatigue;
    if (current >= threshold) return 0;

    for (const p of this.predictions) {
      if (p.fatigue >= threshold) {
        const now = this.history[this.history.length - 1]?.time || 0;
        return Math.max(0, p.time - now);
      }
    }

    return -1; // Won't reach threshold in prediction window
  }

  reset() {
    this.state = this.createInitialState();
    this.history = [];
    this.predictions = [];
  }
}
