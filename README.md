# web-justmetronome

A pure frontend web version of the iOS app **JustMetronome**.

## Features

- Adjustable BPM: 10–360
- Tap tempo
- Vertical drag on the tempo ring to change BPM
- 1–16 beats per bar
- Per-beat mute pattern
- First beat modes: normal / muted / accented
- Multiple synthesized click sound profiles
- Silent visual mode
- Local persistence via `localStorage`
- Static-site friendly: works on GitHub Pages

## Project structure

- `index.html` — app shell
- `styles.css` — UI styles
- `script.js` — metronome logic (Web Audio API)

## Run locally

Because this is a plain static site, you can open `index.html` directly, but some browsers behave better through a local server.

### Option 1

```bash
cd ~/Documents/Projects/web-justmetronome
python3 -m http.server 4173
```

Then open <http://localhost:4173>

## Deploy to GitHub Pages

### Simplest way

1. Create a GitHub repo, e.g. `web-justmetronome`
2. Push this folder to the repo root
3. In GitHub:
   - open **Settings** → **Pages**
   - under **Build and deployment** choose **Deploy from a branch**
   - select branch `main` and folder `/ (root)`
4. Save and wait for Pages to publish

Your site will be available at something like:

```text
https://<your-username>.github.io/web-justmetronome/
```

## Notes on parity with the iOS app

This web version keeps the core behavior and interaction model of the iOS app:

- BPM editing by gesture + tap tempo
- beat mask pattern editing
- first beat special handling
- multiple sound choices + silent mode
- circular visual progress

A few iOS-specific things are intentionally not ported as-is:

- native haptics
- lock screen transport integration
- bundled audio asset playback via AVAudioEngine

This repo now also includes the original audio assets from the iOS app under `assets/`, and the web app will prefer those real samples in the browser.
