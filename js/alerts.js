/**
 * DriveSense AI — Alert Management System
 * Multi-tier alerts with cooldown, sound, and history tracking
 */
class AlertManager {
  constructor() {
    this.history = [];
    this.lastAlertTime = { 1: 0, 2: 0, 3: 0 };
    this.criticalActive = false;
    this.onAlert = null;        // callback for UI
    this.onCritical = null;     // callback for critical overlay
    this.audioCtx = null;
  }

  /**
   * Evaluate the current state and trigger alerts as needed
   * @param {Object} aiState - Current AI state
   * @param {number} elapsed - Elapsed seconds
   */
  evaluate(aiState, elapsed) {
    const fatigue = aiState.fatigue;
    const thresholds = CONFIG.ALERTS.FATIGUE_THRESHOLDS;

    // ── Check for critical level ──
    if (fatigue >= thresholds.CRITICAL) {
      this.triggerAlert(3, elapsed, this.getCriticalMessage(aiState));
    } else if (fatigue >= thresholds.WARNING) {
      this.triggerAlert(2, elapsed, this.getWarningMessage(aiState));
    } else if (fatigue >= thresholds.INFO) {
      this.triggerAlert(1, elapsed, this.getInfoMessage(aiState));
    }

    // ── Microsleep is always critical ──
    if (aiState.microsleepDetected) {
      this.triggerAlert(3, elapsed, '🚨 MICROSLEEP DETECTED — Eyes closed for extended period!');
    }
  }

  /**
   * Trigger an alert if cooldown has passed
   */
  triggerAlert(level, elapsed, message) {
    const cooldown = CONFIG.ALERTS.COOLDOWN_MS[level] / 1000;
    const now = elapsed;

    if (now - this.lastAlertTime[level] < cooldown) return;

    this.lastAlertTime[level] = now;

    const levelConfig = Object.values(CONFIG.ALERTS.LEVELS).find(l => l.id === level);
    
    const alert = {
      id: Utils.uid(),
      level,
      levelName: levelConfig.name,
      icon: levelConfig.icon,
      color: levelConfig.color,
      message,
      time: elapsed,
      timeFormatted: Utils.formatTime(elapsed),
      timestamp: Date.now()
    };

    // Add to history
    this.history.unshift(alert);
    if (this.history.length > CONFIG.ALERTS.MAX_HISTORY) {
      this.history.pop();
    }

    // Sound
    if (levelConfig.sound) {
      this.playAlertSound(level);
    }

    // Callbacks
    if (this.onAlert) this.onAlert(alert);
    if (level === 3 && this.onCritical) {
      this.criticalActive = true;
      this.onCritical(alert);
    }
  }

  /**
   * Generate contextual alert messages
   */
  getInfoMessage(state) {
    const messages = [
      'Mild fatigue indicators detected. Consider taking a break soon.',
      'Eye closure rate increasing. Stay alert.',
      'Attention level slightly decreased. Stay focused on the road.',
      'Early signs of drowsiness detected. Open a window or adjust temperature.',
      'Head movement suggests reduced alertness.'
    ];
    return 'ℹ️ ' + messages[Math.floor(Math.random() * messages.length)];
  }

  getWarningMessage(state) {
    const messages = [
      '⚠️ Significant drowsiness detected! Take a break within the next 15 minutes.',
      '⚠️ Head nodding detected — you may be falling asleep!',
      '⚠️ Frequent yawning pattern detected. Find a rest stop!',
      '⚠️ Blink pattern indicates moderate drowsiness. Pull over if possible.',
      '⚠️ Extended eye closure detected. You need rest!'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  getCriticalMessage(state) {
    const messages = [
      '🚨 CRITICAL: Severe drowsiness — PULL OVER IMMEDIATELY',
      '🚨 DANGER: You are at high risk of falling asleep at the wheel!',
      '🚨 EMERGENCY: Fatigue levels critical — stop driving NOW!',
      '🚨 CRITICAL: Multiple drowsiness indicators at dangerous levels!'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  /**
   * Play an alert beep using Web Audio API
   */
  playAlertSound(level) {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }

      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (level === 2) {
        // Warning: two beeps
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else if (level === 3) {
        // Critical: urgent rapid beeps
        osc.frequency.value = 1200;
        osc.type = 'square';
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        // Pulsing pattern
        for (let i = 0; i < 4; i++) {
          gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
          gain.gain.setValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.08);
        }
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      }
    } catch (e) {
      // Audio not available — silent fallback
    }
  }

  dismissCritical() {
    this.criticalActive = false;
  }

  getRecentAlerts(count = 20) {
    return this.history.slice(0, count);
  }

  getAlertCounts() {
    return {
      info: this.history.filter(a => a.level === 1).length,
      warning: this.history.filter(a => a.level === 2).length,
      critical: this.history.filter(a => a.level === 3).length,
      total: this.history.length
    };
  }

  reset() {
    this.history = [];
    this.lastAlertTime = { 1: 0, 2: 0, 3: 0 };
    this.criticalActive = false;
  }
}
