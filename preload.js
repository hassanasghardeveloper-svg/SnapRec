const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Get available screen/window sources for capture
  getSources: () => ipcRenderer.invoke('get-sources'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),

  // File operations
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  openFolder: () => ipcRenderer.invoke('open-folder'),

  // Window controls
  minimize: () => ipcRenderer.send('minimize-window'),
  close: () => ipcRenderer.send('close-window'),

  // Screen info
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),

  // Recording status
  setRecordingStatus: (status) => ipcRenderer.send('recording-status', status),

  // Listen for events from main process
  onTakeScreenshot: (callback) => {
    ipcRenderer.on('take-screenshot', () => callback());
  },

  onToggleRecording: (callback) => {
    ipcRenderer.on('toggle-recording', () => callback());
  },

  onStopRecording: (callback) => {
    ipcRenderer.on('stop-recording', () => callback());
  },

  onAreaSelect: (callback) => {
    ipcRenderer.on('area-select', () => callback());
  },

  // Snipping tool
  onSetScreenshot: (callback) => {
    ipcRenderer.on('set-screenshot', (event, dataUrl) => callback(dataUrl));
  },
  saveSnip: (imageData) => ipcRenderer.invoke('save-snip', imageData),
  copyToClipboard: (imageData) => ipcRenderer.invoke('copy-to-clipboard', imageData),
  onSnipSaved: (callback) => {
    ipcRenderer.on('snip-saved', (event, filePath) => callback(filePath));
  },
  onSnipCopied: (callback) => {
    ipcRenderer.on('snip-copied', () => callback());
  },
  openSnippingTool: () => ipcRenderer.invoke('open-snipping-tool'),

  // Video conversion status
  onConversionStatus: (callback) => {
    ipcRenderer.on('conversion-status', (event, status) => callback(status));
  },

  // Effects overlay for cursor highlight, click effects, keyboard overlay
  createEffectsOverlay: () => ipcRenderer.invoke('create-effects-overlay'),
  closeEffectsOverlay: () => ipcRenderer.invoke('close-effects-overlay'),
  sendEffectsEvent: (data) => ipcRenderer.send('effects-overlay-event', data),
  onEffectEvent: (callback) => {
    ipcRenderer.on('effect-event', (event, data) => callback(data));
  },

  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
