# Phone Screen Mirror

A web-based application that allows you to mirror your phone screen to your PC in real-time.

## Features

- Real-time screen sharing from phone to PC
- WebRTC-based streaming for low latency
- Simple web interface - no app installation required
- Works with any modern smartphone browser
- Responsive design for different screen sizes

## How to Use

1. **Start the PC receiver:**
   - Open `index.html` in your PC browser
   - Note the connection code displayed

2. **Connect your phone:**
   - Open `mobile.html` in your phone's browser
   - Enter the connection code
   - Grant screen sharing permissions
   - Your phone screen will appear on the PC

## Technical Requirements

- Modern web browser with WebRTC support
- Both devices on the same network (or use STUN/TURN servers for internet connectivity)
- HTTPS required for screen capture API (use local server for development)

## Files

- `index.html` - PC receiver interface
- `mobile.html` - Phone sender interface
- `app.js` - Main application logic
- `style.css` - Styling
- `server.js` - Simple HTTPS server for development

## Setup for Development

1. Install Node.js
2. Run: `node server.js`
3. Open `https://localhost:3000` on PC
4. Open `https://localhost:3000/mobile.html` on phone
5. Accept the self-signed certificate warning
