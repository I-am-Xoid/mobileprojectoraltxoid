const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname)));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/mobile', (req, res) => {
    res.sendFile(path.join(__dirname, 'mobile-app.html'));
});

app.get('/desktop', (req, res) => {
    res.sendFile(path.join(__dirname, 'web-desktop.html'));
});

// WebSocket signaling server
const connections = new Map();

wss.on('connection', (ws) => {
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
            } else if (message.type === 'hardware-button') {
                // Forward hardware button events
                const targetWs = connections.get(message.targetCode);
                if (targetWs && targetWs.readyState === WebSocket.OPEN) {
                    targetWs.send(JSON.stringify({
                        type: 'hardware-button',
                        button: message.button
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

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`🚀 Phone Screen Mirror Server Running on port ${PORT}!`);
    console.log(`📱 Desktop Interface: http://localhost:${PORT}/desktop`);
    console.log(`📱 Mobile Interface: http://localhost:${PORT}/mobile`);
    console.log(`📱 Main Page: http://localhost:${PORT}`);
});
