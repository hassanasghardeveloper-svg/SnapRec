const { app, BrowserWindow, ipcMain, desktopCapturer, globalShortcut, Tray, Menu, dialog, nativeImage, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// Set FFmpeg path - handle both dev and packaged app
function setupFFmpeg() {
  let ffmpegPath = ffmpegStatic;
  if (app.isPackaged) {
    // In packaged app, ffmpeg-static is in app.asar.unpacked
    ffmpegPath = ffmpegPath.replace(/app\.asar(?![.\-])/g, 'app.asar.unpacked');
  }
  ffmpeg.setFfmpegPath(ffmpegPath);
}

let mainWindow;
let snippingWindow;
let effectsOverlay;
let timerOverlay;
let annotationOverlay;
let zoomOverlay;
let tray;
let store;
let isRecording = false;

// Get default settings (must be called after app is ready)
function getDefaultSettings() {
  return {
    savePath: path.join(app.getPath('videos'), 'SnapRec'),
    videoQuality: 'high',
    fps: 30,
    recordAudio: true,
    recordMic: true
  };
}

function getSettings() {
  const defaults = getDefaultSettings();
  if (!store) return defaults;
  return store.get('settings', defaults);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 700,
    minHeight: 500,
    frame: false,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets/icons/icon.png'),
    show: false,
    backgroundColor: '#181818'
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Close button now quits the app properly
  mainWindow.on('close', () => {
    app.isQuitting = true;
  });
}

function createTray() {
  if (tray) {
    tray.destroy();
  }

  const trayIcon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEzSURBVDiNpZMxS8NAGIbfu0tSG3VxcHBwECc3B/0B/gP/hLg5OLg4ODi4ODjoJIKDOAi1JXe5+zpc0jQxFXzh4OB77n3v7hJFxPxLGgECwDlHWZZorSmKAq01WZaRpilpmhJFEVVV4ZzDGINzjjzPMcbgnMM5R5ZlpGlKkiQ456jrmqqqEBGSJKGua8qyRAQQ55xPiGMAbwxpmkJVFQA8gIggzjnyPMdaS1VV1HUNQNhAgD1FiOO4HQKgaRoAfIbQPqYAsNYCUFUVRVG0G7cbECDWWqqqIkkSoii63SDsQ62VPM8pioJut0uWZSRJ8t+AMADq0O/3yfMcpVQIWAshhIuJXg9Y+gHaQNhg3Wv8u0Go64Z7RWm95IzWeS8w9n2apvmNfv4JrbWC//EFnhXe7YHthWUAAAAASUVORK5CYII=');

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show SnapRec', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Take Screenshot', accelerator: 'CommandOrControl+Shift+S', click: () => mainWindow.webContents.send('take-screenshot') },
    { label: isRecording ? 'Stop Recording' : 'Start Recording', accelerator: 'CommandOrControl+Shift+R', click: () => mainWindow.webContents.send('toggle-recording') },
    { type: 'separator' },
    { label: 'Open Recordings Folder', click: () => {
      const settings = getSettings();
      if (!fs.existsSync(settings.savePath)) fs.mkdirSync(settings.savePath, { recursive: true });
      shell.openPath(settings.savePath);
    }},
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); }}
  ]);

  tray.setToolTip('SnapRec');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow.show());
}

function registerGlobalShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (mainWindow) mainWindow.webContents.send('take-screenshot');
  });
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (mainWindow) mainWindow.webContents.send('toggle-recording');
  });
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    openSnippingTool();
  });
  globalShortcut.register('CommandOrControl+Shift+X', () => {
    if (mainWindow) mainWindow.webContents.send('stop-recording');
  });
}

