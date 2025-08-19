import { io, Socket } from "socket.io-client";

// Development URLs
const LOCAL_URL = "http://localhost:4000";
const TUNNEL_URL = "https://5klclrqb-4000.asse.devtunnels.ms"; // DevTunnels URL
const NETWORK_URL = "http://192.168.100.13:4000"; // Update with your actual IP

// Use local for development, DevTunnels for production
export const SOCKET_URL = process.env.NODE_ENV === "production" 
  ? TUNNEL_URL 
  : LOCAL_URL;

let socket: Socket | null = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["polling", "websocket"], // Prioritize polling for tunnels
      path: "/socket.io",
      withCredentials: false,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000,
      upgrade: true,
      rememberUpgrade: false,
      extraHeaders: { "x-client": "expo" },
    });

    socket.on("connect", () => {
      console.log("[socket] connected", socket?.id);
    });
    socket.on("disconnect", (reason) => {
      console.log("[socket] disconnect:", reason);
    });
    socket.on("connect_error", (err: any) => {
      console.log("[socket] connect_error:", err?.message || err);
    });
    socket.io.on("error", (err: any) => {
      console.log("[socket.io] error:", err?.message || err);
    });
    socket.io.on("reconnect_error", (err: any) => {
      console.log("[socket.io] reconnect_error:", err?.message || err);
    });
  }
  return socket;
};
