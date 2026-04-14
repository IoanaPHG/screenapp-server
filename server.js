const http = require("http");
const jwt = require("jsonwebtoken");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3001;
const SECRET = "supersecret123";
const clients = {};
const server = http.createServer((req, res) => {
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
      clients[data.username] = ws;
      return;
    }

    if (data.type === "message" && data.to && data.text) {
      const recipient = clients[data.to];

      if (!recipient || recipient.readyState !== WebSocket.OPEN) {
        ws.send(JSON.stringify({ error: "Utilizatorul nu exista" }));
        return;
      }

      recipient.send(
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
      (data.type === "ice" && data.to && data.candidate)
    ) {
      const recipient = clients[data.to];

      if (!recipient || recipient.readyState !== WebSocket.OPEN) {
        ws.send(JSON.stringify({ error: "Utilizatorul nu exista" }));
        return;
      }

      recipient.send(JSON.stringify(data));
      return;
    }

    ws.send(JSON.stringify({ error: "Mesaj invalid" }));
  });

  ws.on("close", () => {
    const username = getUsernameBySocket(ws);

    if (username) {
      delete clients[username];
    }
  });
});

function getUsernameBySocket(targetSocket) {
  for (const username in clients) {
    if (clients[username] === targetSocket) {
      return username;
    }
  }

  return null;
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server pornit pe portul", PORT);
});

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}
