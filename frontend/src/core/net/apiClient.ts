import { API_BASE_URL } from '../../services/config';
import { eventStore } from '../telemetry/eventStore';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface ApiRequestOptions extends RequestInit {
    method?: HttpMethod;
    body?: any; // Auto-stringified if JSON
    timeoutMs?: number;
}

class ApiClient {
    private async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T | null> {
        const startTime = performance.now();
        const { method = 'GET', body, timeoutMs = 15000, ...customHeaders } = options;

        eventStore.emit('INFO', 'REST', 'API_CALL', `Requesting ${method} ${endpoint}`, { method, endpoint });

        const url = `${API_BASE_URL}${endpoint}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const fetchOptions: RequestInit = {
                method,
                cache: 'no-store',
                headers: {
                    'Content-Type': 'application/json',
                    ...customHeaders.headers,
                },
                signal: controller.signal,
                ...customHeaders,
            };

            if (body && (method === 'POST' || method === 'PUT')) {
                fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
            }

            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            const latencyMs = Math.round(performance.now() - startTime);

            if (!response.ok) {
                eventStore.emit('ERROR', 'REST', 'API_FAIL', `HTTP falhou: ${response.status} ${response.statusText} em ${endpoint}`, { status: response.status, latencyMs });
                console.warn(`[apiClient] API Error ${response.status} at ${endpoint}: ${response.statusText}`);
                return null;
            }

            let data;
            try {
                data = await response.json();
            } catch (jsonErr) {
                // Return wasn't JSON
                eventStore.emit('ERROR', 'REST', 'CONTRACT_ERROR', `Falha ao fazer parse de JSON na resposta de ${endpoint}`);
                return null;
            }

            eventStore.emit('INFO', 'REST', 'API_OK', `HTTP sucesso em ${endpoint} (${latencyMs}ms)`, { latencyMs });
            return data as T;

        } catch (err: any) {
            clearTimeout(timeoutId);
            const latencyMs = Math.round(performance.now() - startTime);

            if (err.name === 'AbortError') {
                eventStore.emit('ERROR', 'REST', 'API_FAIL', `Timeout da request em ${endpoint} após ${timeoutMs}ms`, { latencyMs, timeout: true });
            } else {
                eventStore.emit('ERROR', 'REST', 'API_FAIL', `Erro de rede/conexão em ${endpoint}: ${err.message}`, { latencyMs, error: err.message });
            }
            console.error(`[apiClient] Network Error at ${endpoint}:`, err);
            return null;
        }
    }

    public get<T>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'>) {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    public post<T>(endpoint: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
        return this.request<T>(endpoint, { ...options, method: 'POST', body });
    }

    public put<T>(endpoint: string, body?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
        return this.request<T>(endpoint, { ...options, method: 'PUT', body });
    }

    public delete<T>(endpoint: string, options?: Omit<ApiRequestOptions, 'method'>) {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }
}

// Singleton export
export const apiClient = new ApiClient();
