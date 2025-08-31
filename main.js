const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const WebSocket = require('ws');

let mainWindow;
let signalServer;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false // Allow local file access for development
        },
        icon: path.join(__dirname, 'assets', 'icon.png'),
        title: 'Phone Screen Mirror',
        show: false
    });

    // Load the main interface
    mainWindow.loadFile('desktop.html');

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        if (signalServer) {
            signalServer.close();
        }
    });

    // Create menu
    createMenu();
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Connection',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('new-connection');
                    }
                },
                {
                    label: 'Disconnect',
                    accelerator: 'CmdOrCtrl+D',
                    click: () => {
                        mainWindow.webContents.send('disconnect');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Fullscreen',
                    accelerator: 'F11',
                    click: () => {
                        mainWindow.setFullScreen(!mainWindow.isFullScreen());
                    }
                },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: () => {
                        mainWindow.webContents.send('show-about');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function startSignalServer() {
    const port = 8080;
    signalServer = new WebSocket.Server({ port });
    
    const connections = new Map();
    
    signalServer.on('connection', (ws) => {
        console.log('New WebSocket connection');
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                
                if (message.type === 'register') {
                    connections.set(message.code, ws);
                    ws.code = message.code;
                    console.log(`Registered connection with code: ${message.code}`);
                } else if (message.type === 'signal') {
                    const targetWs = connections.get(message.targetCode);
                    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                        targetWs.send(JSON.stringify(message.data));
                    }
                } else if (message.type === 'touch-event') {
                    // Forward touch events to mobile device
                    const targetWs = connections.get(message.targetCode);
                    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                        targetWs.send(JSON.stringify({
                            type: 'touch-event',
                            event: message.event
                        }));
                    }
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        });
        
        ws.on('close', () => {
            if (ws.code) {
                connections.delete(ws.code);
                console.log(`Connection ${ws.code} closed`);
            }
        });
    });
    
    console.log(`Signal server started on port ${port}`);
    return port;
}

// App event handlers
app.whenReady().then(() => {
    const signalPort = startSignalServer();
    createWindow();
    
    // Send signal server port to renderer
    mainWindow.webContents.once('dom-ready', () => {
        mainWindow.webContents.send('signal-server-ready', signalPort);
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC handlers
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('show-mobile-qr', () => {
    // Create a new window for mobile QR code
    const qrWindow = new BrowserWindow({
        width: 400,
        height: 500,
        parent: mainWindow,
        modal: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });
    
    qrWindow.loadFile('mobile-qr.html');
    return true;
});

ipcMain.on('forward-touch-event', (event, touchData) => {
    // Forward touch events through WebSocket
    if (signalServer) {
        signalServer.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'touch-event',
                    event: touchData
                }));
            }
        });
    }
});
