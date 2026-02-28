/**
 * Server bootstrap: serves client + Socket.IO.
 */

import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import express from "express";
import { Server } from "socket.io";

import { createGameServer } from "./runtime/gameServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);

// Serve static client
const clientPath = join(__dirname, "..", "client");
const sharedPath = join(__dirname, "..", "shared");
const testingPath = join(__dirname, "..", "testing");
app.use(express.static(clientPath));
app.use("/shared", express.static(sharedPath));
app.use("/testing", express.static(testingPath));

const io = new Server(httpServer, {
  cors: { origin: "*" },
});

createGameServer(io);

// SPA fallback: serve index.html for non-file routes
app.get("*", (_req, res) => {
  res.sendFile(join(clientPath, "index.html"));
});

httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
