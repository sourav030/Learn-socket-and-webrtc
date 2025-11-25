const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// --- STORE ---
let onlineUsers = 0;
let waitingUser = null;

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);
  onlineUsers++;
  io.emit("online_users", onlineUsers);

  // store name on socket
  socket.on("set_name", (name) => {
    socket.data.name = name;
  });

  // find partner
  socket.on("find_partner", () => {
    if (!waitingUser) {
      waitingUser = socket;
      socket.emit("waiting");
    } else {
      const partner = waitingUser;
      waitingUser = null;

      const roomId = socket.id + "#" + partner.id;

      socket.join(roomId);
      partner.join(roomId);

      io.to(roomId).emit("partner_found", {
        roomId,
        users: [
          { id: socket.id, name: socket.data.name },
          { id: partner.id, name: partner.data.name }
        ]
      });
    }
  });

  // WebRTC signal forwarding
  socket.on("signal", ({ roomId, data }) => {
    socket.to(roomId).emit("signal", { data });
  });

  // Next / Leave
  socket.on("leave", ({ roomId }) => {
    socket.leave(roomId);
    socket.to(roomId).emit("partner_left");
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    onlineUsers--;
    io.emit("online_users", onlineUsers);

    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
    }
  });
});

server.listen(3000, () => console.log("Server running on 3000"));
