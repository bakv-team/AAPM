(function () {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const STORAGE_KEY = "aapm_sound_enabled";
  let audioContext = null;
  let unlocked = false;
  let suppressNextToastSound = false;
  let lastTypeSoundAt = 0;
  let enabled = localStorage.getItem(STORAGE_KEY) !== "0";

  const patterns = {
    login: [
      { frequency: 440, start: 0, duration: 0.07, gain: 0.045, type: "sine" },
      { frequency: 660, start: 0.06, duration: 0.09, gain: 0.05, type: "sine" }
    ],
    add: [
      { frequency: 620, start: 0, duration: 0.05, gain: 0.04, type: "triangle" },
      { frequency: 820, start: 0.045, duration: 0.07, gain: 0.045, type: "triangle" }
    ],
    remove: [
      { frequency: 260, start: 0, duration: 0.08, gain: 0.04, type: "square" },
      { frequency: 180, start: 0.06, duration: 0.08, gain: 0.035, type: "square" }
    ],
    success: [
      { frequency: 520, start: 0, duration: 0.08, gain: 0.045, type: "sine" },
      { frequency: 780, start: 0.075, duration: 0.12, gain: 0.05, type: "sine" },
      { frequency: 1040, start: 0.18, duration: 0.14, gain: 0.04, type: "sine" }
    ],
    checkout: [
      { frequency: 392, start: 0, duration: 0.09, gain: 0.06, type: "triangle" },
      { frequency: 587.33, start: 0.08, duration: 0.11, gain: 0.07, type: "triangle" },
      { frequency: 783.99, start: 0.18, duration: 0.16, gain: 0.075, type: "sine" },
      { frequency: 1174.66, start: 0.32, duration: 0.18, gain: 0.055, type: "sine" }
    ],
    type: [
      { frequency: 1180, start: 0, duration: 0.025, gain: 0.032, type: "square" },
      { frequency: 760, start: 0.018, duration: 0.03, gain: 0.025, type: "triangle" }
    ],
    notification: [
      { frequency: 760, start: 0, duration: 0.07, gain: 0.04, type: "sine" },
      { frequency: 760, start: 0.13, duration: 0.07, gain: 0.035, type: "sine" }
    ],
    alert: [
      { frequency: 460, start: 0, duration: 0.09, gain: 0.045, type: "triangle" },
      { frequency: 360, start: 0.1, duration: 0.1, gain: 0.04, type: "triangle" }
    ],
    error: [
      { frequency: 180, start: 0, duration: 0.1, gain: 0.05, type: "sawtooth" },
      { frequency: 140, start: 0.11, duration: 0.13, gain: 0.045, type: "sawtooth" }
    ]
  };

  function getContext() {
    if (!AudioContextClass) return null;
    if (!audioContext) audioContext = new AudioContextClass();
    return audioContext;
  }

  async function unlock() {
    const ctx = getContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (error) {
        return false;
      }
    }
    unlocked = ctx.state === "running";
    return unlocked;
  }

  function play(name = "notification") {
    const ctx = getContext();
    const steps = patterns[name] || patterns.notification;
    if (!enabled || !ctx || !unlocked || ctx.state !== "running") return;

    if (name === "type") {
      const nowMs = Date.now();
      if (nowMs - lastTypeSoundAt < 45) return;
      lastTypeSoundAt = nowMs;
    }

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 1.15;
    master.connect(ctx.destination);

    steps.forEach(step => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + step.start;
      const end = start + step.duration;

      oscillator.type = step.type || "sine";
      oscillator.frequency.setValueAtTime(step.frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(step.gain, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    });
  }

  function soundForToast(type) {
    if (type === "success") return "success";
    if (type === "error") return "error";
    if (type === "warn") return "alert";
    return "notification";
  }

  function suppressNextToast() {
    suppressNextToastSound = true;
  }

  function shouldPlayToast() {
    if (!suppressNextToastSound) return true;
    suppressNextToastSound = false;
    return false;
  }

  function isEnabled() {
    return enabled;
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
    if (enabled) {
      unlock().then(() => play("notification"));
    }
  }

  function bindUnlockEvents() {
    const unlockOnce = () => unlock();
    ["pointerdown", "keydown", "touchstart"].forEach(eventName => {
      window.addEventListener(eventName, unlockOnce, { passive: true, capture: true });
    });
  }

  function bindTypingEvents() {
    document.addEventListener("input", event => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (["checkbox", "radio", "range", "file", "date", "color"].includes(target.type)) return;
      play("type");
    }, { capture: true });
  }

  window.AAPMSound = {
    play,
    unlock,
    soundForToast,
    suppressNextToast,
    shouldPlayToast,
    isEnabled,
    setEnabled
  };

  bindUnlockEvents();
  bindTypingEvents();
})();