// Snipping Tool - Like Windows Snip & Sketch
async function openSnippingTool() {
  // Get primary display bounds with scale factor for high DPI
  const primaryDisplay = screen.getPrimaryDisplay();
  const scaleFactor = primaryDisplay.scaleFactor || 1;
  const { width, height } = primaryDisplay.size;

  // Capture at full resolution (multiply by scale factor for HiDPI screens)
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.floor(width * scaleFactor),
      height: Math.floor(height * scaleFactor)
    }
  });

  if (sources.length === 0) return;

  // Create fullscreen transparent window
  snippingWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  snippingWindow.loadFile('src/snipping.html');

  snippingWindow.once('ready-to-show', () => {
    // Send the screenshot to the snipping window
    const screenshotDataUrl = sources[0].thumbnail.toDataURL();
    snippingWindow.webContents.send('set-screenshot', screenshotDataUrl);
  });

  snippingWindow.on('closed', () => {
    snippingWindow = null;
  });
}

function setupIpcHandlers() {
  ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 150 }
    });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
  });

  ipcMain.handle('get-settings', () => getSettings());

  ipcMain.handle('save-settings', (event, newSettings) => {
    if (store) store.set('settings', { ...getSettings(), ...newSettings });
    return getSettings();
  });

  ipcMain.handle('save-file', async (event, { buffer, type }) => {
    const settings = getSettings();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (!fs.existsSync(settings.savePath)) fs.mkdirSync(settings.savePath, { recursive: true });

    if (type === 'screenshot') {
      const fileName = `screenshot-${timestamp}.png`;
      const filePath = path.join(settings.savePath, fileName);
      fs.writeFileSync(filePath, Buffer.from(buffer));
      return filePath;
    } else if (type === 'gif') {
      const fileName = `gif-${timestamp}.gif`;
      const tempPath = path.join(settings.savePath, `temp-${timestamp}.webm`);
      const filePath = path.join(settings.savePath, fileName);

      fs.writeFileSync(tempPath, Buffer.from(buffer));

      // Convert to GIF with higher quality
      return new Promise((resolve, reject) => {
        ffmpeg(tempPath)
          .outputOptions(['-vf', 'fps=15,scale=720:-1:flags=lanczos', '-loop', '0'])
          .save(filePath)
          .on('end', () => {
            fs.unlinkSync(tempPath);
            resolve(filePath);
          })
          .on('error', (err) => {
            console.error('GIF conversion error:', err);
            resolve(tempPath); // Return webm if conversion fails
          });
      });
    } else if (type === 'audio') {
      // Audio-only recording
      const fileName = `audio-${timestamp}.mp3`;
      const tempPath = path.join(settings.savePath, `temp-${timestamp}.webm`);
      const filePath = path.join(settings.savePath, fileName);

      fs.writeFileSync(tempPath, Buffer.from(buffer));

      // Convert to MP3
      return new Promise((resolve) => {
        ffmpeg(tempPath)
          .outputOptions([
            '-c:a', 'libmp3lame',
            '-b:a', '192k',
            '-ar', '44100'
          ])
          .save(filePath)
          .on('end', () => {
            try { fs.unlinkSync(tempPath); } catch (e) {}
            resolve(filePath);
          })
          .on('error', (err) => {
            console.error('MP3 conversion error:', err);
            resolve(tempPath);
          });
      });
    } else {
      // Recording - convert to MP4 with WhatsApp compatible settings
      const outputFormat = settings.outputFormat || 'mp4';
      const fileName = `recording-${timestamp}.${outputFormat}`;
      const tempPath = path.join(settings.savePath, `temp-${timestamp}.webm`);
      const filePath = path.join(settings.savePath, fileName);

      fs.writeFileSync(tempPath, Buffer.from(buffer));

      // Notify renderer that conversion started
      if (mainWindow) {
        mainWindow.webContents.send('conversion-status', 'Converting to MP4...');
      }

      // Convert to MP4 with H.264 - higher quality settings
      return new Promise((resolve) => {
        ffmpeg(tempPath)
          .outputOptions([
            '-r', '30',
            '-c:v', 'libx264',
            '-profile:v', 'high',
            '-level', '4.1',
            '-pix_fmt', 'yuv420p',
            '-preset', 'slow',
            '-crf', '18',
            '-b:v', '8M',
            '-maxrate', '12M',
            '-bufsize', '16M',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ar', '48000',
            '-movflags', '+faststart'
          ])
          .save(filePath)
          .on('end', () => {
            try { fs.unlinkSync(tempPath); } catch (e) {}
            if (mainWindow) {
              mainWindow.webContents.send('conversion-status', 'done');
            }
            resolve(filePath);
          })
          .on('error', (err) => {
            console.error('MP4 conversion error:', err);
            // If conversion fails, keep the webm
            const webmPath = path.join(settings.savePath, `recording-${timestamp}.webm`);
            try { fs.renameSync(tempPath, webmPath); } catch (e) {}
            if (mainWindow) {
              mainWindow.webContents.send('conversion-status', 'failed');
            }
            resolve(webmPath);
          });
      });
    }
  });

  ipcMain.handle('open-folder', () => {
    const settings = getSettings();
    if (!fs.existsSync(settings.savePath)) fs.mkdirSync(settings.savePath, { recursive: true });
    shell.openPath(settings.savePath);
  });

  // Snipping tool handlers
  ipcMain.handle('save-snip', async (event, imageData) => {
    const settings = getSettings();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `snip-${timestamp}.png`;
    const filePath = path.join(settings.savePath, fileName);

    if (!fs.existsSync(settings.savePath)) fs.mkdirSync(settings.savePath, { recursive: true });

    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    // Show notification
    if (mainWindow) {
      mainWindow.webContents.send('snip-saved', filePath);
      mainWindow.show();
    }
    return filePath;
  });

  ipcMain.handle('copy-to-clipboard', async (event, imageData) => {
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const image = nativeImage.createFromBuffer(buffer);
    const { clipboard } = require('electron');
    clipboard.writeImage(image);

    if (mainWindow) {
      mainWindow.webContents.send('snip-copied');
      mainWindow.show();
    }
    return true;
  });

  ipcMain.handle('open-snipping-tool', () => {
    openSnippingTool();
  });

  ipcMain.handle('select-save-path', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.on('recording-status', (event, status) => {
    isRecording = status;
    createTray();
  });

  ipcMain.handle('get-screen-size', () => screen.getPrimaryDisplay().workAreaSize);

  // Window controls
  ipcMain.on('minimize-window', () => mainWindow.minimize());
  ipcMain.on('close-window', () => {
    app.isQuitting = true;
    app.quit();
  });

  // Effects overlay for cursor highlight, click effects, keyboard overlay
  ipcMain.handle('create-effects-overlay', () => {
    if (effectsOverlay && !effectsOverlay.isDestroyed()) {
      effectsOverlay.show();
      return true;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    effectsOverlay = new BrowserWindow({
      width: width,
      height: height,
      x: 0,
      y: 0,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      focusable: false,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    effectsOverlay.setIgnoreMouseEvents(true, { forward: true });
    effectsOverlay.loadFile('src/effects-overlay.html');
    effectsOverlay.showInactive();

    effectsOverlay.on('closed', () => {
      effectsOverlay = null;
    });

    return true;
  });

  ipcMain.handle('close-effects-overlay', () => {
    if (effectsOverlay && !effectsOverlay.isDestroyed()) {
      effectsOverlay.close();
      effectsOverlay = null;
    }
    return true;
  });

  ipcMain.on('effects-overlay-event', (event, data) => {
    if (effectsOverlay && !effectsOverlay.isDestroyed()) {
      effectsOverlay.webContents.send('effect-event', data);
    }
  });

  // Timer overlay
  ipcMain.handle('create-timer-overlay', () => {
    if (timerOverlay && !timerOverlay.isDestroyed()) {
      return true;
    }

    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    timerOverlay = new BrowserWindow({
      width: 180,
      height: 60,
      x: width - 200,
      y: 20,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    timerOverlay.loadFile(path.join(__dirname, 'src', 'timer-overlay.html'));
    timerOverlay.setIgnoreMouseEvents(true);
    return true;
  });

  ipcMain.handle('close-timer-overlay', () => {
    if (timerOverlay && !timerOverlay.isDestroyed()) {
      timerOverlay.close();
      timerOverlay = null;
    }
    return true;
  });

  ipcMain.on('timer-update', (event, data) => {
    if (timerOverlay && !timerOverlay.isDestroyed()) {
      timerOverlay.webContents.send('timer-update', data);
    }
  });

  // Annotation overlay
  ipcMain.handle('open-annotation', () => {
    if (annotationOverlay && !annotationOverlay.isDestroyed()) {
      annotationOverlay.focus();
      return true;
    }

    const { width, height } = screen.getPrimaryDisplay().bounds;

    annotationOverlay = new BrowserWindow({
      width: width,
      height: height,
      x: 0,
      y: 0,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      fullscreen: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    annotationOverlay.loadFile(path.join(__dirname, 'src', 'annotation-overlay.html'));
    return true;
  });

  ipcMain.handle('close-annotation', () => {
    if (annotationOverlay && !annotationOverlay.isDestroyed()) {
      annotationOverlay.close();
      annotationOverlay = null;
    }
    return true;
  });

  // Auto-start on boot
  ipcMain.handle('set-auto-start', (event, enabled) => {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: app.getPath('exe')
    });
    return true;
  });

  ipcMain.handle('get-auto-start', () => {
    const settings = app.getLoginItemSettings();
    return settings.openAtLogin;
  });

  // Zoom overlay
  ipcMain.handle('open-zoom', async () => {
    if (zoomOverlay && !zoomOverlay.isDestroyed()) {
      zoomOverlay.focus();
      return true;
    }

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;

    // Capture screenshot for zoom
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: width, height: height }
    });

    if (sources.length === 0) return false;

    zoomOverlay = new BrowserWindow({
      width: width,
      height: height,
      x: 0,
      y: 0,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      fullscreen: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    zoomOverlay.loadFile(path.join(__dirname, 'src', 'zoom-overlay.html'));

    zoomOverlay.webContents.once('did-finish-load', () => {
      const screenshotDataUrl = sources[0].thumbnail.toDataURL();
      zoomOverlay.webContents.send('zoom-screenshot', screenshotDataUrl);
    });

    return true;
  });

  ipcMain.handle('close-zoom', () => {
    if (zoomOverlay && !zoomOverlay.isDestroyed()) {
      zoomOverlay.close();
      zoomOverlay = null;
    }
    return true;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  const Store = (await import('electron-store')).default;
  store = new Store();

  setupFFmpeg();
  setupIpcHandlers();
  createWindow();
  createTray();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  // Clean up tray
  if (tray) {
    tray.destroy();
    tray = null;
  }
  // Clean up effects overlay
  if (effectsOverlay && !effectsOverlay.isDestroyed()) {
    effectsOverlay.close();
    effectsOverlay = null;
  }
  // Clean up timer overlay
  if (timerOverlay && !timerOverlay.isDestroyed()) {
    timerOverlay.close();
    timerOverlay = null;
  }
  // Clean up annotation overlay
  if (annotationOverlay && !annotationOverlay.isDestroyed()) {
    annotationOverlay.close();
    annotationOverlay = null;
  }
  // Clean up snipping window
  if (snippingWindow && !snippingWindow.isDestroyed()) {
    snippingWindow.close();
    snippingWindow = null;
  }
  // Clean up zoom overlay
  if (zoomOverlay && !zoomOverlay.isDestroyed()) {
    zoomOverlay.close();
    zoomOverlay = null;
  }
});
app.on('before-quit', () => { app.isQuitting = true; });
