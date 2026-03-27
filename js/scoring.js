/**
 * DriveSense AI — Safety Scoring Engine
 * Computes composite safety score with grading and trend analysis
 */
class ScoringEngine {
  constructor() {
    this.score = 100;
    this.grade = CONFIG.SCORING.GRADES[0];
    this.history = [];
    this.sessionAvg = 100;
    this.sessionMin = 100;
    this.sessionMax = 100;
    this.trendDirection = 'stable'; // 'improving', 'declining', 'stable'
  }

  /**
   * Update score based on current AI state
   * @param {Object} aiState - Current driver state from AI engine
   * @param {number} elapsed - Elapsed seconds
   * @param {Object} scenario - Active scenario
   * @returns {Object} Score result
   */
  update(aiState, elapsed, scenario) {
    const components = aiState.components;

    // ── Base score from AI component scores (0–100) ──
    let baseScore = (
      components.perclosScore * CONFIG.AI.PERCLOS_WEIGHT +
      components.blinkScore * CONFIG.AI.BLINK_RATE_WEIGHT +
      components.headScore * CONFIG.AI.HEAD_POSE_WEIGHT +
      components.yawnScore * CONFIG.AI.YAWN_WEIGHT +
      components.contextScore * CONFIG.AI.CONTEXT_WEIGHT
    ) * 100;

    // ── Trip duration penalty ──
    if (elapsed > CONFIG.SCORING.TIME_PENALTY_START) {
      const minutesOver = (elapsed - CONFIG.SCORING.TIME_PENALTY_START) / 60;
      baseScore -= minutesOver * CONFIG.SCORING.TIME_PENALTY_RATE;
    }

    // ── Night driving penalty ──
    const currentHour = Math.floor((scenario.timeOfDay + elapsed / 3600) % 24);
    if (CONFIG.SCORING.NIGHT_HOURS.includes(currentHour)) {
      baseScore -= CONFIG.SCORING.NIGHT_PENALTY;
    }

    // ── Microsleep penalty ──
    if (aiState.microsleepDetected) {
      baseScore -= 20;
    }

    // ── Smooth & clamp ──
    const targetScore = Utils.clamp(baseScore, 0, 100);
    this.score = Utils.ema(targetScore, this.score, 0.1);
    this.score = Utils.clamp(this.score, 0, 100);

    // ── Determine grade ──
    this.grade = CONFIG.SCORING.GRADES.find(g => this.score >= g.min) || 
                 CONFIG.SCORING.GRADES[CONFIG.SCORING.GRADES.length - 1];

    // ── Track session stats ──
    this.history.push({ time: elapsed, score: this.score });
    if (this.history.length > 600) this.history.shift();

    this.sessionMin = Math.min(this.sessionMin, this.score);
    this.sessionMax = Math.max(this.sessionMax, this.score);
    
    const sum = this.history.reduce((acc, h) => acc + h.score, 0);
    this.sessionAvg = sum / this.history.length;

    // ── Trend analysis ──
    this.trendDirection = this.analyzeTrend();

    return {
      score: Math.round(this.score),
      grade: this.grade,
      trendDirection: this.trendDirection,
      sessionAvg: Math.round(this.sessionAvg),
      sessionMin: Math.round(this.sessionMin),
      sessionMax: Math.round(this.sessionMax)
    };
  }

  /**
   * Analyze the score trend over the last 30 data points
   */
  analyzeTrend() {
    const len = this.history.length;
    if (len < 20) return 'stable';

    const recent = this.history.slice(-20);
    const firstHalf = recent.slice(0, 10);
    const secondHalf = recent.slice(10);

    const avgFirst = firstHalf.reduce((a, h) => a + h.score, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, h) => a + h.score, 0) / secondHalf.length;

    const diff = avgSecond - avgFirst;
    if (diff > 3) return 'improving';
    if (diff < -3) return 'declining';
    return 'stable';
  }

  /**
   * Get individual component scores formatted for display
   */
  getComponentBreakdown(aiState) {
    const c = aiState.components;
    return [
      { label: 'Eye Closure (PERCLOS)', value: c.perclosScore, color: this.componentColor(c.perclosScore) },
      { label: 'Blink Pattern', value: c.blinkScore, color: this.componentColor(c.blinkScore) },
      { label: 'Head Stability', value: c.headScore, color: this.componentColor(c.headScore) },
      { label: 'Yawn Frequency', value: c.yawnScore, color: this.componentColor(c.yawnScore) },
      { label: 'Context (Time/Duration)', value: c.contextScore, color: this.componentColor(c.contextScore) }
    ];
  }

  componentColor(value) {
    if (value > 0.7) return CONFIG.UI.THEME.SUCCESS;
    if (value > 0.4) return CONFIG.UI.THEME.WARNING;
    return CONFIG.UI.THEME.DANGER;
  }

  reset() {
    this.score = 100;
    this.grade = CONFIG.SCORING.GRADES[0];
    this.history = [];
    this.sessionAvg = 100;
    this.sessionMin = 100;
    this.sessionMax = 100;
    this.trendDirection = 'stable';
  }
}
