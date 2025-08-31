class MobileMirrorApp {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.connectionCode = null;
        this.isConnected = false;
        this.ws = null;
        this.isSharing = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.detectPCConnection();
    }

    setupEventListeners() {
        // Connection controls
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.connectToPC();
        });

        document.getElementById('shareBtn').addEventListener('click', () => {
            this.startScreenShare();
        });

        document.getElementById('stopBtn').addEventListener('click', () => {
            this.stopScreenShare();
        });

        document.getElementById('disconnectBtn').addEventListener('click', () => {
            this.disconnect();
        });

        // Code input handling
        const codeInput = document.getElementById('codeInput');
        codeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
            if (e.target.value.length === 6) {
                document.getElementById('connectBtn').focus();
            }
        });

        codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.value.length === 6) {
                this.connectToPC();
            }
        });

        // Prevent zoom on double tap
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });

        let lastTouchEnd = 0;
        document.addEventListener('touchend', (e) => {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault();
            }
            lastTouchEnd = now;
        }, false);
    }

    detectPCConnection() {
        // Try to connect to local PC signal server
        const possiblePorts = [8080, 8081, 8082];
        let portIndex = 0;

        const tryConnect = () => {
            if (portIndex >= possiblePorts.length) {
                console.log('No PC signal server found');
                return;
            }

            const port = possiblePorts[portIndex];
            const ws = new WebSocket(`ws://${window.location.hostname}:${port}`);
            
            ws.onopen = () => {
                console.log(`Connected to PC signal server on port ${port}`);
                this.signalServerPort = port;
                ws.close();
            };

            ws.onerror = () => {
                portIndex++;
                setTimeout(tryConnect, 100);
            };
        };

        tryConnect();
    }

    async connectToPC() {
        const codeInput = document.getElementById('codeInput');
        const code = codeInput.value.trim().toUpperCase();
        
        if (code.length !== 6) {
            this.showError('Please enter a valid 6-digit code');
            return;
        }

        this.connectionCode = code;
        this.updateStatus('Connecting...', 'connecting');

        try {
            await this.connectToSignalServer();
            await this.createPeerConnection();
            
            // Send connection request
            this.ws.send(JSON.stringify({
                type: 'signal',
                targetCode: code,
                data: {
                    type: 'connection-request',
                    fromCode: this.generateMobileCode(),
                    userAgent: navigator.userAgent
                }
            }));

        } catch (error) {
            console.error('Connection failed:', error);
            this.updateStatus('Connection failed', 'disconnected');
            this.showError('Failed to connect to PC. Please check the code and try again.');
        }
    }

    generateMobileCode() {
        return 'MOB_' + Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    async connectToSignalServer() {
        return new Promise((resolve, reject) => {
            const port = this.signalServerPort || 8080;
            this.ws = new WebSocket(`ws://${window.location.hostname}:${port}`);
            
            this.ws.onopen = () => {
                console.log('Connected to signal server');
                this.setupSignalHandlers();
                resolve();
            };
            
            this.ws.onerror = (error) => {
                console.error('Signal server connection failed:', error);
                reject(error);
            };
        });
    }

    setupSignalHandlers() {
        this.ws.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            await this.handleSignalingMessage(message);
        };

        this.ws.onclose = () => {
            console.log('Signal server connection closed');
            if (this.isConnected) {
                this.updateStatus('Connection lost', 'disconnected');
                this.disconnect();
            }
        };

        // Listen for touch events from PC
        this.ws.addEventListener('message', (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'touch-event') {
                this.handleTouchEvent(message.event);
            } else if (message.type === 'hardware-button') {
                this.handleHardwareButton(message.button);
            }
        });
    }

    async handleSignalingMessage(message) {
        switch (message.type) {
            case 'connection-ack':
                this.updateStatus('Connected to PC', 'connected');
                this.showShareSection();
                break;

            case 'offer':
                await this.peerConnection.setRemoteDescription(message.offer);
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);
                
                this.ws.send(JSON.stringify({
                    type: 'signal',
                    targetCode: this.connectionCode,
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
            console.log('Peer connection state:', state);
            
            if (state === 'connected') {
                this.isConnected = true;
                this.enableControls(true);
            } else if (state === 'disconnected' || state === 'failed') {
                this.isConnected = false;
                this.enableControls(false);
                if (this.isSharing) {
                    this.stopScreenShare();
                }
            }
        };
    }

    async startScreenShare() {
        try {
            // Request screen capture
            this.localStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    mediaSource: 'screen',
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    frameRate: { ideal: 30, max: 60 }
                },
                audio: true
            });

            // Show local preview
            const localVideo = document.getElementById('localVideo');
            const placeholder = document.getElementById('previewPlaceholder');
            
            localVideo.srcObject = this.localStream;
            localVideo.style.display = 'block';
            placeholder.style.display = 'none';

            // Add stream to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Create and send offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.ws.send(JSON.stringify({
                type: 'signal',
                targetCode: this.connectionCode,
                data: { type: 'offer', offer: offer }
            }));

            this.isSharing = true;
            this.updateShareControls(true);
            this.showTouchReceiver();

            // Handle stream end
            this.localStream.getVideoTracks()[0].onended = () => {
                this.stopScreenShare();
            };

        } catch (error) {
            console.error('Error starting screen share:', error);
            this.showError('Failed to start screen sharing. Please grant permission and try again.');
        }
    }

    stopScreenShare() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        const localVideo = document.getElementById('localVideo');
        const placeholder = document.getElementById('previewPlaceholder');
        
        localVideo.style.display = 'none';
        localVideo.srcObject = null;
        placeholder.style.display = 'flex';

        this.isSharing = false;
        this.updateShareControls(false);
        this.hideTouchReceiver();
    }

    handleTouchEvent(event) {
        const touchReceiver = document.getElementById('touchReceiver');
        const touchIndicator = document.getElementById('touchIndicator');
        const touchInfo = document.getElementById('touchInfo');
        
        if (!touchReceiver || touchReceiver.style.display === 'none') return;

        const area = document.querySelector('.touch-indicator-area');
        const rect = area.getBoundingClientRect();
        
        // Convert relative coordinates to absolute position
        const x = event.x * rect.width;
        const y = event.y * rect.height;
        
        touchIndicator.style.left = x + 'px';
        touchIndicator.style.top = y + 'px';
        
        switch (event.type) {
            case 'touchstart':
            case 'tap':
                touchIndicator.classList.add('active');
                touchInfo.textContent = `Touch: ${event.type} at (${Math.round(event.x * 100)}%, ${Math.round(event.y * 100)}%)`;
                setTimeout(() => touchIndicator.classList.remove('active'), 300);
                break;
                
            case 'touchmove':
                touchIndicator.classList.add('active');
                touchInfo.textContent = `Dragging at (${Math.round(event.x * 100)}%, ${Math.round(event.y * 100)}%)`;
                break;
                
            case 'touchend':
                touchIndicator.classList.remove('active');
                touchInfo.textContent = 'Touch ended';
                setTimeout(() => {
                    if (touchInfo.textContent === 'Touch ended') {
                        touchInfo.textContent = 'Waiting for touch events...';
                    }
                }, 1000);
                break;
        }

        // Simulate the touch event on the device (if possible)
        this.simulateTouchOnDevice(event);
    }

    simulateTouchOnDevice(event) {
        // This would require native app integration or browser APIs
        // For now, we'll just log the event
        console.log('Simulating touch:', event);
        
        // In a real implementation, you would:
        // 1. Use Android's Accessibility Service
        // 2. Use iOS's UIAutomation
        // 3. Use a WebRTC data channel to send commands
        // 4. Use a native bridge in a hybrid app
    }

    handleHardwareButton(button) {
        console.log('Hardware button pressed:', button);
        
        const touchInfo = document.getElementById('touchInfo');
        if (touchInfo) {
            touchInfo.textContent = `Hardware button: ${button}`;
            setTimeout(() => {
                touchInfo.textContent = 'Waiting for touch events...';
            }, 2000);
        }

        // Simulate hardware button press
        // This would require native integration
        switch (button) {
            case 'home':
                // Simulate home button
                break;
            case 'back':
                // Simulate back button
                break;
            case 'recent':
                // Simulate recent apps button
                break;
        }
    }

    showShareSection() {
        document.getElementById('connectionSection').style.display = 'none';
        document.getElementById('shareSection').style.display = 'block';
    }

    hideShareSection() {
        document.getElementById('connectionSection').style.display = 'block';
        document.getElementById('shareSection').style.display = 'none';
    }

    showTouchReceiver() {
        document.getElementById('touchReceiver').style.display = 'block';
    }

    hideTouchReceiver() {
        document.getElementById('touchReceiver').style.display = 'none';
    }

    updateShareControls(sharing) {
        const shareBtn = document.getElementById('shareBtn');
        const stopBtn = document.getElementById('stopBtn');
        
        if (sharing) {
            shareBtn.style.display = 'none';
            stopBtn.style.display = 'inline-flex';
        } else {
            shareBtn.style.display = 'inline-flex';
            stopBtn.style.display = 'none';
        }
    }

    enableControls(enabled) {
        document.getElementById('disconnectBtn').disabled = !enabled;
    }

    updateStatus(message, type) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status-badge ${type}`;
        }
    }

    showError(message) {
        // Simple error display - in production you'd want a better UI
        alert(message);
    }

    disconnect() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.isConnected = false;
        this.isSharing = false;
        
        this.updateStatus('Not Connected', 'disconnected');
        this.hideShareSection();
        this.hideTouchReceiver();
        this.updateShareControls(false);
        this.enableControls(false);
        
        // Reset video
        const localVideo = document.getElementById('localVideo');
        const placeholder = document.getElementById('previewPlaceholder');
        
        localVideo.style.display = 'none';
        localVideo.srcObject = null;
        placeholder.style.display = 'flex';
        
        // Clear code input
        document.getElementById('codeInput').value = '';
    }
}

// Check for required APIs
if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    alert('Screen sharing is not supported in this browser. Please use Chrome, Firefox, or Safari.');
}

if (!window.RTCPeerConnection) {
    alert('WebRTC is not supported in this browser. Please update your browser.');
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MobileMirrorApp();
});
