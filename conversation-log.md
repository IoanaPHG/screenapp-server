# Conversation Log

## Request 1
- User asked to create a Node.js WebSocket server in `C:\ScreenApp` with `ws`.
- Requirements:
  - run on port `3001`
  - accept WebSocket connections
  - log `Client conectat`
  - receive JSON messages
  - support:
    - `join`
    - `message`
  - return error if destination user does not exist

## Work Done
- Created:
  - `package.json`
  - `server.js`
- Installed `ws`
- Verified server start on port `3001`

## Request 2
- User asked to add HTTP endpoint:
  - `POST /api/token`
- Requirements:
  - input `{ "username": "Ion" }`
  - generate JWT with `jsonwebtoken`
  - payload `{ username }`
  - expires in `1h`
  - use hardcoded secret `supersecret123`

## Work Done
- Updated `server.js`
- Added `jsonwebtoken`
- Added JWT endpoint

## Request 3
- User asked to use:
  - `http.createServer()`
  - no Express
  - same HTTP server for WebSocket
  - run on `3001`

## Work Done
- Confirmed server already matched requested architecture

## Request 4
- User asked how to restart server

## Guidance Given
- Stop process on port `3001`
- Restart with `npm.cmd start`

## Request 5
- User asked to make server work on Render
- Requirements:
  - `const PORT = process.env.PORT || 3001;`
  - listen on `0.0.0.0`

## Work Done
- Updated `server.js` for Render deployment

## Request 6
- User asked for simple HTML file to test screen sharing

## Work Done
- Created `screen-share-test.html`
- Added:
  - button `Share Screen`
  - `<video autoplay playsinline muted>`
  - `getDisplayMedia`

## Request 7
- User asked to extend WebRTC:
  - create `RTCPeerConnection`
  - add tracks
  - create offer
  - log offer to console

## Work Done
- Extended `screen-share-test.html`

## Request 8
- User asked to send offer through WebSocket to:
  - `wss://screenapp-server.onrender.com`

## Work Done
- Added WebSocket client in HTML
- Sent `offer` through WebSocket

## Request 9
- User asked to extend WebSocket server for signaling:
  - `offer`
  - `answer`
  - `ice`

## Work Done
- Extended `server.js`
- Forwarded signaling messages without processing them

## Request 10
- User asked to extend WebRTC client to receive `offer`, send `answer`, and display remote stream

## Work Done
- Added:
  - `ws.onmessage`
  - `setRemoteDescription`
  - `createAnswer`
  - `setLocalDescription`
  - `pc.ontrack`

## Request 11
- User asked to support ICE candidates

## Work Done
- Added ICE send/receive logic

## Request 12
- User asked to separate roles:
  - sender shares screen
  - receiver only watches

## Work Done
- Refactored role flow in HTML

## Request 13
- User explained they need an app, not only a local HTML file
- Render server was already running

## Work Done
- Turned project into a minimal app
- Server started serving app page at `/`
- Created `public/index.html`
- Added UI for:
  - username
  - target user
  - connect
  - share screen
  - video
  - logs

## Request 14
- User said app would be used by many people and should be closer to TeamViewer/AnyDesk

## Guidance Given
- Explained need for:
  - rooms/session IDs
  - desktop app for true remote control
  - eventual STUN/TURN

## Request 15
- User said they want `.exe` and asked what options exist

## Guidance Given
- Explained options:
  - Electron
  - Tauri
  - WebView2
  - native desktop client

## Request 16
- User asked which option supports mouse and keyboard control

## Guidance Given
- Explained browser is not enough
- Recommended:
  - Electron + native integration
  - or .NET / native desktop

## Request 17
- User chose Electron

## Work Done
- Added Electron shell:
  - `electron/main.js`
- Updated `package.json`
- Added build scripts for desktop app

## Request 18
- User wanted to remove `Ion/Maria` style flow and instead see who is online in the meeting room

## Work Done
- Added room support to server
- Server tracks participants per room
- Client shows online participants
- User can select participant to share to

## Request 19
- Git push failed because `node_modules` was committed and contained large Electron binaries

## Work Done
- Created `.gitignore`
- Cleaned git history
- Successfully pushed clean commits to GitHub

## Request 20
- User moved project to Render and confirmed deploy commit

## Guidance Given
- Explained how to confirm new UI/version on Render

## Request 21
- User wanted remote control

## Work Done
- Added protocol for:
  - `control-request`
  - `control-granted`
  - `control-revoked`
  - `remote-mouse`
  - `remote-keyboard`
- Added Electron preload bridge
- Added initial native handlers in Electron

## Request 22
- User wanted simpler UX:
  - automatic control when viewing
  - fewer buttons

## Work Done
- Simplified flow
- Added `Allow remote control`
- Later replaced with single `Start Session`

## Request 23
- User reported remote control still unstable

## Work Done
- Added desktop-vs-web mode messaging
- Added `Control Pipeline` logs in UI
- Added Electron desktop-side logs

## Request 24
- User asked about transferring app to another laptop without code

## Guidance Given
- Explained difference between:
  - unpacked build
  - installer
  - portable exe

## Request 25
- User wanted a single transferable `.exe`

## Work Done
- Updated Electron build config for:
  - `portable`
  - `nsis`
- Added:
  - `dist:portable`
  - `dist:setup`

## Request 26
- Build failed on Windows because of `winCodeSign` symlink permission error

## Work Done
- Disabled `signAndEditExecutable` in `package.json`
- Allowed build to avoid that blocked step

## Request 27
- User confirmed portable `.exe` worked

## Guidance Given
- Explained:
  - signaling data goes through WebSocket server
  - video goes peer-to-peer via WebRTC
  - quality is currently adaptive and automatic

## Request 28
- User asked for even simpler UX:
  - predefined single room
  - name requested on app entry
  - click participant
  - remote user gets accept/refuse
  - if accepted, share + control start together

## Work Done
- Simplified app to one predefined room:
  - `screenapp`
- Removed visible room selection from UI
- On startup:
  - ask name via `prompt`
- Added participant list
- Clicking participant now sends `access-request`
- On remote side:
  - confirmation dialog appears
- If accepted:
  - session starts
  - screen sharing begins
  - remote control is enabled

## Current State
- Server:
  - WebSocket + HTTP
  - JWT endpoint
  - Render compatible
  - signaling support
  - access request flow
- Client:
  - one shared room
  - user name prompt
  - list of connected participants
  - click participant to request access
  - accept/refuse flow
  - remote screen view
  - remote mouse / keyboard / scroll
  - stop session
- Desktop:
  - Electron app
  - portable `.exe`
  - native control integration through Electron

## Important Note
- After each code change affecting the desktop client, a new `.exe` build must be generated and copied to the other computer.
