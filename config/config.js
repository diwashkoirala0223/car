/**
 * DriveSense AI — Configuration
 * All tunable constants and system parameters
 */
const CONFIG = {
  // ── Simulation ──────────────────────────────────────────
  SIM: {
    TICK_RATE: 60,              // frames per second
    BASE_SPEED_KMH: 95,        // default cruising speed
    SPEED_VARIATION: 15,       // ±km/h random variance
    UPDATE_INTERVAL: 1000 / 60 // ms per tick
  },

  // ── AI Fatigue Model Weights ────────────────────────────
  AI: {
    PERCLOS_WEIGHT: 0.30,       // eye closure dominance
    BLINK_RATE_WEIGHT: 0.20,    // blink anomaly weight
    HEAD_POSE_WEIGHT: 0.20,     // head drift weight
    YAWN_WEIGHT: 0.15,          // yawn frequency weight
    CONTEXT_WEIGHT: 0.15,       // time-of-day + trip duration

    // Thresholds
    PERCLOS_DANGER: 0.15,       // >15% = drowsy (ISO standard)
    BLINK_LOW: 8,               // blinks/min — suspicious low
    BLINK_HIGH: 25,             // blinks/min — excessive
    BLINK_NORMAL: 15,           // blinks/min — baseline
    HEAD_YAW_LIMIT: 20,         // degrees — looking away
    HEAD_PITCH_LIMIT: 15,       // degrees — head drop
    YAWN_THRESHOLD: 3,          // yawns in 5 min = warning

    // Smoothing
    EMA_ALPHA: 0.15,            // exponential moving average factor
    PREDICTION_WINDOW: 600,     // seconds (10 min lookahead)
    HISTORY_LENGTH: 360         // data points for trend analysis
  },

  // ── Safety Scoring ──────────────────────────────────────
  SCORING: {
    GRADES: [
      { min: 90, letter: 'A', label: 'Excellent', color: '#00e676' },
      { min: 75, letter: 'B', label: 'Good', color: '#76ff03' },
      { min: 60, letter: 'C', label: 'Fair', color: '#ffeb3b' },
      { min: 40, letter: 'D', label: 'Poor', color: '#ff9800' },
      { min: 0, letter: 'F', label: 'Critical', color: '#ff1744' }
    ],
    TIME_PENALTY_START: 7200,   // seconds (2 hrs) before trip-duration penalty
    TIME_PENALTY_RATE: 0.5,    // score points lost per minute after threshold
    NIGHT_HOURS: [23, 24, 0, 1, 2, 3, 4, 5], // high-risk hours
    NIGHT_PENALTY: 5            // extra penalty during night hours
  },

  // ── Alerts ──────────────────────────────────────────────
  ALERTS: {
    LEVELS: {
      INFO: { id: 1, name: 'Info', icon: 'ℹ️', color: '#42a5f5', sound: false },
      WARNING: { id: 2, name: 'Warning', icon: '⚠️', color: '#ffa726', sound: true },
      CRITICAL: { id: 3, name: 'Critical', icon: '🚨', color: '#ef5350', sound: true }
    },
    COOLDOWN_MS: {
      1: 30000,  // 30s between info alerts
      2: 15000,  // 15s between warnings
      3: 8000    // 8s between critical alerts
    },
    MAX_HISTORY: 50,
    FATIGUE_THRESHOLDS: {
      INFO: 0.40,     // fatigue > 40%
      WARNING: 0.60,  // fatigue > 60%
      CRITICAL: 0.80  // fatigue > 80%
    }
  },

  // ── Chart Colors ────────────────────────────────────────
  CHARTS: {
    FATIGUE_LINE: '#ff6b6b',
    ATTENTION_LINE: '#51cf66',
    SCORE_GRADIENT: ['#00e676', '#ffeb3b', '#ff1744'],
    GRID_COLOR: 'rgba(255, 255, 255, 0.06)',
    TEXT_COLOR: 'rgba(255, 255, 255, 0.6)',
    MAX_DATA_POINTS: 120        // rolling window size
  },

  // ── Scenarios ───────────────────────────────────────────
  SCENARIOS: {
    'night-highway': {
      name: 'Night Highway',
      icon: '🌙',
      description: 'Long stretch of highway at 11 PM. Low traffic, monotonous road.',
      baseFatigueRate: 0.0008,
      baseSpeed: 110,
      timeOfDay: 23,
      ambientLight: 0.2,
      trafficDensity: 0.1,
      roadMonotony: 0.9,
      duration: 3600
    },
    'morning-commute': {
      name: 'Morning Commute',
      icon: '🌅',
      description: 'Rush hour commute at 7:30 AM. Stop-and-go traffic.',
      baseFatigueRate: 0.0003,
      baseSpeed: 45,
      timeOfDay: 7.5,
      ambientLight: 0.7,
      trafficDensity: 0.8,
      roadMonotony: 0.3,
      duration: 2400
    },
    'post-lunch': {
      name: 'Post-Lunch Dip',
      icon: '😴',
      description: 'Afternoon drive at 2 PM. The post-meal circadian dip hits hard.',
      baseFatigueRate: 0.0006,
      baseSpeed: 80,
      timeOfDay: 14,
      ambientLight: 0.9,
      trafficDensity: 0.4,
      roadMonotony: 0.6,
      duration: 2400
    },
    'long-haul': {
      name: 'Long Haul Trucker',
      icon: '🚛',
      description: '6-hour interstate drive. Fatigue builds relentlessly.',
      baseFatigueRate: 0.0005,
      baseSpeed: 100,
      timeOfDay: 20,
      ambientLight: 0.3,
      trafficDensity: 0.2,
      roadMonotony: 0.85,
      duration: 7200
    }
  },

  // ── UI ──────────────────────────────────────────────────
  UI: {
    FACE_CANVAS_SIZE: 280,
    THEME: {
      BG_PRIMARY: '#0a0e17',
      BG_CARD: 'rgba(15, 23, 42, 0.8)',
      BORDER: 'rgba(255, 255, 255, 0.08)',
      ACCENT: '#6366f1',
      SUCCESS: '#00e676',
      WARNING: '#ffa726',
      DANGER: '#ef5350',
      TEXT_PRIMARY: '#e2e8f0',
      TEXT_SECONDARY: 'rgba(255, 255, 255, 0.5)'
    }
  }
};

// Freeze to prevent mutation
Object.freeze(CONFIG);
