# SnapRec

A modern, feature-rich screen recorder and screenshot application for Windows built with Electron.

![SnapRec](https://img.shields.io/badge/Platform-Windows-blue) ![Electron](https://img.shields.io/badge/Electron-40.x-47848F) ![License](https://img.shields.io/badge/License-MIT-green)

## Features

### Screen Recording
- **High-quality video recording** - Record at 1080p with VP8 codec for smooth performance
- **System audio capture** - Record audio from your computer
- **Microphone support** - Add voice narration to your recordings
- **Webcam overlay** - Picture-in-picture webcam with adjustable position
- **Pause/Resume** - Pause recording and continue when ready
- **Auto-stop timer** - Set a timer to automatically stop recording
- **MP4 output** - Recordings are automatically converted to MP4 for compatibility

### Screenshots
- **Full screen capture** - Capture your entire screen
- **Window capture** - Select specific windows to capture
- **Snipping tool** - Draw a region to capture with annotation tools
  - Freehand pen with smart shape detection
  - Arrows, rectangles, circles
  - Text annotations
  - Highlighter
  - WhatsApp-style blur for sensitive areas
- **Copy to clipboard** - Quickly copy screenshots

### GIF Recording
- Record short clips and save as animated GIFs

### Audio Recording
- Record audio-only sessions (saved as MP3)

### Additional Tools
- **Color Picker** - Pick any color from your screen
- **Cursor highlight** - Highlight cursor during recording
- **Click effects** - Visual ripple effect on mouse clicks
- **Keyboard overlay** - Show key presses during recording
- **Scheduled recording** - Schedule recordings for a specific time

### System Tray
- Minimize to system tray
- Quick access to all features
- Global hotkeys

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+S` | Take Screenshot |
| `Ctrl+Shift+R` | Start/Stop Recording |
| `Ctrl+Shift+X` | Stop Recording |
| `Ctrl+Shift+A` | Open Snipping Tool |

## Installation

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/snaprec.git
cd snaprec

# Install dependencies
npm install

# Run the app
npm start
```

### Build for Production

```bash
# Build Windows installer
npm run build
```

The installer will be created in the `dist` folder.

## Project Structure

```
snaprec/
├── main.js              # Electron main process
├── preload.js           # Secure bridge between main/renderer
├── package.json         # Project configuration
├── src/
│   ├── index.html       # Main window UI
│   ├── styles.css       # Application styles
│   ├── renderer.js      # Renderer process logic
│   ├── snipping.html    # Snipping tool window
│   └── effects-overlay.html  # Effects overlay window
└── assets/
    └── icons/           # Application icons
```

## Technologies

- **Electron** - Desktop application framework
- **HTML/CSS/JavaScript** - Frontend
- **FFmpeg** - Video/audio conversion
- **electron-store** - Persistent settings storage

## Settings

Access settings via the gear icon in the app:
- **Save Location** - Choose where to save recordings
- **Video Quality** - High (1080p), Medium (720p), or Low (480p)
- **Frame Rate** - 15, 30, or 60 FPS
- **Audio Options** - System audio and microphone toggles

## License

MIT License - feel free to use and modify!

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Made with ❤️ using Electron