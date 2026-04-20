const http = require("http");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3001;
const SECRET = process.env.SCREENAPP_JWT_SECRET || "supersecret123";
const INDEX_FILE = path.join(__dirname, "public", "index.html");
const clients = {};
const server = http.createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    try {
      const html = fs.readFileSync(INDEX_FILE, "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch (error) {
      sendJson(res, 500, { error: "Nu s-a putut incarca aplicatia" });
    }

    return;
  }

  if (req.method === "POST" && req.url === "/api/token") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      let data;

      try {
        data = JSON.parse(body);
      } catch (error) {
        sendJson(res, 400, { error: "JSON invalid" });
        return;
      }

      if (!data.username) {
        sendJson(res, 400, { error: "Username lipsa" });
        return;
      }

      const token = jwt.sign({ username: data.username }, SECRET, {
        expiresIn: "1h"
      });

      sendJson(res, 200, { token });
    });

    return;
  }

  sendJson(res, 404, { error: "Not found" });
});
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Client conectat");

  ws.on("message", (message) => {
    let data;

    try {
      data = JSON.parse(message.toString());
    } catch (error) {
      ws.send(JSON.stringify({ error: "Mesaj JSON invalid" }));
      return;
    }

    if (data.type === "join" && data.username) {
      const username = data.username.trim();
      const roomId = data.roomId || "main";

      if (!username) {
        ws.send(JSON.stringify({ error: "Username lipsa" }));
        return;
      }

      const currentUsername = getUsernameBySocket(ws);
      const existingClient = clients[username];

      if (
        existingClient &&
        existingClient.ws !== ws &&
        existingClient.ws.readyState === WebSocket.OPEN
      ) {
        ws.send(JSON.stringify({
          type: "join-error",
          error: "Numele este deja folosit"
        }));
        return;
      }

      if (currentUsername && currentUsername !== username) {
        const previousRoomId = clients[currentUsername]?.roomId;
        delete clients[currentUsername];

        if (previousRoomId) {
          broadcastParticipants(previousRoomId);
        }
      }

      clients[username] = {
        ws,
        roomId
      };

      ws.send(JSON.stringify({
        type: "join-success",
        username,
        roomId
      }));
      broadcastParticipants(roomId);
      return;
    }

    if (data.type === "message" && data.to && data.text) {
      const sender = getClientBySocket(ws);
      const recipient = clients[data.to];

      if (
        !sender ||
        !recipient ||
        recipient.roomId !== sender.roomId ||
        recipient.ws.readyState !== WebSocket.OPEN
      ) {
        ws.send(JSON.stringify({ error: "Utilizatorul nu exista" }));
        return;
      }

      recipient.ws.send(
        JSON.stringify({
          from: getUsernameBySocket(ws),
          text: data.text
        })
      );
      return;
    }

    if (
      (data.type === "offer" && data.to && data.offer) ||
      (data.type === "answer" && data.to && data.answer) ||
      (data.type === "ice" && data.to && data.candidate) ||
      (data.type === "control-request" && data.to) ||
      (data.type === "control-granted" && data.to) ||
      (data.type === "control-revoked" && data.to) ||
      (data.type === "access-request" && data.to) ||
      (data.type === "access-approved" && data.to) ||
      (data.type === "access-denied" && data.to) ||
      (data.type === "remote-mouse" && data.to) ||
      (data.type === "remote-keyboard" && data.to) ||
      (data.type === "remote-scroll" && data.to) ||
      (data.type === "stop-share" && data.to)
    ) {
      const sender = getClientBySocket(ws);
      const recipient = clients[data.to];

      if (
        !sender ||
        !recipient ||
        recipient.roomId !== sender.roomId ||
        recipient.ws.readyState !== WebSocket.OPEN
      ) {
        ws.send(JSON.stringify({ error: "Utilizatorul nu exista" }));
        return;
      }

      recipient.ws.send(
        JSON.stringify({
          ...data,
          from: getUsernameBySocket(ws)
        })
      );
      return;
    }

    ws.send(JSON.stringify({ error: "Mesaj invalid" }));
  });

  ws.on("close", () => {
    const username = getUsernameBySocket(ws);

    if (username && clients[username]) {
      const roomId = clients[username].roomId;
      delete clients[username];
      broadcastParticipants(roomId);
    }
  });
});

function getUsernameBySocket(targetSocket) {
  for (const username in clients) {
    if (clients[username].ws === targetSocket) {
      return username;
    }
  }

  return null;
}

function getClientBySocket(targetSocket) {
  const username = getUsernameBySocket(targetSocket);

  if (!username) {
    return null;
  }

  return clients[username];
}

function broadcastParticipants(roomId) {
  if (!roomId) {
    return;
  }

  const participants = Object.keys(clients).filter((username) => {
    const client = clients[username];
    return client.roomId === roomId && client.ws.readyState === WebSocket.OPEN;
  });

  participants.forEach((username) => {
    clients[username].ws.send(
      JSON.stringify({
        type: "participants",
        roomId,
        participants
      })
    );
  });
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server pornit pe portul", PORT);
});

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
