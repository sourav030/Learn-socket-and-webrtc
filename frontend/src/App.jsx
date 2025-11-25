import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// LOCAL OR DEPLOYED BACKEND
const socket = io("https://learn-socket-and-webrtc-1.onrender.com");
// const socket = io("https://learn-socket-and-webrtc-1.onrender.com");

export default function App() {
  const [name, setName] = useState("");
  const [screen, setScreen] = useState("name");
  const [online, setOnline] = useState(0);
  const [status, setStatus] = useState("idle");
  const [partner, setPartner] = useState("");
  const [roomId, setRoomId] = useState(null);
  const [isCaller, setIsCaller] = useState(false);

  const remoteVideo = useRef();
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);

  // SOCKET LISTENERS
  useEffect(() => {
    socket.on("online_users", (count) => setOnline(count));

    socket.on("waiting", () => setStatus("Finding partner..."));

    socket.on("partner_found", async (data) => {
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

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("signal", { roomId, data: answer });

      } else if (data.type === "answer") {
        await pc.setRemoteDescription(data);

      } else if (data.candidate) {
        await pc.addIceCandidate(data);
      }
    });

    socket.on("partner_left", () => {
      endCall();
      setStatus("Partner left. Click Next.");
      remoteVideo.current.srcObject = null;
    });
  }, []);

  const startChat = () => {
    if (!name.trim()) return alert("Enter your name first!");

    socket.emit("set_name", name);
    setScreen("chat");
    findPartner();
  };

  const findPartner = () => {
    endCall();
    setPartner("");
    setStatus("Searching...");
    socket.emit("find_partner");
  };

  // --- WEBRTC ---
  async function startWebRTC(isCaller) {
    localStreamRef.current = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pcRef.current = pc;

    localStreamRef.current.getTracks().forEach(track =>
      pc.addTrack(track, localStreamRef.current)
    );

    pc.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("signal", { roomId, data: event.candidate });
      }
    };

    if (isCaller) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("signal", { roomId, data: offer });
    }
  }

  const endCall = () => {
    if (pcRef.current) pcRef.current.close();
    pcRef.current = null;

    if (localStreamRef.current)
      localStreamRef.current.getTracks().forEach((t) => t.stop());
  };

  // --- UI ---
  if (screen === "name") {
    return (
      <div style={styles.centerScreen}>
        <h1 style={styles.title}>Video Chat</h1>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name..."
          style={styles.input}
        />
        <button onClick={startChat} style={styles.button}>Start</button>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <div style={styles.topBar}>
        <span>Online Users: {online}</span>
        <span>Status: {status}</span>
        <span>Partner: {partner || "None"}</span>
        <button onClick={findPartner} style={styles.nextBtn}>Next</button>
      </div>

      <div style={styles.videoContainer}>
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          style={styles.remoteVideo}
        />
      </div>
    </div>
  );
}

/* ---------- STYLES ---------- */

const styles = {
  centerScreen: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    background: "#0b0b0b",
    color: "white"
  },
  title: { fontSize: 32, marginBottom: 20 },
  input: {
    padding: "10px 15px",
    fontSize: 18,
    borderRadius: 8,
    border: "1px solid #555",
    outline: "none",
    width: 250,
    marginBottom: 20,
  },
  button: {
    padding: "10px 25px",
    fontSize: 18,
    borderRadius: 8,
    background: "#1e90ff",
    border: "none",
    color: "white",
    cursor: "pointer"
  },
  app: {
    background: "#111",
    height: "100vh",
    color: "white",
    paddingTop: 10
  },
  topBar: {
    display: "flex",
    justifyContent: "space-around",
    padding: 15,
    background: "#1a1a1a",
    borderBottom: "1px solid #333",
    fontSize: 16
  },
  nextBtn: {
    padding: "6px 14px",
    background: "red",
    border: "none",
    color: "white",
    borderRadius: 8,
    cursor: "pointer"
  },
  videoContainer: {
    display: "flex",
    justifyContent: "center",
    marginTop: 40
  },
  remoteVideo: {
    width: 420,
    height: 300,
    background: "black",
    borderRadius: 12,
    border: "2px solid #333"
  }
};
