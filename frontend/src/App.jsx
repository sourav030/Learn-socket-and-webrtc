import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://learn-socket-and-webrtc.onrender.com");

export default function App() {
  const [name, setName] = useState("");
  const [screen, setScreen] = useState("name"); // name | chat
  const [online, setOnline] = useState(0);
  const [status, setStatus] = useState("idle");
  const [roomId, setRoomId] = useState(null);
  const [partner, setPartner] = useState("");

  const localVideo = useRef();
  const remoteVideo = useRef();
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  // socket listeners
  useEffect(() => {
    socket.on("online_users", (count) => setOnline(count));

    socket.on("waiting", () => {
      setStatus("Waiting for partner...");
    });

    socket.on("partner_found", async ({ roomId, users }) => {
      setRoomId(roomId);
      setStatus("Connected!");

      const otherUser = users.find(u => u.name !== name);
      setPartner(otherUser?.name || "Stranger");

      await startWebRTC();
    });

    socket.on("signal", async ({ data }) => {
      const pc = pcRef.current;
      if (!pc) return;

      if (data.type === "offer") {
        await pc.setRemoteDescription(data);
        const ans = await pc.createAnswer();
        await pc.setLocalDescription(ans);
        socket.emit("signal", { roomId, data: ans });
      } else if (data.type === "answer") {
        await pc.setRemoteDescription(data);
      } else if (data.candidate) {
        pc.addIceCandidate(data);
      }
    });

    socket.on("partner_left", () => {
      endCall();
      setStatus("Partner left. Click Next.");
    });
  }, [name, roomId]);

  // START CHAT
  const startChat = () => {
    socket.emit("set_name", name);
    setScreen("chat");
  };

  // FIND PARTNER / NEXT
  const findPartner = () => {
    endCall();
    setPartner("");
    socket.emit("find_partner");
  };

  // WebRTC setup
  async function startWebRTC() {
    localStreamRef.current = await navigator.mediaDevices.getUserMedia({
      video: true, audio: true
    });

    localVideo.current.srcObject = localStreamRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pcRef.current = pc;

    localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("signal", { roomId, data: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      remoteVideo.current.srcObject = e.streams[0];
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("signal", { roomId, data: offer });
  }

  function endCall() {
    if (pcRef.current) pcRef.current.close();
    pcRef.current = null;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
  }

  // UI SCREENS
  if (screen === "name") {
    return (
      <div style={{ textAlign: "center", marginTop: "150px" }}>
        <h2>Enter Your Name</h2>
        <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Your name..." />
        <br /><br />
        <button onClick={startChat}>Start Chat</button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center" }}>
      <h3>Online Users: {online}</h3>
      <h2>Status: {status}</h2>
      <h3>Partner: {partner}</h3>

      <button onClick={findPartner}>Next</button>

      <div style={{ display: "flex", justifyContent: "center", marginTop: 30 }}>
        <video ref={localVideo} autoPlay muted playsInline style={{ width: "300px", background:"#000" }} />
        <video ref={remoteVideo} autoPlay playsInline style={{ width: "300px", marginLeft: 20, background:"#000" }} />
      </div>
    </div>
  );
}
