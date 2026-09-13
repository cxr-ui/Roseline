# Roseline · LANTERN — PWA

A holographic study-companion app: a tutor/collaborator for DSA, AI, and quantum, built around the LANTERN project. Runs as an installable Progressive Web App and works offline after the first load.

**About the avatar:** Roseline's look here is an original, procedurally-drawn character (dark messy bun, gray hoodie, silver cross necklace) built entirely from Canvas2D shapes — it is not generated from or traced off any uploaded photo, and doesn't depict a real person.

**About the persona:** she's set up as a focused study partner and tutor, not a romantic companion. The proactive nudges only fire during an active study session you start yourself, and they're always tied to LANTERN/DSA/AI/quantum work — never generic "just checking in on you" messages.

---

## Why you can't just double-click index.html

Android's Chrome only allows PWAs (offline caching + "Add to Home Screen" as a real app) to install from a page served over **HTTPS** or `localhost`. Opening the file directly (`file://`) will show the UI but the service worker — and therefore offline mode — won't register. So step 1 below is about getting it onto a real HTTPS URL, for free, in a few minutes.

## Install — 5 steps

**1. Get the files onto GitHub**
Create a free GitHub account if you don't have one, make a new repository (e.g. `roseline-lantern`), and upload every file in this folder (`index.html`, `styles.css`, `avatar.js`, `app.js`, `manifest.json`, `service-worker.js`, `system_prompt.txt`, and the `icons/` folder) keeping the same folder structure.

**2. Turn on GitHub Pages**
In the repo, go to **Settings → Pages**, set the source branch to `main` (or `master`) and the folder to `/ (root)`, then save. GitHub will give you a URL like:
`https://yourusername.github.io/roseline-lantern/`
It can take 1–2 minutes to go live the first time.

**3. Open that URL in Chrome on your Vivo 1801**
Type or paste the URL from step 2 into Chrome on the phone. You should see the avatar and chat screen load.

**4. Add to Home Screen**
Tap Chrome's ⋮ menu → **"Add to Home screen"** (or **"Install app"** if Chrome offers it directly). This installs it as a standalone app icon — it'll open full-screen, without Chrome's address bar.

**5. Open the app and add your API key**
Launch it from the home screen icon, tap **⚙ Settings**, paste your Claude API key, confirm the model name (defaults to `claude-sonnet-5` — check `docs.claude.com` if you're unsure which model string your key/account has access to), and tap **Save**. Start chatting.

After this first load, the app shell (UI, avatar, styling) is cached and will open even with no signal — only sending/receiving chat messages needs an actual internet connection.

---

## Using it

- **Start session** (top bar) begins a focused study block. While it's active, Roseline will occasionally nudge you toward LANTERN-relevant DSA/AI/quantum work if you've gone quiet — tap it off any time.
- **🎙** does voice input via your phone's speech recognition (needs a connection); if unsupported, just type.
- **Speak replies aloud** (in Settings) uses your phone's built-in text-to-speech.
- Chat history (last ~24 messages) is stored only on your device, in the browser's local storage. **Clear chat history** in Settings wipes it.
- Your API key never leaves your device except in direct calls to `api.anthropic.com` — nothing is proxied through a third-party server.

## Performance notes for the 1801 (3GB RAM, Android 8.1)

- The avatar is drawn with plain Canvas2D (no WebGL/Three.js), animated at a throttled ~20fps, and capped at 1.5x device pixel ratio — designed to stay light on an older GPU.
- No external fonts or CDNs are loaded, so there's nothing to fail if you're offline.
- Chat history is capped so local storage and each API request stay small.

## Troubleshooting

- **"Add to Home screen" doesn't appear:** make sure you're using the `https://...github.io` URL, not a local file path, and that the page fully loaded once first.
- **Avatar doesn't move / chat doesn't respond:** check Settings — an API key is required for chat (the avatar itself will still animate without one).
- **Voice input does nothing:** some Android 8.1 Chrome builds don't support `SpeechRecognition` — this is expected; typing always works.
