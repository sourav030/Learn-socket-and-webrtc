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

  const remoteVideo = useRef();
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  
  // FIX 1: Use a Ref to keep track of roomId inside socket listeners
  const roomIdRef = useRef(null); 

  useEffect(() => {
    socket.on("online_users", (count) => setOnline(count));
    socket.on("waiting", () => setStatus("Finding partner..."));

    socket.on("partner_found", async (data) => {
      setRoomId(data.roomId);
      roomIdRef.current = data.roomId; // Update the Ref
      setPartner(data.partnerName);
      setIsCaller(data.isCaller);
      setStatus("Connected!");

      await startWebRTC(data.isCaller, data.roomId);
    });

    socket.on("signal", async ({ data }) => {
      const pc = pcRef.current;
      // If signal arrives before PC is made, we can't handle it. 
      // (The reordering in startWebRTC below fixes this for most cases)
      if (!pc) return; 

      try {
        if (data.type === "offer") {
          await pc.setRemoteDescription(data);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          // FIX 1 APPLIED: Use roomIdRef.current instead of state
          socket.emit("signal", { roomId: roomIdRef.current, data: answer });

        } else if (data.type === "answer") {
          await pc.setRemoteDescription(data);

        } else if (data.candidate) {
          await pc.addIceCandidate(data);
        }
      } catch (error) {
        console.error("Signaling error:", error);
      }
    });

    socket.on("partner_left", () => {
      endCall();
      setStatus("Partner left. Click Next.");
      if (remoteVideo.current) remoteVideo.current.srcObject = null;
    });
    
    // Cleanup listener on unmount
    return () => {
      socket.off("signal");
      socket.off("partner_found");
      // ... remove others if needed
    };
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
  // FIX 2: Pass roomId directly to avoid any state issues
  async function startWebRTC(isCaller, currentRoomId) {
    // FIX 3: Initialize PeerConnection BEFORE getUserMedia.
    // This ensures pcRef.current exists even if camera permission takes time,
    // so we don't miss offers arriving early.
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    pcRef.current = pc;

    pc.ontrack = (event) => {
        console.log("Track received:", event.streams[0]);
        if (remoteVideo.current) {
            remoteVideo.current.srcObject = event.streams[0];
        }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Use the passed currentRoomId or the Ref
        socket.emit("signal", { roomId: roomIdRef.current, data: event.candidate });
      }
    };

    // Now get media
    try {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        // Add tracks to the already created PC
        localStreamRef.current.getTracks().forEach(track =>
            pc.addTrack(track, localStreamRef.current)
        );

        // Only create offer if we are the caller
        if (isCaller) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("signal", { roomId: currentRoomId, data: offer });
        }
    } catch (err) {
        console.error("Error accessing media devices:", err);
    }
  }

  const endCall = () => {
    if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
    }
    if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    setRoomId(null);
    roomIdRef.current = null;
  };

  // ... UI REMAINS THE SAME ...
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

// Styles (Keep your existing styles)
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