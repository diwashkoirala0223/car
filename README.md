# 🧠 DriveSense AI — Adaptive Driver Fatigue & Attention Monitor

> **"Every year, 100,000 people die from drowsy driving. DriveSense AI predicts fatigue *before* it kills."**

[![Built for openpilot](https://img.shields.io/badge/Built%20for-openpilot-blue)](#)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](#)

---

## 🎯 Judge's Pitch

Existing driver monitoring systems detect drowsiness *after* your eyes close. DriveSense AI uses a **multi-factor fatigue fusion model** that combines PERCLOS, blink anomalies, head pose drift, yawn frequency, and circadian rhythm data to **predict dangerous fatigue levels 10 minutes before they happen** — giving drivers time to save their own lives. It's the difference between a near-miss and a funeral.

---

## 💡 Inspiration

We started with a question: *Why do driver monitoring systems only react instead of predict?*

openpilot has a driver-facing camera that checks if you're looking at the road. But alertness isn't binary. Fatigue is a **gradual physiological process** — it shows up in your blink patterns 20 minutes before you feel sleepy. Your head starts micro-drifting. Your yawns cluster together.

We built DriveSense AI to catch what humans can't feel happening to themselves.

---

## 🚗 What It Does

DriveSense AI is a **real-time driver fatigue monitoring and prediction dashboard** that:

- **🔍 Tracks 6+ biometric signals** — PERCLOS (eye closure percentage), blink rate, head yaw/pitch, yawn frequency, gaze direction, mouth openness
- **🧠 Runs a multi-factor AI fatigue model** — Weighted fusion of all signals through an exponential moving average pipeline
- **📈 Predicts fatigue 10 minutes ahead** — Linear regression on trend data projects when you'll cross danger thresholds
- **🏆 Computes a real-time Safety Score** (0–100, A–F grade) — With component breakdowns showing exactly what's degrading
- **🚨 3-tier alert system** — Info nudges → Warning chimes → Critical "PULL OVER" full-screen overlay with audio
- **🌙 Circadian rhythm modeling** — Knows that 3 AM and 2 PM are biologically dangerous times
- **☕ Coffee break simulation** — Models temporary alertness recovery after a rest stop
- **🗺️ Gaze attention heatmap** — Visualizes where the driver is looking over time

### 4 Realistic Driving Scenarios
| Scenario | Description |
|----------|-------------|
| 🌙 Night Highway | Monotonous highway at 11 PM — fatigue builds fast |
| 🌅 Morning Commute | Rush hour at 7:30 AM — stop-and-go keeps you alert |
| 😴 Post-Lunch Dip | Afternoon drive at 2 PM — the circadian dip strikes |
| 🚛 Long Haul Trucker | 6-hour interstate haul — relentless fatigue accumulation |

---

## 🏗️ How We Built It

### Architecture
```
┌──────────────────────────────────────────────────┐
│                  Dashboard UI                     │
│  (index.html + glassmorphism CSS)                │
│                                                   │
│  ┌──────────┐ ┌───────────┐ ┌────────────────┐  │
│  │ Driver   │ │ Chart.js  │ │ Alert Feed     │  │
│  │ Face     │ │ Timeline  │ │ + Toast        │  │
│  │ Canvas   │ │ + Gauge   │ │ Notifications  │  │
│  └────┬─────┘ └─────┬─────┘ └──────┬─────────┘  │
│       └──────────────┼──────────────┘             │
│               ┌──────▼──────┐                     │
│               │  app.js     │ ← Main Controller   │
│               │  (60fps)    │                     │
│               └──┬───┬───┬──┘                     │
│          ┌───────┘   │   └────────┐               │
│     ┌────▼───┐ ┌─────▼────┐ ┌────▼────┐         │
│     │AI Eng. │ │Simulation│ │Scoring  │         │
│     │Fatigue │ │Scenario  │ │Safety   │         │
│     │Model   │ │Generator │ │Score    │         │
│     └────────┘ └──────────┘ └─────────┘         │
│                                                   │
│     config.js    utils.js    alerts.js            │
└──────────────────────────────────────────────────┘
```

### Tech Stack
| Technology | Why We Chose It |
|-----------|----------------|
| **Vanilla JS** | Zero build step, instant demo, max portability. Opens from a file. |
| **Canvas API** | Real-time face visualization at 60fps without DOM overhead |
| **Chart.js 4** | Beautiful animated charts with 5 lines of config |
| **CSS Glassmorphism** | Premium dark theme that wows judges instantly |
| **Web Audio API** | Alert sounds without loading audio files |
| **requestAnimationFrame** | Smooth, battery-efficient render loop |

### Key Technical Decisions
1. **Multi-factor fusion over binary detection** — Real fatigue is a spectrum. Our weighted model captures gradients that threshold-based systems miss.
2. **Predictive regression** — Instead of just reporting current state, we project the fatigue trajectory forward using linear regression on rolling history.
3. **Circadian rhythm modeling** — Physiological alertness follows a 24-hour curve. Our model factors in time-of-day to correlate with biological fatigue patterns.
4. **Simulation with realistic noise** — Gaussian noise, smooth sine-based drift, and Box-Muller transforms create data that feels organic, not robotic.

---

## 🎮 Demo

### Running Locally
```bash
# No build step needed! Just serve static files:
npx -y serve .

# Then open http://localhost:3000
```

### Controls
- **Scenario Selector** — Switch between 4 driving scenarios
- **Speed Controls** — 1×, 2×, 5×, 10× simulation speed
- **Pause/Resume** — Freeze the simulation to inspect state
- **Reset** — Start the scenario fresh

### What to Watch For
1. Start with **Night Highway** at 5× speed
2. Watch the fatigue line climb on the timeline chart
3. Notice the face canvas — eyes start closing, head drifts
4. Info alerts appear first, then warnings
5. At ~80% fatigue: **PULL OVER** overlay with urgent audio
6. The Safety Score drops from A (green) to F (red) in real-time
7. Check the **gaze heatmap** — attention scatter increases with fatigue

---

## 🧩 Challenges

1. **Making simulated data feel real** — Purely random data looks fake. We used Gaussian noise, Box-Muller transforms, and multi-frequency sine wave composition to create organic physiological patterns.
2. **Alert fatigue** — Ironic for a fatigue system! We implemented cooldown timers per alert level to prevent notification spam while still catching every real danger.
3. **Predictive accuracy** — Linear regression is simple but effective on monotone fatigue curves. More complex scenarios (coffee breaks, conversation) required modeling recovery dynamics.
4. **60fps Canvas rendering** — Drawing a face + indicators + eyes every frame while updating Chart.js and managing alerts required careful throttling of expensive operations.

---

## 🏆 Accomplishments

- **Full real-time fatigue prediction** — Not just detection, but a 10-minute lookahead
- **5-component weighted AI model** running at 60fps with no jank
- **Production-quality UI** with glassmorphism, micro-animations, and responsive design
- **Zero dependencies** (except Chart.js CDN) — opens from any file server
- **Realistic simulation engine** that models circadian rhythms, microsleeps, coffee breaks, and yawn clustering
- **Multi-modal alerts** — visual toasts, feed history, audio chimes, and emergency overlay

---

## 📚 What We Learned

- **PERCLOS** (Percentage of Eye Closure) is the gold standard metric in fatigue research — we implemented it using a rolling 60-second window
- **Circadian rhythms** create two daily valleys of alertness: 2–4 AM and 1–3 PM — both are peak crash windows
- **Alert design** matters as much as detection accuracy — a system that annoys the driver is a system that gets turned off
- **Exponential Moving Averages** are surprisingly effective for real-time signal smoothing with minimal computational cost
- **Canvas 2D** can render surprisingly expressive face visualizations with basic shape primitives

---

## 🔮 Future Improvements

- **Real camera integration** — Replace simulation with MediaPipe Face Mesh for actual driver monitoring via webcam
- **openpilot plugin** — Deploy as a companion app that reads openpilot's driver monitoring camera feed
- **ML model upgrade** — Train an LSTM on real fatigue datasets (like DROZY or UTA-RLDD) for higher accuracy
- **Heart rate variability** — Integrate smartwatch HRV data for cardiovascular fatigue markers
- **Fleet management dashboard** — Multi-driver monitoring for commercial trucking companies
- **V2X communication** — Share fatigue state with nearby vehicles and infrastructure
- **Personalized baselines** — Learn individual driver patterns to customize thresholds

---

## 📁 Project Structure

```
car/
├── index.html              # Main dashboard (single page)
├── README.md               # This file
├── config/
│   └── config.js           # All tunable constants
├── css/
│   └── style.css           # Premium dark glassmorphism theme
└── js/
    ├── utils.js            # Helpers (EMA, noise, color interpolation)
    ├── ai-engine.js        # Multi-factor fatigue AI model
    ├── simulation.js       # Driving scenario simulator
    ├── scoring.js          # Safety score engine (0–100, A–F)
    ├── alerts.js           # 3-tier alert manager + Web Audio
    ├── charts.js           # Chart.js timeline + canvas gauge + heatmap
    └── app.js              # Main controller + face renderer
```

---

## 📄 License

MIT License — Free to use, modify, and distribute.

---

<p align="center">
  <strong>Built with 🧠 for the openpilot Hackathon</strong><br>
  <em>Because the best safety system is the one that works before you need it.</em>
</p>
