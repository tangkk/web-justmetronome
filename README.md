# web-justmetronome

A minimal, distraction-free web metronome inspired by the original iOS JustMetronome app.

## Product page

https://tangkk.github.io/web-justmetronome/

## Introduction

**JustMetronome for Web** is a focused metronome designed for practice sessions that should feel calm, clean, and immediate.
No clutter, no complicated setup, no overloaded musician dashboard — just tempo, pulse, silence control, and a built-in practice timer in a compact visual layout.

It keeps the spirit of the original iOS app while making it instantly available in the browser as a pure frontend experience.
That means you can open it directly from GitHub Pages, use it without a backend, and keep everything lightweight and portable.

If you want a metronome that feels more like a dedicated practice object than a generic utility website, this project is built exactly for that.

## Features

- Clean web remake of the iOS **JustMetronome** concept
- Pure frontend, static-site friendly
- Deployable on **GitHub Pages**
- Click in the center or press **Space** to start / stop playback
- Vertical drag on BPM area to adjust tempo
- Mouse wheel on BPM area to adjust BPM
- Tap tempo button in the top control row
- Adjustable beat count
- Mouse wheel on beat-mask area to add / remove beats
- New beats default to **muted**
- Beat mask editing by directly clicking beat cells
- Underline-style beat cursor indicator
- Multiple sound styles
- Volume slider
- Mouse wheel on volume slider to adjust volume
- Built-in countdown timer at the top
- Timer interactions:
  - single click = start / pause
  - double click = reset
  - vertical drag = adjust by minutes
  - mouse wheel = adjust by minutes
- Timer completion sound (`ding`)
- Mobile devices currently show an **unsupported** message instead of partial behavior

## Design goals

This project is intentionally opinionated:

- minimal UI
- fast access to core controls
- visually quiet
- no decorative dashboard chrome
- interaction-first design for actual music practice

## Controls

### Metronome

- **Center click**: start / stop
- **Space**: start / stop
- **Drag on BPM**: change BPM
- **Scroll on BPM**: change BPM
- **Top-left icon**: cycle sound
- **Top-middle icon**: tap tempo
- **Top-right icon**: reset preferences

### Beat mask

- **Click a beat cell**: mute / unmute that beat
- **Scroll on beat mask area**: add / remove beats
- Maximum supported beats: **32**
- Layout wraps at **8 beats per row**

### Volume

- **Slider**: change volume
- **Scroll on slider**: change volume

### Timer

- Default timer: **25:00**
- **Single click**: start / pause
- **Double click**: reset
- **Drag vertically**: adjust minutes
- **Scroll on timer**: adjust minutes

## Project structure

- `index.html` — app structure
- `styles.css` — layout and visual design
- `script.js` — metronome, timer, interaction logic
- `assets/` — click sounds and timer ding
- `404.html` — GitHub Pages fallback redirect
- `.nojekyll` — GitHub Pages compatibility

## Run locally

```bash
cd ~/Documents/Projects/web-justmetronome
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/
```

## Deploy to GitHub Pages

This project is designed to work as a static site.

1. Push the repo to GitHub
2. Open repository **Settings** → **Pages**
3. Choose:
   - **Deploy from a branch**
   - Branch: `main`
   - Folder: `/ (root)`
4. Save

The site will be published at:

```text
https://<your-username>.github.io/web-justmetronome/
```

## Current platform note

Desktop browsers are the primary supported target.
Mobile browsers currently show an unsupported message intentionally, to avoid inconsistent audio interaction behavior.

## Promotion intro (ready to reuse)

Here is a short introduction you can reuse for promotion, repo sharing, or launch notes:

> JustMetronome for Web is a minimalist browser-based metronome built for serious practice.
> It combines a clean visual design, direct gesture-based tempo control, beat masking, multiple click sounds, and a built-in practice timer — all in a lightweight frontend app you can open instantly from GitHub Pages.
> No installation, no backend, no clutter — just a focused metronome experience.

## License

Add your preferred license here if you want this repo to be publicly reusable.
