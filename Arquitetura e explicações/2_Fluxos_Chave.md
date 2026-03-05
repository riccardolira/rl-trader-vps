# 2. Fluxos Críticos do Sistema

Esta seção detalha como a informação flui dentro do **RL Trader V3**, desde a detecção de uma oportunidade de mercado até a confirmação de execução da ordem.

## Pipeline de Trading (O Caminho da Ordem)

O sistema segue um fluxo linear e auditável para cada decisão de trading. Nada acontece "mágicamente"; cada passo é um evento registrado.

### Etapas do Pipeline

1.  **Sinalização (Scanner):** O Scanner analisa o mercado (Ticks/Candles) e emite um evento `SIGNAL_GENERATED` se encontrar uma configuração técnica válida (ex: Cruzamento de médias).
2.  **Arbitragem (Arbiter):** O Arbiter recebe o sinal e verifica se ele se alinha com as configurações do robô (ex: Horário permitido, Pares permitidos). Se aprovado, emite `ORDER_DRAFT`.
3.  **Guardião (Guardian):** O "Risco Central". Calcula o impacto financeiro do trade.
    *   Verifica saldo, margem e exposição atual.
    *   Calcula o lote baseado no risco monetário (ex: Max €50 loss).
    *   Se aprovado, emite `ORDER_APPROVED` com um snapshot de auditoria.
4.  **Execução (Executor):** Recebe a ordem aprovada e a envia para o Worker do MT5. Garante que a ordem não seja duplicada (Idempotência).

---

## Diagrama de Sequência (Fluxo de Compra)

```mermaid
sequenceDiagram
    autonumber
    participant S as Scanner
    participant A as Arbiter
    participant G as Guardian
    participant E as Execution
    participant B as EventBus
    participant M as MT5 Worker

    Note over S: Loop de Análise de Mercado
    S->>S: Detecta Oportunidade (Sinal)
    S->>B: Publica SIGNAL_GENERATED
    
    B->>A: Recebe SINAL
    Note over A: Filtra (Horário, Ativo, Config)
    A->>B: Publica ORDER_DRAFT (Se OK)
    
    B->>G: Recebe DRAFT
    Note over G: Check Risco & Saldo
    alt REJEITADO (Risco Excessivo)
        G->>B: Publica ORDER_REJECTED
    else APROVADO
        G->>B: Publica ORDER_APPROVED (c/ AuditID)
    end
    
    B->>E: Recebe APPROVED
    Note over E: Trava Inflight (Evita Duplo Click)
    E->>M: Envia Ordem (Queue)
    M->>M: Envia para Broker (MT5)
    M-->>E: Retorno (Sucesso/Erro)
    E->>B: Publica ORDER_FILLED
```

## Fluxo de Dados (Data Ingestion)

Para que o Scanner funcione, ele precisa de dados atualizados. O fluxo de dados é otimizado para não sobrecarregar o MT5.

1.  **Tick Data:** O MT5 Worker envia ticks em tempo real via fila de alta velocidade.
2.  **Candles (Histórico):** Solicitados sob demanda ou em batch na inicialização.
3.  **Cache:** O Python mantém uma cópia local do estado do mercado (Market Snapshot) para que o Scanner não precise consultar o MT5 a cada milissegundo.

### Atualização de Estado

```mermaid
flowchart LR
    MT5[MT5 Terminal] -->|Ticks| Worker[MT5 Worker]
    Worker -->|Queue| Cache[Market State Cache]
    Cache -->|Read| Scanner[Scanner Logic]
    Cache -->|Read| GUI[Dashboard Frontend]
```
