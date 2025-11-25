const express = require("express");

const http = require("http");

const { Server } = require("socket.io");



const app = express();

const server = http.createServer(app);



const io = new Server(server, {

  cors: { origin: "*" }

});



let onlineUsers = 0;

let waitingUser = null;



io.on("connection", (socket) => {

  console.log("Connected:", socket.id);

  onlineUsers++;

  io.emit("online_users", onlineUsers);



  socket.on("set_name", (name) => {

    socket.data.name = name;

  });



  socket.on("find_partner", () => {

    if (!waitingUser) {

      waitingUser = socket;

      socket.emit("waiting");

      return;

    }



    const partner = waitingUser;

    waitingUser = null;



    const roomId = socket.id + "#" + partner.id;



    socket.join(roomId);

    partner.join(roomId);



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



  socket.on("signal", ({ roomId, data }) => {

    socket.to(roomId).emit("signal", { data });

  });



  socket.on("disconnect", () => {

    onlineUsers--;

    io.emit("online_users", onlineUsers);



    if (waitingUser && waitingUser.id === socket.id) {

      waitingUser = null;

    }

  });

});



const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log("Server running on " + PORT));

