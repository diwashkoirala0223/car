/**
 * DriveSense AI — Main Application Controller
 * Orchestrates all modules and manages the UI lifecycle
 */
class App {
  constructor() {
    this.sim = new Simulation();
    this.ai = new AIEngine();
    this.scoring = new ScoringEngine();
    this.alerts = new AlertManager();
    this.charts = new ChartManager();
    this.vision = new VisionEngine();

    this.running = false;
    this.lastTime = 0;
    this.chartUpdateCounter = 0;
    this.faceCanvas = null;
    this.faceCtx = null;
    this.currentScenario = 'night-highway';

    // Throttle chart updates (every N frames)
    this.CHART_UPDATE_INTERVAL = 30; // ~every 0.5s at 60fps
  }

  /**
   * Boot the application
   */
  init() {
    this.bindEvents();
    this.setupAlertCallbacks();
    this.initFaceCanvas();
    this.charts.init();
    this.populateScenarioSelector();
    this.loadScenario(this.currentScenario);
    this.start();
  }

  /**
   * Bind all UI event handlers
   */
  bindEvents() {
    // Scenario selector
    const selector = document.getElementById('scenario-select');
    if (selector) {
      selector.addEventListener('change', (e) => {
        this.loadScenario(e.target.value);
      });
    }

    // Play/Pause
    const playPauseBtn = document.getElementById('btn-play-pause');
    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        const paused = this.sim.togglePause();
        playPauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
        playPauseBtn.classList.toggle('active', paused);
      });
    }

    // Reset
    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetSimulation());
    }

    // Speed controls
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.sim.setSpeed(parseFloat(btn.dataset.speed));
      });
    });

    // Critical overlay dismiss
    const dismissBtn = document.getElementById('critical-dismiss');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        this.alerts.dismissCritical();
        document.getElementById('critical-overlay').classList.remove('active');
      });
    }

    // Camera Toggle
    const cameraBtn = document.getElementById('btn-camera');
    if (cameraBtn) {
      cameraBtn.addEventListener('click', () => {
        if (this.vision.isActive) {
          this.vision.stop();
          cameraBtn.textContent = '📷 Start Camera';
          cameraBtn.classList.remove('active');
          document.getElementById('webcam-video').style.display = 'none';
        } else {
          cameraBtn.textContent = '📷 Starting...';
          this.vision.onStatus = (status, msg) => {
            const loadingEl = document.getElementById('camera-loading');
            if (status === 'loading') {
              if (loadingEl) loadingEl.style.display = 'block';
            } else if (status === 'active') {
              if (loadingEl) loadingEl.style.display = 'none';
              cameraBtn.textContent = '📷 Stop Camera';
              cameraBtn.classList.add('active');
              const vid = document.getElementById('webcam-video');
              vid.style.display = 'block';
              vid.style.width = '100px';
              vid.style.position = 'absolute';
              vid.style.bottom = '10px';
              vid.style.right = '10px';
              vid.style.borderRadius = '8px';
              vid.style.border = '1px solid var(--border)';
              vid.style.zIndex = '10';
            } else if (status === 'error') {
              if (loadingEl) loadingEl.style.display = 'none';
              cameraBtn.textContent = '❌ Camera Error';
              alert('Camera Error: ' + msg);
            }
          };
          this.vision.init('webcam-video');
        }
      });
    }
  }

  /**
   * Setup alert callbacks for UI updates
   */
  setupAlertCallbacks() {
    this.alerts.onAlert = (alert) => {
      this.addAlertToFeed(alert);
      this.showToast(alert);
    };

    this.alerts.onCritical = (alert) => {
      const overlay = document.getElementById('critical-overlay');
      if (overlay) overlay.classList.add('active');
    };
  }

  /**
   * Populate the scenario dropdown
   */
  populateScenarioSelector() {
    const selector = document.getElementById('scenario-select');
    if (!selector) return;

    selector.innerHTML = '';
    for (const [key, sc] of Object.entries(CONFIG.SCENARIOS)) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = `${sc.icon} ${sc.name}`;
      selector.appendChild(option);
    }
  }

  /**
   * Load a driving scenario
   */
  loadScenario(key) {
    this.currentScenario = key;
    const sc = this.sim.loadScenario(key);
    this.ai.reset();
    this.scoring.reset();
    this.alerts.reset();
    this.charts.destroy();
    this.charts = new ChartManager();
    this.charts.init();
    this.clearAlertFeed();

    // Update scenario info
    const infoEl = document.getElementById('scenario-info');
    if (infoEl) {
      infoEl.innerHTML = `<strong>${sc.icon} ${sc.name}:</strong> ${sc.description}`;
    }

    // Reset UI
    this.updateScoreDisplay(100, CONFIG.SCORING.GRADES[0]);
    document.getElementById('critical-overlay')?.classList.remove('active');

    // Set selector
    const selector = document.getElementById('scenario-select');
    if (selector) selector.value = key;
  }

  /**
   * Reset the current simulation
   */
  resetSimulation() {
    this.loadScenario(this.currentScenario);
    const playPauseBtn = document.getElementById('btn-play-pause');
    if (playPauseBtn) {
      playPauseBtn.textContent = '⏸ Pause';
      playPauseBtn.classList.remove('active');
    }
  }

  /**
   * Initialize the driver face canvas
   */
  initFaceCanvas() {
    this.faceCanvas = document.getElementById('face-canvas');
    if (!this.faceCanvas) return;

    const size = CONFIG.UI.FACE_CANVAS_SIZE;
    this.faceCanvas.width = size * window.devicePixelRatio;
    this.faceCanvas.height = size * window.devicePixelRatio;
    this.faceCtx = this.faceCanvas.getContext('2d');
    this.faceCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  /**
   * Start the main loop
   */
  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * Main game loop
   */
  loop(timestamp) {
    if (!this.running) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1); // cap dt
    this.lastTime = timestamp;

    // ── Simulation tick ──
    const rawData = this.sim.tick(dt);

    if (rawData) {
      // If camera is active, override simulated bio-metrics
      if (this.vision && this.vision.isActive) {
        Object.assign(rawData, this.vision.lastData);
      }

      // ── AI processing ──
      const aiState = this.ai.process(rawData, this.sim.elapsed, this.sim.scenario);

      // ── Safety scoring ──
      const scoreResult = this.scoring.update(aiState, this.sim.elapsed, this.sim.scenario);

      // ── Alert evaluation ──
      this.alerts.evaluate(aiState, this.sim.elapsed);

      // ── UI updates (every frame) ──
      this.renderFace(aiState, rawData);
      this.updateMetrics(aiState, rawData);
      this.updateScoreDisplay(scoreResult.score, scoreResult.grade);
      this.updateTripStats(rawData);
      this.updatePrediction(aiState);
      this.updateStatusDot(aiState.fatigue);

      // ── Chart updates (throttled) ──
      this.chartUpdateCounter++;
      if (this.chartUpdateCounter >= this.CHART_UPDATE_INTERVAL) {
        this.chartUpdateCounter = 0;
        this.charts.updateFatigueChart(
          this.sim.elapsed,
          aiState.fatigue,
          aiState.attention,
          this.ai.predictions
        );
        this.charts.updateHeatmap(aiState.gazeX, aiState.gazeY);
      }

      // ── Gauge render (every frame for smooth animation) ──
      this.charts.renderGauge(scoreResult.score, scoreResult.grade);
    }

    // ── Clock update ──
    this.updateClock();

    requestAnimationFrame((t) => this.loop(t));
  }

  /**
   * Render the driver face visualization
   */
  renderFace(aiState, rawData) {
    if (!this.faceCtx) return;
    const ctx = this.faceCtx;
    const size = CONFIG.UI.FACE_CANVAS_SIZE;
    const cx = size / 2;
    const cy = size / 2;

    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = '#0c1220';
    ctx.fillRect(0, 0, size, size);

    // Face rotation based on head pose
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(aiState.headYaw * Math.PI / 180 * 0.3);
    ctx.translate(-cx, -cy);

    // Translate for pitch
    const pitchOffset = aiState.headPitch * 0.5;

    // ── Face outline ──
    const faceColor = aiState.fatigue > 0.6 ? 
      Utils.lerpColor('#6366f1', '#ef5350', (aiState.fatigue - 0.6) / 0.4) :
      '#6366f1';
    
    ctx.beginPath();
    ctx.ellipse(cx, cy + pitchOffset, 75, 95, 0, 0, Math.PI * 2);
    ctx.strokeStyle = faceColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Subtle face fill
    ctx.fillStyle = 'rgba(99, 102, 241, 0.04)';
    ctx.fill();

    // ── Eyes ──
    const eyeY = cy - 15 + pitchOffset;
    const leftEyeX = cx - 28;
    const rightEyeX = cx + 28;
    const eyeWidth = 20;
    const eyeHeight = 10 * aiState.eyeOpenness;
    const gazeOffsetX = aiState.gazeX * 4;
    const gazeOffsetY = -aiState.gazeY * 3;

    // Eye outlines
    [leftEyeX, rightEyeX].forEach(ex => {
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeWidth, Math.max(1, eyeHeight), 0, 0, Math.PI * 2);
      ctx.strokeStyle = faceColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Iris
      if (aiState.eyeOpenness > 0.15) {
        const irisRadius = Math.min(5, eyeHeight * 0.7);
        ctx.beginPath();
        ctx.arc(ex + gazeOffsetX, eyeY + gazeOffsetY, irisRadius, 0, Math.PI * 2);
        ctx.fillStyle = faceColor;
        ctx.fill();

        // Pupil
        ctx.beginPath();
        ctx.arc(ex + gazeOffsetX, eyeY + gazeOffsetY, irisRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#0c1220';
        ctx.fill();
      }

      // Eyelid (closes from top)
      if (aiState.eyeOpenness < 0.8) {
        const lidY = eyeY - eyeHeight;
        const lidHeight = (1 - aiState.eyeOpenness) * eyeHeight * 2;
        ctx.fillStyle = '#0c1220';
        ctx.fillRect(ex - eyeWidth - 2, lidY - 2, eyeWidth * 2 + 4, lidHeight);
      }
    });

    // ── Eyebrows ──
    const browY = eyeY - 18 + (aiState.fatigue > 0.5 ? 3 : 0); // droop when tired
    [leftEyeX, rightEyeX].forEach((ex, i) => {
      ctx.beginPath();
      const startX = ex - 18;
      const endX = ex + 18;
      const arcHeight = i === 0 ? -4 : -4;
      ctx.moveTo(startX, browY);
      ctx.quadraticCurveTo(ex, browY + arcHeight, endX, browY);
      ctx.strokeStyle = faceColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // ── Nose ──
    ctx.beginPath();
    ctx.moveTo(cx, cy + pitchOffset);
    ctx.lineTo(cx - 5, cy + 15 + pitchOffset);
    ctx.lineTo(cx + 5, cy + 15 + pitchOffset);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // ── Mouth ──
    const mouthY = cy + 35 + pitchOffset;
    const mouthOpenness = aiState.mouthOpenness;
    
    if (mouthOpenness > 0.3) {
      // Yawning — open mouth
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, 15, mouthOpenness * 15, 0, 0, Math.PI * 2);
      ctx.strokeStyle = faceColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(239, 83, 80, 0.15)';
      ctx.fill();
    } else {
      // Normal mouth
      ctx.beginPath();
      const smileAmount = (1 - aiState.fatigue) * 3;
      ctx.moveTo(cx - 15, mouthY);
      ctx.quadraticCurveTo(cx, mouthY + smileAmount, cx + 15, mouthY);
      ctx.strokeStyle = faceColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();

    // ── Status indicators ──
    // PERCLOS indicator
    this.drawFaceIndicator(ctx, 12, 20, 'PERCLOS', 
      (aiState.perclos * 100).toFixed(1) + '%',
      aiState.perclos > CONFIG.AI.PERCLOS_DANGER ? '#ef5350' : '#00e676');

    // Fatigue level
    this.drawFaceIndicator(ctx, 12, 45, 'Fatigue', 
      (aiState.fatigue * 100).toFixed(0) + '%',
      aiState.fatigue > 0.6 ? '#ef5350' : aiState.fatigue > 0.3 ? '#ffa726' : '#00e676');

    // Gaze direction indicator
    const gazeStr = `${aiState.gazeX > 0.2 ? '→' : aiState.gazeX < -0.2 ? '←' : '·'} ${aiState.gazeY > 0.2 ? '↑' : aiState.gazeY < -0.2 ? '↓' : '·'}`;
    this.drawFaceIndicator(ctx, size - 55, 20, 'Gaze', gazeStr, '#6366f1');

    // Blink rate
    this.drawFaceIndicator(ctx, size - 55, 45, 'Blinks', 
      Math.round(aiState.blinkRate) + '/m',
      '#818cf8');

    // Microsleep warning
    if (aiState.microsleepDetected) {
      ctx.fillStyle = '#ef5350';
      ctx.font = "bold 11px 'Inter'";
      ctx.textAlign = 'center';
      ctx.fillText('⚠ MICROSLEEP', cx, size - 15);
    }

    // Border glow based on fatigue
    const borderColor = aiState.fatigue > 0.8 ? 'rgba(239, 83, 80, 0.5)' :
                        aiState.fatigue > 0.5 ? 'rgba(255, 167, 38, 0.3)' :
                        'rgba(99, 102, 241, 0.15)';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);
  }

  /**
   * Draw a small indicator label on the face canvas
   */
  drawFaceIndicator(ctx, x, y, label, value, color) {
    ctx.font = "500 8px 'Inter'";
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.textAlign = 'left';
    ctx.fillText(label.toUpperCase(), x, y);
    
    ctx.font = "600 11px 'JetBrains Mono'";
    ctx.fillStyle = color;
    ctx.fillText(value, x, y + 13);
  }

  /**
   * Update the metric panels beside the face
   */
  updateMetrics(aiState, rawData) {
    this.setMetricValue('metric-perclos', (aiState.perclos * 100).toFixed(1) + '%', aiState.perclos);
    this.setMetricValue('metric-blinks', Math.round(aiState.blinkRate) + '/min', 
      Math.abs(aiState.blinkRate - 15) / 15);
    this.setMetricValue('metric-head', Math.abs(aiState.headYaw).toFixed(0) + '°', 
      Math.abs(aiState.headYaw) / CONFIG.AI.HEAD_YAW_LIMIT);
    this.setMetricValue('metric-yawns', aiState.yawnCount.toString(), 
      aiState.yawnCount / (CONFIG.AI.YAWN_THRESHOLD * 2));
    this.setMetricValue('metric-speed', Math.round(rawData.speed) + ' km/h', 0);
    this.setMetricValue('metric-lane', rawData.laneDrift.toFixed(2) + 'm', 
      Math.abs(rawData.laneDrift) / 1.5);
  }

  setMetricValue(id, text, severity) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'metric__value';
    if (severity > 0.6) el.classList.add('danger');
    else if (severity > 0.3) el.classList.add('warning');
    else el.classList.add('safe');
  }

  /**
   * Update the safety score display
   */
  updateScoreDisplay(score, grade) {
    const numberEl = document.getElementById('score-number');
    const letterEl = document.getElementById('score-letter');
    const badgeEl = document.getElementById('state-badge');

    if (numberEl) {
      numberEl.textContent = Math.round(score);
      numberEl.style.color = grade.color;
    }
    if (letterEl) {
      letterEl.textContent = `Grade: ${grade.letter} — ${grade.label}`;
      letterEl.style.color = grade.color;
    }
    if (badgeEl) {
      badgeEl.textContent = grade.label;
      badgeEl.className = 'card__badge';
      if (score >= 75) badgeEl.classList.add('safe');
      else if (score >= 40) badgeEl.classList.add('warning');
      else badgeEl.classList.add('danger');
    }

    // Update component breakdown
    if (this.ai.state.components) {
      const breakdown = this.scoring.getComponentBreakdown(this.ai.state);
      breakdown.forEach((comp, i) => {
        const barEl = document.getElementById(`comp-bar-${i}`);
        const valEl = document.getElementById(`comp-val-${i}`);
        if (barEl) {
          barEl.style.width = (comp.value * 100) + '%';
          barEl.style.backgroundColor = comp.color;
        }
        if (valEl) {
          valEl.textContent = (comp.value * 100).toFixed(0) + '%';
          valEl.style.color = comp.color;
        }
      });
    }
  }

  /**
   * Update the fatigue prediction panel
   */
  updatePrediction(aiState) {
    const iconEl = document.getElementById('prediction-icon');
    const titleEl = document.getElementById('prediction-title');
    const descEl = document.getElementById('prediction-desc');
    const etaEl = document.getElementById('prediction-eta');
    const etaLabelEl = document.getElementById('prediction-eta-label');

    const timeToWarning = this.ai.getTimeToThreshold(CONFIG.ALERTS.FATIGUE_THRESHOLDS.WARNING);
    const timeToCritical = this.ai.getTimeToThreshold(CONFIG.ALERTS.FATIGUE_THRESHOLDS.CRITICAL);

    if (aiState.fatigue >= CONFIG.ALERTS.FATIGUE_THRESHOLDS.CRITICAL) {
      if (iconEl) { iconEl.textContent = '🚨'; iconEl.className = 'prediction__icon danger'; }
      if (titleEl) titleEl.textContent = 'Immediate Risk';
      if (descEl) descEl.textContent = 'Pull over now. Fatigue is at critical levels.';
      if (etaEl) etaEl.textContent = 'NOW';
      if (etaLabelEl) etaLabelEl.textContent = 'action needed';
    } else if (aiState.fatigue >= CONFIG.ALERTS.FATIGUE_THRESHOLDS.WARNING) {
      if (iconEl) { iconEl.textContent = '⚠️'; iconEl.className = 'prediction__icon warning'; }
      if (titleEl) titleEl.textContent = 'Break Recommended';
      if (descEl) descEl.textContent = 'Drowsiness increasing. Find a rest stop.';
      if (etaEl) etaEl.textContent = timeToCritical > 0 ? Utils.formatTimeShort(timeToCritical) : '—';
      if (etaLabelEl) etaLabelEl.textContent = 'to critical';
    } else if (timeToWarning > 0) {
      if (iconEl) { iconEl.textContent = '🛡️'; iconEl.className = 'prediction__icon safe'; }
      if (titleEl) titleEl.textContent = 'Fatigue Forecast';
      if (descEl) descEl.textContent = 'Monitoring trend. Break suggested before warning level.';
      if (etaEl) etaEl.textContent = Utils.formatTimeShort(timeToWarning);
      if (etaLabelEl) etaLabelEl.textContent = 'est. to warning';
    } else {
      if (iconEl) { iconEl.textContent = '✅'; iconEl.className = 'prediction__icon safe'; }
      if (titleEl) titleEl.textContent = 'Looking Good';
      if (descEl) descEl.textContent = 'No concerning fatigue trend detected.';
      if (etaEl) etaEl.textContent = '—';
      if (etaLabelEl) etaLabelEl.textContent = '';
    }
  }

  /**
   * Update the header status dot
   */
  updateStatusDot(fatigue) {
    const dot = document.getElementById('status-dot');
    if (!dot) return;
    dot.className = 'status-dot';
    if (fatigue >= 0.8) dot.classList.add('danger');
    else if (fatigue >= 0.5) dot.classList.add('warning');
  }

  /**
   * Update trip stats bar
   */
  updateTripStats(rawData) {
    const elapsedEl = document.getElementById('trip-elapsed');
    const distEl = document.getElementById('trip-distance');
    const speedEl = document.getElementById('trip-speed');
    const avgScoreEl = document.getElementById('trip-avg-score');

    if (elapsedEl) elapsedEl.textContent = this.sim.getElapsedFormatted();
    if (distEl) distEl.textContent = this.sim.totalDistance.toFixed(1) + ' km';
    if (speedEl) speedEl.textContent = Math.round(rawData.speed) + ' km/h';
    if (avgScoreEl) avgScoreEl.textContent = Math.round(this.scoring.sessionAvg);

    // Session stats sidebar
    const sessAvg = document.getElementById('session-avg');
    const sessMin = document.getElementById('session-min');
    const sessWarn = document.getElementById('session-warnings');
    const sessCrit = document.getElementById('session-critical');
    const counts = this.alerts.getAlertCounts();

    if (sessAvg) {
      sessAvg.textContent = Math.round(this.scoring.sessionAvg);
      sessAvg.style.color = this.scoring.sessionAvg >= 75 ? 'var(--success)' : this.scoring.sessionAvg >= 40 ? 'var(--warning)' : 'var(--danger)';
    }
    if (sessMin) {
      sessMin.textContent = Math.round(this.scoring.sessionMin);
      sessMin.style.color = this.scoring.sessionMin >= 75 ? 'var(--success)' : this.scoring.sessionMin >= 40 ? 'var(--warning)' : 'var(--danger)';
    }
    if (sessWarn) sessWarn.textContent = counts.warning;
    if (sessCrit) sessCrit.textContent = counts.critical;
  }

  /**
   * Update header clock
   */
  updateClock() {
    const clockEl = document.getElementById('header-clock');
    if (!clockEl || !this.sim.scenario) return;
    const timeOfDay = (this.sim.scenario.timeOfDay + this.sim.elapsed / 3600) % 24;
    clockEl.textContent = Utils.formatClockTime(timeOfDay);
  }

  /**
   * Add an alert to the feed
   */
  addAlertToFeed(alert) {
    const feed = document.getElementById('alert-feed');
    if (!feed) return;

    // Remove empty state if present
    const emptyState = feed.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const item = document.createElement('div');
    item.className = `alert-item ${alert.level === 3 ? 'critical' : alert.level === 2 ? 'warning' : 'info'}`;
    item.innerHTML = `
      <span class="alert-item__icon">${alert.icon}</span>
      <div class="alert-item__content">
        <div class="alert-item__message">${alert.message}</div>
        <div class="alert-item__time">${alert.timeFormatted}</div>
      </div>
    `;

    feed.insertBefore(item, feed.firstChild);

    // Limit feed size
    while (feed.children.length > 30) {
      feed.removeChild(feed.lastChild);
    }

    // Update alert counts
    const counts = this.alerts.getAlertCounts();
    const countEl = document.getElementById('alert-count');
    if (countEl) countEl.textContent = counts.total;
  }

  /**
   * Show a toast notification
   */
  showToast(alert) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${alert.level === 3 ? 'critical' : alert.level === 2 ? 'warning' : 'info'}`;
    toast.innerHTML = `<span>${alert.icon}</span><span>${alert.message}</span>`;
    
    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  /**
   * Clear the alert feed
   */
  clearAlertFeed() {
    const feed = document.getElementById('alert-feed');
    if (!feed) return;
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">🛡️</div>
        <div class="empty-state__text">No alerts yet. Monitoring...</div>
      </div>
    `;
    const countEl = document.getElementById('alert-count');
    if (countEl) countEl.textContent = '0';
  }
}

// ── Boot ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();

  // Expose for debugging
  window.driveSense = app;
});
