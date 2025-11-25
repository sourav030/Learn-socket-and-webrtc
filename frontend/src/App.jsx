import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://learn-socket-and-webrtc-1.onrender.com");

export default function App() {
  const [name, setName] = useState("");
  const [screen, setScreen] = useState("name");
  const [online, setOnline] = useState(0);
  const [status, setStatus] = useState("idle");
  const [partner, setPartner] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [isCaller, setIsCaller] = useState(false);

  const localVideo = useRef();
  const remoteVideo = useRef();
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  // --- SOCKET LISTENERS ---
  useEffect(() => {
    socket.on("online_users", (count) => setOnline(count));

    socket.on("waiting", () => {
      setStatus("Waiting for a partner...");
    });

    socket.on("partner_found", async (data) => {
      console.log("Partner found:", data);

      setRoomId(data.roomId);
      setPartner(data.partnerName);
      setIsCaller(data.isCaller);
      setStatus("Connected!");

      await startWebRTC(data.isCaller);
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
        await pc.addIceCandidate(data);
      }
    });

    socket.on("partner_left", () => {
      endCall();
      setStatus("Partner left. Click Next.");
    });
  }, [roomId]);

  // START CHAT
  const startChat = () => {
    socket.emit("set_name", name);
    setScreen("chat");
  };

  // NEXT / FIND NEW PARTNER
  const findPartner = () => {
    endCall();
    setPartner("");
    socket.emit("find_partner");
  };

  // --- WEBRTC ---
  async function startWebRTC(isCaller) {
    localStreamRef.current = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    localVideo.current.srcObject = localStreamRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pcRef.current = pc;

    // Send local tracks
    localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));

    // Receive remote stream
    pc.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { roomId, data: event.candidate });
      }
    };

    // --------------------------
    // Caller sends OFFER
    // --------------------------
    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("signal", { roomId, data: offer });
    }
  }

  // END CALL
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
      <div style={{ textAlign: "center", marginTop: 150 }}>
        <h2>Enter Your Name</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name..."
        />
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
        <video
          ref={localVideo}
          autoPlay
          muted
          playsInline
          style={{ width: 300, background: "#000" }}
        />
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          style={{ width: 300, marginLeft: 20, background: "#000" }}
        />
      </div>
    </div>
  );
}
