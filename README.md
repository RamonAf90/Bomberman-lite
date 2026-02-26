# Bomberman-Lite: Real-Time Multiplayer DOM Game

Bomberman-style multiplayer web game for 2-4 players, built with:
- Node.js + Express
- Socket.IO
- DOM rendering (no canvas)
- Deployed in Render.com

## Project overview
This project was built as part of a 3-person development team at kood/Sisu.  
The focus was on implementing smooth real-time gameplay using DOM rendering while maintaining responsive player input and stable game state across multiple clients.

This game allows multiple players to join the same room and compete in a Bomberman-like arena. Players move around, place bombs, and try to eliminate opponents. Key features include:
- Real-time multiplayer gameplay (2–4 players per room)
- Bomb placement with explosion timers
- Scoring system: players earn points by hitting others with bombs
- Player lives: each player has 3 lives
- Win conditions based on lives and score
- Draw/tie detection if multiple players are equal in lives and score
- Multi-room support with a lead player controlling game start

## Run on Render.com

**Live demo:** https://multi-player-game-aq9n.onrender.com

Quick access steps:
1. Open the URL above.
2. Enter a unique player name and click `start`.
3. Create a room (or join with a room code from another player).
4. Share the same URL + room code with other players/reviewers.
5. Once everyone is in, the lead clicks `Start Game`.

## Run Locally

### Requirements
- Node.js 20+ (or 18+ with modern browser support)
- npm

### Install
```bash
npm install
```

### Start
```bash
npm start
```

Open `http://localhost:3000`.

## Deploy to Render.com

This repo includes a Render Blueprint at `render.yaml`.

### Option A: Deploy with Blueprint (recommended)
1. Push this repo to GitHub.
2. In Render, click **New +** -> **Blueprint**.
3. Select this repository.
4. Confirm service settings and create deploy.
5. Wait for first deploy to complete.

Render will build and run the service using:
- Build command: `npm install`
- Start command: `npm start`

### Option B: Create Web Service manually
1. In Render, click **New +** -> **Web Service**.
2. Connect this repository.
3. Set:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Deploy.

## How to Use the Hosted Game

1. Open your Render service URL (for example `https://your-service.onrender.com`) in browser tab 1.
2. Enter player name and join.
3. Create a room and copy the room code.
4. Share the same URL + room code with other players.
5. Other players open the same URL in their own browsers/computers, join with unique names, and enter room code.
6. Lead player starts game once everyone is ready.

## Notes for Render

- Render injects `PORT`; server already uses `process.env.PORT`.
- Free tier can sleep after inactivity. First request after sleep may take some time.
- Use the HTTPS Render URL when sharing with other players.

## Usage guide
1. Open the game URL in browser
2. Enter a player name
3. Create a room (or join a room using an existing room code)
4. Share the room code with other players
5. Click **Ready** button
6. Once all players are ready, the lead player clicks **Start Game**

### In-game controls
- Move: arrow keys
- Place bomb: spacebar (each player can have up to 5 bombs active at the same time)
- Pause button opens a menu with **Quit / Resume** options
- In-game chat is on right side of the screen

## Winning logic
- Each player starts with **3 lives**
- Players earn point when their bomb hits an opponent
- The game ends when either:   
1. Only one player is alive → winner declared   
2. All players are dead → draw   
3. Time limit (180s) is reached → winner is player with highest score 
- If multiple players tie in lives and score, the game declares a tie

## Technical highlights

- Real-time multiplayer synchronization using Socket.IO  
- DOM-only rendering (no canvas) with focus on responsiveness  
- Low-latency player input handling  
- Multi-room session handling for parallel matches

## Bonus functionality
- Full keyboard support
- Sound effects
- Multi-room support

## Team

This project was developed by a three-person team at kood/Sisu.

- **Ramon** – Client play experience, UI flow, DOM rendering logic, player input handling, and real-time responsiveness.
- **Eetu** – Game server architecture, room management, and core multiplayer synchronization.
- **Nea** – Game state coordination, and overall gameplay integration.

We worked collaboratively through regular code reviews, shared debugging sessions, and iterative feature development.
