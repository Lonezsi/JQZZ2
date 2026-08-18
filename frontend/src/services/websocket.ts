/**
 * @deprecated This service is superseded by WebSocketContext + hooks/useWebSocket.
 * Use the WebSocketContext provider and the useWebSocket hook instead.
 *
 * This file is kept only to avoid breaking any lingering imports.
 */

// Re-export the hook for backward compatibility
export { useWebSocket } from "../contexts/WebSocketContext";
