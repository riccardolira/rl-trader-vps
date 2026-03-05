# 1. Visão Geral da Arquitetura - RL Trader V3

## Introdução
O **RL Trader V3** é construído sobre um "Chassis" de nível profissional, focado em **Segurança (Safety First)** e **Auditabilidade Total**. Diferente de versões anteriores, o V3 separa estritamente as responsabilidades do sistema, garantindo que a lógica de trading, a execução de ordens e a interface do usuário operem de forma desacoplada e resiliente.

## Princípios Fundamentais
1.  **Safety First:** Nenhuma ordem é enviada ao mercado sem passar pelo **Guardian** (Sistema de Risco).
2.  **Transparência Radical:** O estado interno do robô é visível em tempo real via WebSocket para o Dashboard.
3.  **Isolamento de Falhas:** O MetaTrader 5 roda em um processo separado para evitar que travamentos da plataforma derrubem o robô.
4.  **Clean Architecture:** O código é organizado em camadas (Domínio, Aplicação, Infraestrutura).

## Stack Tecnológico
*   **Backend:** Python 3.11+ (FastAPI, Multiprocessing)
*   **Frontend:** React (Vite, Tailwind CSS, Shadcn/UI)
*   **Database:** SQLite (Event Store & Cache)
*   **Plataforma:** MetaTrader 5 (via `mt5_worker` isolado)

---

## Diagrama de Containers (C4)

Este diagrama mostra como os principais componentes do sistema se comunicam.

```mermaid
flowchart TB
    subgraph Client [Interface do Usuário]
        Browser[Dashboard React/Vite]
    end

    subgraph VPS [Servidor Windows]
        direction TB
        
        API[API Gateway (FastAPI)]
        EventBus(Event Bus / SQLite)
        
        subgraph Engine [Trading Engine (Python)]
            Scanner[Scanner Service]
            Arbiter[Arbiter Service]
            Guardian[Guardian Service]
            Execution[Execution Service]
            Watchdog[Watchdog & Health]
        end
        
        subgraph Isolation [Camada de Isolamento]
            ClientWorker[MT5 Client Proxy]
            MT5Worker[MT5 Worker Process]
        end
        
        MT5[MetaTrader 5 Terminal]
    end

    Browser <-->|WebSocket/REST| API
    API <--> EventBus
    Engine <--> EventBus
    
    Engine -->|Solicita Dados| ClientWorker
    ClientWorker <-->|IPC/Queue| MT5Worker
    MT5Worker <-->|DLL Call| MT5
    MT5 <-->|TCP/IP| Broker
```

### Componentes Chave

1.  **API Gateway:** Ponto de entrada para o Frontend. Gerencia conexões WebSocket e endpoints REST.
2.  **Trading Engine:** O "cérebro" do sistema.
    *   **Scanner:** Monitora ativos e gera sinais técnicos.
    *   **Arbiter:** Decide se um sinal deve virar uma ordem (baseado em preferências).
    *   **Guardian:** Valida risco financeiro (Hard Risk Cap).
    *   **Execution:** Gerencia o envio seguro da ordem.
3.  **MT5 Worker:** Processo isolado que fala com o terminal MT5. Se ele travar, o Watchdog o reinicia automaticamente sem afetar o resto do sistema.
