/**
 * DriveSense AI — Utility Functions
 */
const Utils = {
  /**
   * Exponential Moving Average for signal smoothing
   */
  ema(current, previous, alpha = 0.15) {
    return alpha * current + (1 - alpha) * previous;
  },

  /**
   * Clamp a value between min and max
   */
  clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
  },

  /**
   * Generate Gaussian (normal) random number
   * Box-Muller transform
   */
  gaussianRandom(mean = 0, stdDev = 1) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z * stdDev + mean;
  },

  /**
   * Linear interpolation
   */
  lerp(a, b, t) {
    return a + (b - a) * Utils.clamp(t);
  },

  /**
   * Map a value from one range to another
   */
  mapRange(value, inMin, inMax, outMin, outMax) {
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
  },

  /**
   * Interpolate between two hex colors
   */
  lerpColor(color1, color2, t) {
    const c1 = Utils.hexToRgb(color1);
    const c2 = Utils.hexToRgb(color2);
    if (!c1 || !c2) return color1;
    const r = Math.round(Utils.lerp(c1.r, c2.r, t));
    const g = Math.round(Utils.lerp(c1.g, c2.g, t));
    const b = Math.round(Utils.lerp(c1.b, c2.b, t));
    return `rgb(${r}, ${g}, ${b})`;
  },

  /**
   * Multi-stop color gradient interpolation
   */
  gradientColor(colors, t) {
    t = Utils.clamp(t);
    if (colors.length === 1) return colors[0];
    const segment = t * (colors.length - 1);
    const index = Math.floor(segment);
    const frac = segment - index;
    if (index >= colors.length - 1) return colors[colors.length - 1];
    return Utils.lerpColor(colors[index], colors[index + 1], frac);
  },

  /**
   * Convert hex color to RGB object
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  },

  /**
   * Format seconds to HH:MM:SS
   */
  formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
  },

  /**
   * Format as MM:SS 
   */
  formatTimeShort(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  /**
   * Get current simulated clock time string
   */
  formatClockTime(hourFloat) {
    const h = Math.floor(hourFloat) % 24;
    const m = Math.floor((hourFloat % 1) * 60);
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  },

  /**
   * Smooth noise using sine combination
   */
  smoothNoise(t, frequency = 1) {
    return (
      Math.sin(t * frequency * 1.0) * 0.5 +
      Math.sin(t * frequency * 2.3 + 1.2) * 0.3 +
      Math.sin(t * frequency * 4.1 + 3.7) * 0.2
    );
  },

  /**
   * Debounce function
   */
  debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Generate a unique ID
   */
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },

  /**
   * Get fatigue level label
   */
  fatigueLabel(level) {
    if (level < 0.2) return 'Alert';
    if (level < 0.4) return 'Mild Fatigue';
    if (level < 0.6) return 'Moderate';
    if (level < 0.8) return 'Drowsy';
    return 'Severe';
  },

  /**
   * Circadian rhythm multiplier (models natural alertness cycle)
   * Peak alertness at 10 AM and 8 PM, lowest at 3 AM and 2 PM
   */
  circadianFactor(hourOfDay) {
    // Model using sine waves matching circadian rhythm
    const nightDip = Math.cos((hourOfDay - 3) * Math.PI / 12);  // deep night dip at 3 AM
    const afternoonDip = Math.cos((hourOfDay - 14) * Math.PI / 6) * 0.3; // mild dip at 2 PM
    return Utils.clamp(0.5 - nightDip * 0.4 - afternoonDip * 0.15, 0, 1);
  }
};
