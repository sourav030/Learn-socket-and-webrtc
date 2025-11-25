const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// ------ STORE ------
let onlineUsers = 0;
let waitingUser = null; // Stores the one who is waiting

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);
  onlineUsers++;

  io.emit("online_users", onlineUsers);

  // Store user's name
  socket.on("set_name", (name) => {
    socket.data.name = name;
  });

  // FIND PARTNER
  socket.on("find_partner", () => {
    if (!waitingUser) {
      // Nobody waiting → this user waits
      waitingUser = socket;
      socket.emit("waiting");
      return;
    }

    // Someone is waiting → match them
    const partner = waitingUser;
    waitingUser = null;

    const roomId = socket.id + "#" + partner.id;

    socket.join(roomId);
    partner.join(roomId);

    // Send roles (caller / receiver)
    io.to(socket.id).emit("partner_found", {
      roomId,
      isCaller: true,
      partnerName: partner.data.name
    });

    io.to(partner.id).emit("partner_found", {
      roomId,
      isCaller: false,
      partnerName: socket.data.name
    });
  });

  // SIGNAL HANDLING (WebRTC)
  socket.on("signal", ({ roomId, data }) => {
    socket.to(roomId).emit("signal", { data });
  });

  // LEAVE ROOM
  socket.on("leave", ({ roomId }) => {
    socket.leave(roomId);
    socket.to(roomId).emit("partner_left");
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    onlineUsers--;
    io.emit("online_users", onlineUsers);

    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
    }
  });
});

// ---------- RENDER PORT FIX ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on " + PORT));
