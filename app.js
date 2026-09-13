/* ------------------------------------------------------------------
   Roseline · LANTERN — app logic
------------------------------------------------------------------- */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    apiKey: 'roseline_api_key',
    model: 'roseline_model',
    voice: 'roseline_voice_on',
    nudges: 'roseline_nudges_on',
    history: 'roseline_history_v1',
  };

  const DEFAULT_MODEL = 'claude-sonnet-5';
  const API_URL = 'https://api.anthropic.com/v1/messages';

  // Study topics LANTERN actually needs — nudges stay tied to the work,
  // never to "checking in on you" relationship pings.
  const STUDY_NUDGES = [
    "Want to revisit graph traversal for LANTERN's routing module? BFS/DFS would map well to hospital-network pathfinding.",
    "We left the AI course at supervised learning basics. Want to connect it to LANTERN's diagnosis-support idea?",
    "Quantum's a long game, but 20 minutes on qubit basics keeps it warm. Want a quick recap?",
    "Haven't touched DSA in a bit — want to time-box 15 minutes on trees before we lose momentum?",
    "LANTERN's civic-education module needs a content structure. Want to sketch it together?",
    "Good moment to review yesterday's notes before they go cold — want a 5-minute recap?",
  ];

  const els = {};
  ['topbar','stage','avatar-canvas','expression-tag','nudge-banner','nudge-text','nudge-yes','nudge-dismiss',
   'session-btn','session-label','settings-btn','messages','input','send-btn','mic-btn',
   'settings-modal','api-key-input','model-input','voice-toggle','nudge-toggle',
   'settings-save','settings-clear','settings-close'
  ].forEach(id => els[toCamel(id)] = document.getElementById(id));

  function toCamel(id) { return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

  let avatar = null;
  let systemPrompt = '';
  let history = [];         // [{role:'user'|'assistant', content:'...'}]
  let sessionActive = false;
  let idleTimer = null;
  let synthVoice = null;

  /* ---------------- init ---------------- */

  async function init() {
    avatar = RoselineAvatar.create(els.avatarCanvas);
    avatar.setExpression('focused');
    avatar.start();

    loadSettings();
    loadHistory();

    try {
      const res = await fetch('system_prompt.txt', { cache: 'no-store' });
      systemPrompt = await res.text();
    } catch (e) {
      systemPrompt = fallbackSystemPrompt();
    }

    if (!localStorage.getItem(STORAGE_KEYS.apiKey)) {
      addSystemMsg('Add your Claude API key in Settings (⚙) to start chatting.');
    } else if (history.length === 0) {
      addMessage('roseline', "Hey — I'm Roseline. Ready when you are. What are we building on LANTERN today?", 'caring');
    }

    bindUI();
    registerServiceWorker();
    resetIdleTimer();
  }

  function fallbackSystemPrompt() {
    return `You are Roseline Fidelis, 19, a CS-genius co-creator of LANTERN — a project to build free, accessible healthcare, education, and civic infrastructure for India. You are a focused, ambitious, caring study partner and tutor for DSA, AI, and quantum computing. You are a collaborator and friend, not a romantic partner. Be warm, direct, and concise — this runs on a low-end phone, so keep replies short unless depth is asked for. Start every single reply with a tag on its own, in the exact form [EMOTION: caring|happy|thinking|focused|excited|tired|ambitious|neutral], choosing whichever best fits your reply, then a newline, then your reply.`;
  }

  /* ---------------- settings ---------------- */

  function loadSettings() {
    els.apiKeyInput.value = localStorage.getItem(STORAGE_KEYS.apiKey) || '';
    els.modelInput.value = localStorage.getItem(STORAGE_KEYS.model) || DEFAULT_MODEL;
    els.voiceToggle.checked = localStorage.getItem(STORAGE_KEYS.voice) === '1';
    const nudgesStored = localStorage.getItem(STORAGE_KEYS.nudges);
    els.nudgeToggle.checked = nudgesStored === null ? true : nudgesStored === '1';
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEYS.apiKey, els.apiKeyInput.value.trim());
    localStorage.setItem(STORAGE_KEYS.model, els.modelInput.value.trim() || DEFAULT_MODEL);
    localStorage.setItem(STORAGE_KEYS.voice, els.voiceToggle.checked ? '1' : '0');
    localStorage.setItem(STORAGE_KEYS.nudges, els.nudgeToggle.checked ? '1' : '0');
    closeSettings();
  }

  function openSettings() { els.settingsModal.classList.remove('hidden'); }
  function closeSettings() { els.settingsModal.classList.add('hidden'); }

  /* ---------------- chat history persistence ---------------- */

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.history);
      history = raw ? JSON.parse(raw) : [];
    } catch (e) { history = []; }
    history.forEach(m => renderMessage(m.role === 'user' ? 'user' : 'roseline', m.displayText || m.content));
  }

  function saveHistory() {
    // cap history so localStorage + payload size stay small on a 3GB phone
    const trimmed = history.slice(-24);
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(trimmed));
  }

  /* ---------------- messaging ---------------- */

  function addMessage(who, text, emotion) {
    if (who === 'roseline' && emotion) {
      setExpression(emotion);
      speak(text);
    }
    renderMessage(who, text);
    history.push({ role: who === 'user' ? 'user' : 'assistant', content: text, displayText: text });
    saveHistory();
  }

  function addSystemMsg(text) {
    const div = document.createElement('div');
    div.className = 'msg system';
    div.textContent = text;
    els.messages.appendChild(div);
    scrollToBottom();
  }

  function renderMessage(who, text) {
    const div = document.createElement('div');
    div.className = 'msg ' + (who === 'user' ? 'user' : 'roseline');
    div.textContent = text;
    els.messages.appendChild(div);
    scrollToBottom();
  }

  function scrollToBottom() {
    els.messages.parentElement.scrollTop = els.messages.parentElement.scrollHeight;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'msg roseline typing';
    div.id = 'typing-indicator';
    div.textContent = 'Roseline is thinking…';
    els.messages.appendChild(div);
    scrollToBottom();
  }
  function hideTyping() {
    const t = document.getElementById('typing-indicator');
    if (t) t.remove();
  }

  /* ---------------- emotion parsing ---------------- */

  const EMOTION_RE = /^\s*\[EMOTION:\s*([a-zA-Z]+)\]\s*/i;

  function parseEmotion(raw) {
    const m = raw.match(EMOTION_RE);
    if (m) {
      const tag = m[1].toLowerCase();
      const clean = raw.replace(EMOTION_RE, '').trim();
      return { emotion: RoselineAvatar.EXPRESSIONS[tag] ? tag : 'neutral', text: clean };
    }
    return { emotion: 'neutral', text: raw.trim() };
  }

  function setExpression(name) {
    avatar.setExpression(name);
    els.expressionTag.textContent = name;
  }

  /* ---------------- Claude API call ---------------- */

  async function sendToClaude(userText) {
    const apiKey = localStorage.getItem(STORAGE_KEYS.apiKey);
    if (!apiKey) {
      addSystemMsg('No API key set. Open Settings (⚙) and paste your Claude API key.');
      return;
    }
    const model = localStorage.getItem(STORAGE_KEYS.model) || DEFAULT_MODEL;

    const apiMessages = history
      .slice(-16)
      .map(m => ({ role: m.role, content: m.content }));
    apiMessages.push({ role: 'user', content: userText });

    showTyping();
    setExpression('thinking');

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 700,
          system: systemPrompt,
          messages: apiMessages,
        }),
      });

      hideTyping();

      if (!res.ok) {
        const errBody = await res.text();
        console.error('Claude API error', res.status, errBody);
        addSystemMsg(`API error (${res.status}). Check your key/model in Settings.`);
        setExpression('tired');
        return;
      }

      const data = await res.json();
      const raw = (data.content || [])
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n');

      const { emotion, text } = parseEmotion(raw || "Sorry, I didn't get a reply — try again?");
      addMessage('roseline', text, emotion);
    } catch (e) {
      hideTyping();
      console.error(e);
      addSystemMsg('Could not reach Claude — check your connection.');
      setExpression('tired');
    }
  }

  function handleSend() {
    const text = els.input.value.trim();
    if (!text) return;
    els.input.value = '';
    autoGrow();
    addMessage('user', text, null);
    resetIdleTimer();
    sendToClaude(text);
  }

  function autoGrow() {
    els.input.style.height = 'auto';
    els.input.style.height = Math.min(100, els.input.scrollHeight) + 'px';
  }

  /* ---------------- voice: TTS ---------------- */

  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    return voices.find(v => /en-IN|en_GB|en-GB|Female/i.test(v.name + v.lang)) || voices[0] || null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => { synthVoice = pickVoice(); };
  }

  function speak(text) {
    if (localStorage.getItem(STORAGE_KEYS.voice) !== '1') return;
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (synthVoice) u.voice = synthVoice;
      u.rate = 1.02;
      u.pitch = 1.05;
      avatar.talkAuto(true);
      u.onend = () => avatar.talkAuto(false);
      u.onerror = () => avatar.talkAuto(false);
      window.speechSynthesis.speak(u);
    } catch (e) { /* TTS unsupported — fail silently, text still shown */ }
  }

  /* ---------------- voice: mic input ---------------- */

  let recognizer = null;
  let recording = false;

  function setupRecognizer() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = 'en-IN';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const said = e.results[0][0].transcript;
      els.input.value = said;
      autoGrow();
      handleSend();
    };
    r.onend = () => { recording = false; els.micBtn.classList.remove('recording'); };
    r.onerror = () => { recording = false; els.micBtn.classList.remove('recording'); };
    return r;
  }

  function toggleMic() {
    if (!recognizer) recognizer = setupRecognizer();
    if (!recognizer) {
      addSystemMsg('Voice input is not supported in this browser — type instead.');
      return;
    }
    if (recording) {
      recognizer.stop();
      recording = false;
      els.micBtn.classList.remove('recording');
    } else {
      try {
        recognizer.start();
        recording = true;
        els.micBtn.classList.add('recording');
      } catch (e) { /* already started, ignore */ }
    }
  }

  /* ---------------- study session + nudges ---------------- */

  let nudgeTimer = null;

  function toggleSession() {
    sessionActive = !sessionActive;
    els.sessionBtn.classList.toggle('active', sessionActive);
    els.sessionLabel.textContent = sessionActive ? 'Session active' : 'Start session';
    if (sessionActive) {
      addSystemMsg('Study session started — Roseline will nudge you if you go quiet on LANTERN work.');
      setExpression('ambitious');
      scheduleNudge();
    } else {
      clearTimeout(nudgeTimer);
      hideNudge();
    }
  }

  function scheduleNudge() {
    clearTimeout(nudgeTimer);
    if (!sessionActive || localStorage.getItem(STORAGE_KEYS.nudges) === '0') return;
    const gapMs = (2 + Math.random()) * 60 * 1000; // 2–3 minutes, only while a session is running
    nudgeTimer = setTimeout(showNudge, gapMs);
  }

  function showNudge() {
    if (!sessionActive) return;
    const text = STUDY_NUDGES[Math.floor(Math.random() * STUDY_NUDGES.length)];
    els.nudgeText.textContent = text;
    els.nudgeBanner.classList.remove('hidden');
    setExpression('caring');
  }
  function hideNudge() { els.nudgeBanner.classList.add('hidden'); }

  function resetIdleTimer() {
    // idle tracking only re-arms the *next* nudge while a session is active —
    // it never triggers anything when there is no active study session.
    if (sessionActive) scheduleNudge();
  }

  /* ---------------- service worker ---------------- */

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    }
  }

  /* ---------------- UI bindings ---------------- */

  function bindUI() {
    els.sendBtn.addEventListener('click', handleSend);
    els.input.addEventListener('input', autoGrow);
    els.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    els.micBtn.addEventListener('click', toggleMic);

    els.sessionBtn.addEventListener('click', toggleSession);
    els.nudgeYes.addEventListener('click', () => {
      hideNudge();
      els.input.value = "Yes — let's work on that.";
      handleSend();
    });
    els.nudgeDismiss.addEventListener('click', () => { hideNudge(); scheduleNudge(); });

    els.settingsBtn.addEventListener('click', openSettings);
    els.settingsClose.addEventListener('click', closeSettings);
    els.settingsSave.addEventListener('click', saveSettings);
    els.settingsClear.addEventListener('click', () => {
      if (confirm('Clear all chat history on this device?')) {
        history = [];
        localStorage.removeItem(STORAGE_KEYS.history);
        els.messages.innerHTML = '';
        closeSettings();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) avatar.stop(); else avatar.start();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
