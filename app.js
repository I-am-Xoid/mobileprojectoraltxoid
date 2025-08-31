class ScreenMirrorApp {
    constructor(mode) {
        this.mode = mode; // 'sender' or 'receiver'
        this.peerConnection = null;
        this.localStream = null;
        this.connectionCode = null;
        this.isConnected = false;
        this.signalServer = null;
        
        this.init();
    }

    init() {
        this.setupSignaling();
        
        if (this.mode === 'receiver') {
            this.initReceiver();
        } else {
            this.initSender();
        }
    }

    // Simple signaling using localStorage for same-device demo
    // In production, you'd use WebSocket server
    setupSignaling() {
        this.signalServer = {
            send: (code, message) => {
                const channel = `mirror_${code}`;
                const messages = JSON.parse(localStorage.getItem(channel) || '[]');
                messages.push({
                    timestamp: Date.now(),
                    from: this.mode,
                    data: message
                });
                localStorage.setItem(channel, JSON.stringify(messages));
            },
            
            listen: (code, callback) => {
                const channel = `mirror_${code}`;
                setInterval(() => {
                    const messages = JSON.parse(localStorage.getItem(channel) || '[]');
                    const unread = messages.filter(msg => 
                        msg.from !== this.mode && 
                        msg.timestamp > (this.lastMessageTime || 0)
                    );
                    
                    unread.forEach(msg => {
                        this.lastMessageTime = msg.timestamp;
                        callback(msg.data);
                    });
                }, 500);
            }
        };
    }

    generateConnectionCode() {
        return Math.random().toString(36).substr(2, 6).toUpperCase();
    }

    initReceiver() {
        this.connectionCode = this.generateConnectionCode();
        this.updateConnectionCode();
        this.setupReceiverEvents();
        this.startListening();
    }

    initSender() {
        this.setupSenderEvents();
    }

    updateConnectionCode() {
        const codeElement = document.getElementById('connectionCode');
        if (codeElement) {
            codeElement.textContent = this.connectionCode;
        }
    }

    setupReceiverEvents() {
        const refreshBtn = document.getElementById('refreshCode');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.connectionCode = this.generateConnectionCode();
                this.updateConnectionCode();
                this.disconnect();
                this.startListening();
            });
        }

        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                const video = document.getElementById('remoteVideo');
                if (video.requestFullscreen) {
                    video.requestFullscreen();
                }
            });
        }

        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => {
                this.disconnect();
            });
        }
    }

    setupSenderEvents() {
        const connectBtn = document.getElementById('connectBtn');
        const shareBtn = document.getElementById('shareBtn');
        const stopBtn = document.getElementById('stopBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const codeInput = document.getElementById('codeInput');

        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                const code = codeInput.value.trim().toUpperCase();
                if (code.length === 6) {
                    this.connectToReceiver(code);
                } else {
                    alert('Please enter a valid 6-digit code');
                }
            });
        }

        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                this.startScreenShare();
            });
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.stopScreenShare();
            });
        }

        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => {
                this.disconnect();
            });
        }

        if (codeInput) {
            codeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase();
            });

            codeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    connectBtn.click();
                }
            });
        }
    }

    async startListening() {
        this.updateStatus('Waiting for connection', 'disconnected');
        
        this.signalServer.listen(this.connectionCode, async (message) => {
            await this.handleSignalingMessage(message);
        });
    }

    async connectToReceiver(code) {
        this.connectionCode = code;
        this.updateStatus('Connecting...', 'connecting');
        
        try {
            await this.createPeerConnection();
            
            // Send connection request
            this.signalServer.send(code, {
                type: 'connection-request',
                userAgent: navigator.userAgent
            });
            
            this.signalServer.listen(code, async (message) => {
                await this.handleSignalingMessage(message);
            });
            
        } catch (error) {
            console.error('Connection failed:', error);
            this.updateStatus('Connection failed', 'disconnected');
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
            if (event.candidate) {
                this.signalServer.send(this.connectionCode, {
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('Connection state:', state);
            
            if (state === 'connected') {
                this.isConnected = true;
                this.updateStatus('Connected', 'connected');
                this.enableControls(true);
            } else if (state === 'disconnected' || state === 'failed') {
                this.isConnected = false;
                this.updateStatus('Disconnected', 'disconnected');
                this.enableControls(false);
            }
        };

        if (this.mode === 'receiver') {
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
    }

    async handleSignalingMessage(message) {
        if (!this.peerConnection) {
            await this.createPeerConnection();
        }

        switch (message.type) {
            case 'connection-request':
                if (this.mode === 'receiver') {
                    this.updateStatus('Phone connecting...', 'connecting');
                    this.updateDeviceInfo(message.userAgent);
                    
                    // Send acknowledgment
                    this.signalServer.send(this.connectionCode, {
                        type: 'connection-ack'
                    });
                }
                break;

            case 'connection-ack':
                if (this.mode === 'sender') {
                    this.updateStatus('Connected to PC', 'connected');
                    this.showSharePanel();
                }
                break;

            case 'offer':
                await this.peerConnection.setRemoteDescription(message.offer);
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);
                
                this.signalServer.send(this.connectionCode, {
                    type: 'answer',
                    answer: answer
                });
                break;

            case 'answer':
                await this.peerConnection.setRemoteDescription(message.answer);
                break;

            case 'ice-candidate':
                await this.peerConnection.addIceCandidate(message.candidate);
                break;
        }
    }

    async startScreenShare() {
        try {
            this.localStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    mediaSource: 'screen',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 30 }
                },
                audio: true
            });

            // Show local preview
            const localVideo = document.getElementById('localVideo');
            const previewPlaceholder = document.getElementById('previewPlaceholder');
            
            if (localVideo) {
                localVideo.srcObject = this.localStream;
                localVideo.style.display = 'block';
                if (previewPlaceholder) {
                    previewPlaceholder.style.display = 'none';
                }
            }

            // Add stream to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Create and send offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.signalServer.send(this.connectionCode, {
                type: 'offer',
                offer: offer
            });

            this.updateStatus('Sharing screen...', 'connected');
            this.enableShareControls(true);

            // Handle stream end
            this.localStream.getVideoTracks()[0].onended = () => {
                this.stopScreenShare();
            };

        } catch (error) {
            console.error('Error starting screen share:', error);
            alert('Failed to start screen sharing. Please make sure you grant permission.');
        }
    }

    stopScreenShare() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        const localVideo = document.getElementById('localVideo');
        const previewPlaceholder = document.getElementById('previewPlaceholder');
        
        if (localVideo) {
            localVideo.style.display = 'none';
            localVideo.srcObject = null;
        }
        
        if (previewPlaceholder) {
            previewPlaceholder.style.display = 'flex';
        }

        this.enableShareControls(false);
        this.updateStatus('Connected (not sharing)', 'connected');
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

        this.isConnected = false;
        
        if (this.mode === 'receiver') {
            const remoteVideo = document.getElementById('remoteVideo');
            const placeholder = document.getElementById('placeholder');
            
            if (remoteVideo) {
                remoteVideo.style.display = 'none';
                remoteVideo.srcObject = null;
            }
            
            if (placeholder) {
                placeholder.style.display = 'flex';
            }
            
            this.updateStatus('Waiting for connection', 'disconnected');
        } else {
            this.hideSharePanel();
            this.updateStatus('Not connected', 'disconnected');
            
            const localVideo = document.getElementById('localVideo');
            const previewPlaceholder = document.getElementById('previewPlaceholder');
            
            if (localVideo) {
                localVideo.style.display = 'none';
                localVideo.srcObject = null;
            }
            
            if (previewPlaceholder) {
                previewPlaceholder.style.display = 'flex';
            }
        }

        this.enableControls(false);
        this.enableShareControls(false);
    }

    updateStatus(message, type) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status-indicator ${type}`;
        }
    }

    updateDeviceInfo(userAgent) {
        const deviceInfo = document.getElementById('deviceInfo');
        if (deviceInfo && userAgent) {
            const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
            const deviceType = isMobile ? '📱 Mobile Device' : '💻 Desktop';
            deviceInfo.textContent = `${deviceType} connected`;
        }
    }

    showSharePanel() {
        const sharePanel = document.getElementById('sharePanel');
        if (sharePanel) {
            sharePanel.style.display = 'block';
        }
    }

    hideSharePanel() {
        const sharePanel = document.getElementById('sharePanel');
        if (sharePanel) {
            sharePanel.style.display = 'none';
        }
    }

    enableControls(enabled) {
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        
        if (fullscreenBtn) fullscreenBtn.disabled = !enabled;
        if (disconnectBtn) disconnectBtn.disabled = !enabled;
    }

    enableShareControls(sharing) {
        const shareBtn = document.getElementById('shareBtn');
        const stopBtn = document.getElementById('stopBtn');
        
        if (shareBtn) shareBtn.disabled = sharing;
        if (stopBtn) stopBtn.disabled = !sharing;
    }
}

// Check for required APIs
if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    alert('Screen sharing is not supported in this browser. Please use Chrome, Firefox, or Safari.');
}

if (!window.RTCPeerConnection) {
    alert('WebRTC is not supported in this browser. Please update your browser.');
}
