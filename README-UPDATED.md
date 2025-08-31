# Phone Screen Mirror Desktop App

A desktop application that allows you to mirror your phone screen to your PC with full touch interaction support.

## Features

- **Real-time Screen Mirroring**: Stream your phone screen to PC
- **Touch Interaction**: Click and drag on PC to control your phone
- **Hardware Buttons**: Simulate Home, Back, and Recent buttons
- **Electron Desktop App**: Native desktop application
- **WebRTC Streaming**: Low-latency real-time communication
- **Touch Feedback**: Visual indicators for touch events

## How Touch Interaction Works

1. **Click**: Single click simulates a tap on your phone
2. **Click and Drag**: Hold left mouse button and drag to simulate swipe gestures
3. **Hardware Buttons**: Use the control buttons for Home, Back, and Recent apps
4. **Touch Indicator**: See where you're touching with visual feedback

## Installation & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Desktop App**:
   ```bash
   npm start
   ```

3. **Connect Your Phone**:
   - Get the 6-digit connection code from the desktop app
   - Open `mobile-app.html` in your phone's browser
   - Enter the connection code and connect
   - Grant screen sharing permissions
   - Start screen sharing

## Files Structure

- `main.js` - Electron main process
- `preload.js` - Electron preload script
- `desktop.html` - Desktop app interface
- `desktop-app.js` - Desktop app logic with touch handling
- `desktop-style.css` - Desktop app styling
- `mobile-app.html` - Mobile interface
- `mobile-app.js` - Mobile app logic
- `mobile-style.css` - Mobile app styling

## Touch Controls

### Mouse to Touch Mapping
- **Left Click** → Touch Start
- **Mouse Move (while holding)** → Touch Move/Drag
- **Release Click** → Touch End
- **Quick Click** → Tap gesture

### Hardware Button Simulation
- **Home Button** → Android/iOS home
- **Back Button** → Android back navigation
- **Recent Button** → Recent apps view

## Technical Details

- **Framework**: Electron for desktop app
- **Communication**: WebRTC for video streaming
- **Signaling**: WebSocket server for connection management
- **Touch Events**: Custom touch event forwarding system
- **Compatibility**: Works with modern browsers supporting WebRTC

## Development

To build the app for distribution:
```bash
npm run build
```

To create installers:
```bash
npm run dist
```

## Requirements

- Node.js 16+
- Modern browser with WebRTC support
- Both devices on same network (or STUN/TURN servers)
- Screen sharing permissions on mobile device

## Troubleshooting

1. **Connection Issues**: Ensure both devices are on the same network
2. **Touch Not Working**: Make sure "Touch Enabled" is active in desktop app
3. **No Video**: Grant screen sharing permissions on mobile device
4. **Lag**: Check network connection and reduce video quality if needed
