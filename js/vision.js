/**
 * DriveSense AI — Real Webcam Vision Engine
 * Extracts biometric driver data from a live webcam feed using MediaPipe Face Mesh
 */
class VisionEngine {
  constructor() {
    this.videoElement = null;
    this.faceMesh = null;
    this.camera = null;
    this.isActive = false;
    this.onData = null; // Callback for when new bio-metrics are computed
    this.onStatus = null; // Callback for status updates (loading, error)

    // Fallback data when no face is found
    this.lastData = {
      eyeOpenness: 1,
      blinkRate: 15,
      headYaw: 0,
      headPitch: 0,
      gazeX: 0,
      gazeY: 0,
      mouthOpenness: 0,
      isYawning: false
    };

    // For blink rate calculation
    this.blinkHistory = [];
    this.isBlinking = false;
  }

  async init(videoElementId) {
    this.videoElement = document.getElementById(videoElementId);
    if (!this.videoElement) {
      console.error("VisionEngine: Video element not found!");
      return;
    }

    try {
      if (this.onStatus) this.onStatus('loading');

      // Initialize FaceMesh
      this.faceMesh = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        }
      });

      this.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true, // Needed for pupils/irises
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.faceMesh.onResults(this.onResults.bind(this));

      // Start the camera
      this.camera = new Camera(this.videoElement, {
        onFrame: async () => {
          if (this.isActive) {
            await this.faceMesh.send({ image: this.videoElement });
          }
        },
        width: 640,
        height: 480
      });

      await this.camera.start();
      this.isActive = true;
      if (this.onStatus) this.onStatus('active');

    } catch (err) {
      console.error("Camera access failed: ", err);
      if (this.onStatus) this.onStatus('error', err.message);
    }
  }

  stop() {
    this.isActive = false;
    if (this.camera) {
      this.camera.stop();
    }
    if (this.onStatus) this.onStatus('stopped');
  }

  onResults(results) {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      // No face detected, emit last known data but slowly decay to "danger" or neutral
      if (this.onData) this.onData(this.lastData);
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];

    // Compute metrics
    const leftEyeEAR = this.computeEAR(landmarks, [33, 160, 158, 133, 153, 144]);
    const rightEyeEAR = this.computeEAR(landmarks, [362, 385, 387, 263, 373, 380]);
    
    // Normalize EAR (typical range ~0.15 closed to ~0.35 open)
    let eyeOpenness = (leftEyeEAR + rightEyeEAR) / 2;
    // Map approx 0.15-0.30 EAR into 0.0-1.0 openness
    eyeOpenness = Utils.clamp((eyeOpenness - 0.15) / 0.15, 0, 1);

    // Track blinks
    this.updateBlinkRate(eyeOpenness);

    // Compute Mouth Openness (MAR) for yawns
    const mar = this.computeMAR(landmarks);
    // Map approx 0.1 closed to 0.7 open
    const mouthOpenness = Utils.clamp((mar - 0.1) / 0.5, 0, 1);
    const isYawning = mouthOpenness > 0.6;

    // Estimate Head Pose (Yaw and Pitch)
    // Very rough estimation based on nose tip relative to face bounding box
    const pose = this.estimateHeadPose(landmarks);

    // Gaze direction using Iris landmarks (if available, faceMesh refineLandmarks=true provides these at 468-477)
    const gaze = this.estimateGaze(landmarks);

    const data = {
      eyeOpenness,
      blinkRate: this.calculateBlinkRatePerMinute(),
      headYaw: pose.yaw,
      headPitch: pose.pitch,
      gazeX: gaze.x,
      gazeY: gaze.y,
      mouthOpenness,
      isYawning
    };

    this.lastData = data;
    
    // Also pass raw landmarks for rendering if we want to draw the mesh
    if (this.onData) this.onData(data, landmarks);
  }

  // Eye Aspect Ratio
  computeEAR(landmarks, indices) {
    const p1 = landmarks[indices[0]];
    const p2 = landmarks[indices[1]];
    const p3 = landmarks[indices[2]];
    const p4 = landmarks[indices[3]];
    const p5 = landmarks[indices[4]];
    const p6 = landmarks[indices[5]];

    const dist = (pA, pB) => Math.hypot(pA.x - pB.x, pA.y - pB.y);
    
    const v1 = dist(p2, p6);
    const v2 = dist(p3, p5);
    const h = dist(p1, p4);

    return (v1 + v2) / (2.0 * h);
  }

  // Mouth Aspect Ratio
  computeMAR(landmarks) {
    // Upper lip top 13, lower lip bottom 14. Left corner 78, Right corner 308
    const pTop = landmarks[13];
    const pBot = landmarks[14];
    const pLeft = landmarks[78];
    const pRight = landmarks[308];

    const dist = (pA, pB) => Math.hypot(pA.x - pB.x, pA.y - pB.y);
    
    const v = dist(pTop, pBot);
    const h = dist(pLeft, pRight);

    return v / h;
  }

  estimateHeadPose(landmarks) {
    const nose = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const chin = landmarks[152];
    const topHead = landmarks[10];

    // Face center horizontally based on eyes
    const faceCenterX = (leftEye.x + rightEye.x) / 2;
    // Difference between nose X and face center X relates to Yaw
    const yaw = (nose.x - faceCenterX) * 200; // rough degree approx

    // Pitch: distance from nose to eyes vs nose to chin
    const noseToEyeY = faceCenterX - nose.y; // using Y
    // simple pitch approximation: relative position of nose vertically
    const faceHeight = chin.y - topHead.y;
    const noseRelativeY = (nose.y - topHead.y) / faceHeight;
    // normal is ~0.5
    const pitch = (noseRelativeY - 0.5) * 200; 

    return {
      yaw: Utils.clamp(yaw, -45, 45),     // Degrees
      pitch: Utils.clamp(pitch, -30, 30)  // Degrees
    };
  }

  estimateGaze(landmarks) {
    // Refined landmarks: 468 is left iris center, 473 is right iris center
    if (landmarks.length > 473) {
      const lIris = landmarks[468];
      const lEyeOuter = landmarks[33];
      const lEyeInner = landmarks[133];

      const eyeWidth = Math.hypot(lEyeOuter.x - lEyeInner.x, lEyeOuter.y - lEyeInner.y);
      const irisOffsetX = lIris.x - lEyeInner.x; // Inner is usually mostly right for left eye
      
      // Rough proportion -1 to 1
      const gazeX = Utils.clamp((irisOffsetX / eyeWidth - 0.5) * 4, -1, 1);
      
      // Vertical
      const lEyeTop = landmarks[159];
      const lEyeBot = landmarks[145];
      const eyeHeight = Math.hypot(lEyeTop.x - lEyeBot.x, lEyeTop.y - lEyeBot.y);
      const irisOffsetY = lIris.y - lEyeTop.y;
      const gazeY = Utils.clamp((irisOffsetY / eyeHeight - 0.5) * 4, -1, 1);

      return { x: -gazeX, y: -gazeY }; // invert for intuitive UI
    }
    return { x: 0, y: 0 };
  }

  updateBlinkRate(eyeOpenness) {
    const now = performance.now();
    
    // threshold for blink
    if (eyeOpenness < 0.25) {
      if (!this.isBlinking) {
        this.isBlinking = true;
        this.blinkHistory.push(now);
      }
    } else {
      this.isBlinking = false;
    }

    // Keep only blinks from the last 60 seconds
    const oneMinAgo = now - 60000;
    this.blinkHistory = this.blinkHistory.filter(t => t > oneMinAgo);
  }

  calculateBlinkRatePerMinute() {
    // Directly return the count of blinks in the rolling 60s window
    // If the window hasn't been 60s yet, we could extrapolate, but simple count is stable
    // Let's extrapolate if under 15 seconds to avoid 0s at start
    if (this.blinkHistory.length === 0) return 15; // default
    if (this.blinkHistory.length > 0) {
      const firstBlink = this.blinkHistory[0];
      const windowLen = performance.now() - firstBlink;
      if (windowLen < 15000) {
        return Math.min(this.blinkHistory.length * (60000 / Math.max(1000, windowLen)), 30);
      }
    }
    return this.blinkHistory.length;
  }
}
