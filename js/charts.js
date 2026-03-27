/**
 * DriveSense AI — Real-time Chart Rendering
 * Uses Chart.js for fatigue timeline and safety gauge
 */
class ChartManager {
  constructor() {
    this.fatigueChart = null;
    this.gaugeCanvas = null;
    this.gaugeCtx = null;
    this.heatmapCanvas = null;
    this.heatmapCtx = null;
    this.gazeHistory = [];
  }

  /**
   * Initialize all charts
   */
  init() {
    this.initFatigueChart();
    this.initGauge();
    this.initHeatmap();
  }

  /**
   * Initialize the fatigue/attention timeline chart
   */
  initFatigueChart() {
    const ctx = document.getElementById('fatigue-chart');
    if (!ctx) return;

    this.fatigueChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Fatigue Level',
            data: [],
            borderColor: CONFIG.CHARTS.FATIGUE_LINE,
            backgroundColor: 'rgba(255, 107, 107, 0.08)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
          {
            label: 'Attention',
            data: [],
            borderColor: CONFIG.CHARTS.ATTENTION_LINE,
            backgroundColor: 'rgba(81, 207, 102, 0.05)',
            borderWidth: 2,
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderDash: [5, 3],
          },
          {
            label: 'Predicted Fatigue',
            data: [],
            borderColor: 'rgba(255, 107, 107, 0.35)',
            borderWidth: 1.5,
            fill: false,
            tension: 0.3,
            pointRadius: 0,
            borderDash: [8, 4],
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 0 },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            display: true,
            grid: { color: CONFIG.CHARTS.GRID_COLOR, drawBorder: false },
            ticks: { 
              color: CONFIG.CHARTS.TEXT_COLOR, 
              font: { family: "'JetBrains Mono'", size: 10 },
              maxTicksLimit: 8,
              maxRotation: 0
            }
          },
          y: {
            display: true,
            min: 0,
            max: 1,
            grid: { color: CONFIG.CHARTS.GRID_COLOR, drawBorder: false },
            ticks: { 
              color: CONFIG.CHARTS.TEXT_COLOR, 
              font: { family: "'JetBrains Mono'", size: 10 },
              callback: (v) => (v * 100).toFixed(0) + '%',
              stepSize: 0.25
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: CONFIG.CHARTS.TEXT_COLOR,
              font: { family: "'Inter'", size: 11 },
              usePointStyle: true,
              pointStyle: 'line',
              padding: 16,
              boxWidth: 30
            }
          },
          tooltip: {
            backgroundColor: 'rgba(12, 18, 35, 0.9)',
            titleColor: '#e2e8f0',
            bodyColor: '#e2e8f0',
            borderColor: 'rgba(99, 102, 241, 0.3)',
            borderWidth: 1,
            padding: 12,
            titleFont: { family: "'Inter'", weight: '600' },
            bodyFont: { family: "'JetBrains Mono'", size: 12 },
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${(ctx.parsed.y * 100).toFixed(1)}%`
            }
          }
        }
      }
    });
  }

  /**
   * Update the fatigue timeline with new data
   */
  updateFatigueChart(elapsed, fatigue, attention, predictions) {
    if (!this.fatigueChart) return;

    const chart = this.fatigueChart;
    const label = Utils.formatTimeShort(elapsed);

    // Add real data
    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(fatigue);
    chart.data.datasets[1].data.push(attention);

    // Rolling window
    const maxPoints = CONFIG.CHARTS.MAX_DATA_POINTS;
    if (chart.data.labels.length > maxPoints) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
      chart.data.datasets[1].data.shift();
    }

    // Update prediction line
    if (predictions && predictions.length > 0) {
      const predLabels = predictions.map(p => Utils.formatTimeShort(p.time));
      const predData = predictions.map(p => p.fatigue);
      
      // Pad prediction data to align with main data
      const paddedPredData = new Array(chart.data.labels.length - 1).fill(null);
      paddedPredData.push(fatigue); // connect from current point
      
      // Extend labels and add prediction points
      const allLabels = [...chart.data.labels, ...predLabels.slice(0, 5)];
      const allPredData = [...paddedPredData, ...predData.slice(0, 5)];

      // Pad main datasets
      const mainPad = predLabels.slice(0, 5).map(() => null);

      chart.data.labels = allLabels.slice(-maxPoints - 5);
      chart.data.datasets[0].data = [...chart.data.datasets[0].data, ...mainPad].slice(-maxPoints - 5);
      chart.data.datasets[1].data = [...chart.data.datasets[1].data, ...mainPad].slice(-maxPoints - 5);
      chart.data.datasets[2].data = allPredData.slice(-maxPoints - 5);
    }

    chart.update('none');
  }

  /**
   * Initialize the safety score gauge (Canvas-based doughnut)
   */
  initGauge() {
    this.gaugeCanvas = document.getElementById('score-gauge-canvas');
    if (!this.gaugeCanvas) return;
    this.gaugeCtx = this.gaugeCanvas.getContext('2d');
    this.gaugeCanvas.width = 150 * window.devicePixelRatio;
    this.gaugeCanvas.height = 150 * window.devicePixelRatio;
    this.gaugeCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  /**
   * Render the gauge with current score
   */
  renderGauge(score, grade) {
    if (!this.gaugeCtx) return;
    const ctx = this.gaugeCtx;
    const w = 150;
    const h = 150;
    const cx = w / 2;
    const cy = h / 2;
    const radius = 58;
    const lineWidth = 10;

    ctx.clearRect(0, 0, w, h);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI * 0.75, Math.PI * 0.75);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Score arc
    const totalAngle = Math.PI * 1.5;
    const scoreAngle = (score / 100) * totalAngle;
    const startAngle = -Math.PI * 0.75;

    const gradient = ctx.createLinearGradient(0, h, w, 0);
    gradient.addColorStop(0, CONFIG.CHARTS.SCORE_GRADIENT[2]);
    gradient.addColorStop(0.5, CONFIG.CHARTS.SCORE_GRADIENT[1]);
    gradient.addColorStop(1, CONFIG.CHARTS.SCORE_GRADIENT[0]);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + scoreAngle);
    ctx.strokeStyle = grade.color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Glow effect
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + scoreAngle);
    ctx.strokeStyle = grade.color;
    ctx.lineWidth = lineWidth + 4;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.15;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /**
   * Initialize the gaze attention heatmap
   */
  initHeatmap() {
    this.heatmapCanvas = document.getElementById('heatmap-canvas');
    if (!this.heatmapCanvas) return;
    this.heatmapCtx = this.heatmapCanvas.getContext('2d');
    
    const rect = this.heatmapCanvas.parentElement.getBoundingClientRect();
    this.heatmapCanvas.width = rect.width * window.devicePixelRatio;
    this.heatmapCanvas.height = rect.height * window.devicePixelRatio;
    this.heatmapCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  /**
   * Update the gaze heatmap
   */
  updateHeatmap(gazeX, gazeY) {
    if (!this.heatmapCtx) return;
    
    const canvas = this.heatmapCanvas;
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;
    const ctx = this.heatmapCtx;

    // Map gaze to canvas coordinates
    const x = (gazeX + 1) / 2 * w;
    const y = (1 - (gazeY + 1) / 2) * h;

    this.gazeHistory.push({ x, y, age: 0 });
    if (this.gazeHistory.length > 100) this.gazeHistory.shift();

    // Fade background
    ctx.fillStyle = 'rgba(6, 10, 19, 0.08)';
    ctx.fillRect(0, 0, w, h);

    // Draw road context lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    // Center line
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    // Horizon
    ctx.beginPath();
    ctx.moveTo(0, h * 0.4);
    ctx.lineTo(w, h * 0.4);
    ctx.stroke();

    // Draw gaze points
    for (let i = 0; i < this.gazeHistory.length; i++) {
      const p = this.gazeHistory[i];
      const alpha = Math.max(0, 1 - p.age / 100);
      p.age += 0.8;

      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 12);
      gradient.addColorStop(0, `rgba(99, 102, 241, ${alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(99, 102, 241, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Current gaze indicator
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#6366f1';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  destroy() {
    if (this.fatigueChart) {
      this.fatigueChart.destroy();
      this.fatigueChart = null;
    }
  }
}
