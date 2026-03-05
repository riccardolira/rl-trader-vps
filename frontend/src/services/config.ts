// Define as URLs a partir de variáveis de ambiente.
// Se não informado pelo Vite, utiliza URLs relativas para explorar o Vite Proxy.
export const API_BASE_URL = import.meta.env.VITE_API_BASE || "";

// Calcula dinamicamente a URL de WebSocket relativa ao host atual.
// Ex: se acessado por http://localhost:5173, o protocolo WS será ws://localhost:5173/ws/stream e passará pelo proxy do Vite.
export const WS_URL = import.meta.env.VITE_WS_URL || (
    typeof window !== "undefined"
        ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
        : "ws://localhost:8001/ws"
);
