const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    showMobileQR: () => ipcRenderer.invoke('show-mobile-qr'),
    forwardTouchEvent: (touchData) => ipcRenderer.send('forward-touch-event', touchData),
    
    // Listen for events from main process
    onSignalServerReady: (callback) => ipcRenderer.on('signal-server-ready', callback),
    onNewConnection: (callback) => ipcRenderer.on('new-connection', callback),
    onDisconnect: (callback) => ipcRenderer.on('disconnect', callback),
    onShowAbout: (callback) => ipcRenderer.on('show-about', callback),
    
    // Remove listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
