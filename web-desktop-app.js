class WebDesktopMirrorApp {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.connectionCode = null;
        this.isConnected = false;
        this.ws = null;
        this.touchEnabled = true;
        this.isDragging = false;
        this.lastTouchTime = 0;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.generateConnectionCode();
        this.connectToSignalServer();
    }

    setupEventListeners() {
        // Connection controls
        document.getElementById('refreshCode').addEventListener('click', () => {
            this.generateConnectionCode();
            this.disconnect();
        });

        document.getElementById('copyCode').addEventListener('click', () => {
            this.copyCodeToClipboard();
        });

        // Touch controls
        document.getElementById('enableTouch').addEventListener('click', () => {
            this.toggleTouchMode();
        });

        document.getElementById('homeBtn').addEventListener('click', () => {
            this.sendHardwareButton('home');
        });

        document.getElementById('backBtn').addEventListener('click', () => {
            this.sendHardwareButton('back');
        });

        document.getElementById('recentBtn').addEventListener('click', () => {
            this.sendHardwareButton('recent');
        });

        // Video controls
        document.getElementById('fullscreenBtn').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        document.getElementById('disconnectBtn').addEventListener('click', () => {
            this.disconnect();
        });

        // Video container touch events
        const videoContainer = document.getElementById('videoContainer');
        this.setupTouchEvents(videoContainer);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F11') {
                e.preventDefault();
                this.toggleFullscreen();
            }
        });
    }

    setupTouchEvents(element) {
        let startX, startY, startTime;
        let touchStarted = false;

        element.addEventListener('mousedown', (e) => {
            if (!this.touchEnabled || !this.isConnected) return;
            
            e.preventDefault();
            touchStarted = true;
            this.isDragging = false;
            startX = e.clientX;
            startY = e.clientY;
            startTime = Date.now();
            
            const rect = element.getBoundingClientRect();
            const video = document.getElementById('remoteVideo');
            const videoRect = video.getBoundingClientRect();
            
            // Calculate relative position on the video
            const relativeX = (e.clientX - videoRect.left) / videoRect.width;
            const relativeY = (e.clientY - videoRect.top) / videoRect.height;
            
            this.showTouchIndicator(e.clientX - rect.left, e.clientY - rect.top);
            this.sendTouchEvent('touchstart', relativeX, relativeY);
        });

        element.addEventListener('mousemove', (e) => {
            if (!touchStarted || !this.touchEnabled || !this.isConnected) return;
            
            e.preventDefault();
            const deltaX = Math.abs(e.clientX - startX);
            const deltaY = Math.abs(e.clientY - startY);
            
            // Consider it a drag if moved more than 5 pixels
            if (deltaX > 5 || deltaY > 5) {
                this.isDragging = true;
            }
            
            const rect = element.getBoundingClientRect();
            const video = document.getElementById('remoteVideo');
            const videoRect = video.getBoundingClientRect();
            
            const relativeX = (e.clientX - videoRect.left) / videoRect.width;
            const relativeY = (e.clientY - videoRect.top) / videoRect.height;
            
            this.showTouchIndicator(e.clientX - rect.left, e.clientY - rect.top);
            this.sendTouchEvent('touchmove', relativeX, relativeY);
        });

        element.addEventListener('mouseup', (e) => {
            if (!touchStarted || !this.touchEnabled || !this.isConnected) return;
            
            e.preventDefault();
            touchStarted = false;
            
            const rect = element.getBoundingClientRect();
            const video = document.getElementById('remoteVideo');
            const videoRect = video.getBoundingClientRect();
            
            const relativeX = (e.clientX - videoRect.left) / videoRect.width;
            const relativeY = (e.clientY - videoRect.top) / videoRect.height;
            
            const duration = Date.now() - startTime;
            const eventType = this.isDragging ? 'touchend' : (duration < 200 ? 'tap' : 'touchend');
            
            this.sendTouchEvent(eventType, relativeX, relativeY);
            this.hideTouchIndicator();
            this.isDragging = false;
        });

        element.addEventListener('mouseleave', (e) => {
            if (touchStarted && this.touchEnabled && this.isConnected) {
                const rect = element.getBoundingClientRect();
                const video = document.getElementById('remoteVideo');
                const videoRect = video.getBoundingClientRect();
                
                const relativeX = (e.clientX - videoRect.left) / videoRect.width;
                const relativeY = (e.clientY - videoRect.top) / videoRect.height;
                
                this.sendTouchEvent('touchend', relativeX, relativeY);
                this.hideTouchIndicator();
            }
            touchStarted = false;
            this.isDragging = false;
        });

        // Prevent context menu
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    showTouchIndicator(x, y) {
        const indicator = document.getElementById('touchIndicator');
        indicator.style.left = x + 'px';
        indicator.style.top = y + 'px';
        indicator.classList.add('active');
    }

    hideTouchIndicator() {
        const indicator = document.getElementById('touchIndicator');
        indicator.classList.remove('active');
    }

    sendTouchEvent(type, x, y) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const touchData = {
            type: type,
            x: Math.max(0, Math.min(1, x)), // Clamp between 0 and 1
            y: Math.max(0, Math.min(1, y)),
            timestamp: Date.now()
        };
        
        this.ws.send(JSON.stringify({
            type: 'touch-event',
            targetCode: this.connectionCode,
            event: touchData
        }));
    }

    sendHardwareButton(button) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        this.ws.send(JSON.stringify({
            type: 'hardware-button',
            targetCode: this.connectionCode,
            button: button
        }));
    }

    toggleTouchMode() {
        this.touchEnabled = !this.touchEnabled;
        const btn = document.getElementById('enableTouch');
        const videoContainer = document.getElementById('videoContainer');
        
        if (this.touchEnabled) {
            btn.textContent = '✋ Touch Enabled';
            btn.classList.add('active');
            videoContainer.classList.add('touch-enabled');
        } else {
            btn.textContent = '🚫 Touch Disabled';
            btn.classList.remove('active');
            videoContainer.classList.remove('touch-enabled');
        }
    }

    toggleFullscreen() {
        const video = document.getElementById('remoteVideo');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            video.requestFullscreen();
        }
    }

    copyCodeToClipboard() {
        navigator.clipboard.writeText(this.connectionCode).then(() => {
            const btn = document.getElementById('copyCode');
            const originalText = btn.textContent;
            btn.textContent = '✅ Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = this.connectionCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            const btn = document.getElementById('copyCode');
            const originalText = btn.textContent;
            btn.textContent = '✅ Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        });
    }

    generateConnectionCode() {
        this.connectionCode = Math.random().toString(36).substr(2, 6).toUpperCase();
        document.getElementById('connectionCode').textContent = this.connectionCode;
    }

    connectToSignalServer() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('Connected to signal server');
            this.ws.send(JSON.stringify({
                type: 'register',
                code: this.connectionCode
            }));
        };
        
        this.ws.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            await this.handleSignalingMessage(message);
        };
        
        this.ws.onclose = () => {
            console.log('Disconnected from signal server');
            setTimeout(() => {
                this.connectToSignalServer();
            }, 3000);
        };
    }

    async handleSignalingMessage(message) {
        switch (message.type) {
            case 'connection-request':
                this.updateStatus('Phone connecting...', 'connecting');
                await this.createPeerConnection();
                
                this.ws.send(JSON.stringify({
                    type: 'signal',
                    targetCode: message.fromCode,
                    data: { type: 'connection-ack' }
                }));
                break;

            case 'offer':
                if (!this.peerConnection) {
                    await this.createPeerConnection();
                }
                
                await this.peerConnection.setRemoteDescription(message.offer);
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);
                
                this.ws.send(JSON.stringify({
                    type: 'signal',
                    targetCode: message.fromCode,
                    data: { type: 'answer', answer: answer }
                }));
                break;

            case 'answer':
                await this.peerConnection.setRemoteDescription(message.answer);
                break;

            case 'ice-candidate':
                await this.peerConnection.addIceCandidate(message.candidate);
                break;
        }
    }

    async createPeerConnection() {
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.peerConnection = new RTCPeerConnection(config);

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'signal',
                    targetCode: this.connectionCode,
                    data: {
                        type: 'ice-candidate',
                        candidate: event.candidate
                    }
                }));
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('Connection state:', state);
            
            if (state === 'connected') {
                this.isConnected = true;
                this.updateStatus('Connected', 'connected');
                this.showControls(true);
            } else if (state === 'disconnected' || state === 'failed') {
                this.isConnected = false;
                this.updateStatus('Disconnected', 'disconnected');
                this.showControls(false);
            }
        };

        this.peerConnection.ontrack = (event) => {
            const remoteVideo = document.getElementById('remoteVideo');
            const placeholder = document.getElementById('placeholder');
            
            if (remoteVideo && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
                remoteVideo.style.display = 'block';
                if (placeholder) {
                    placeholder.style.display = 'none';
                }
            }
        };
    }

    updateStatus(message, type) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status-badge ${type}`;
        }
    }

    showControls(show) {
        const controlsPanel = document.getElementById('controlsPanel');
        const connectionPanel = document.getElementById('connectionPanel');
        
        if (show) {
            controlsPanel.style.display = 'grid';
            connectionPanel.style.display = 'none';
        } else {
            controlsPanel.style.display = 'none';
            connectionPanel.style.display = 'grid';
        }
    }

    disconnect() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        this.isConnected = false;
        
        const remoteVideo = document.getElementById('remoteVideo');
        const placeholder = document.getElementById('placeholder');
        
        if (remoteVideo) {
            remoteVideo.style.display = 'none';
            remoteVideo.srcObject = null;
        }
        
        if (placeholder) {
            placeholder.style.display = 'flex';
        }
        
        this.updateStatus('Disconnected', 'disconnected');
        this.showControls(false);
        this.hideTouchIndicator();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WebDesktopMirrorApp();
});
