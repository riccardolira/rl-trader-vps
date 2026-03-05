# Diagramas: Strategy Plan V3

Este documento contém os diagramas técnicos de suporte ao plano da camada de estratégias.

## 1. Flowchart: Fluxo de Dados e Decisão

Como a informação viaja desde a chegada do preço até a execução.

```mermaid
flowchart TD
    Tick[Market Data (Tick/Candle)] --> Scanner
    
    subgraph Intelligence Layer
        Scanner -->|Loop| StrategyA[Trend Strategy]
        Scanner -->|Loop| StrategyB[RSI Strategy]
        StrategyA -->|Score & Dir| Aggregator[Conflict Solver]
        StrategyB -->|Score & Dir| Aggregator
    end
    
    Aggregator -->|Winning Signal| EventBus((Event Bus))
    
    EventBus -->|SIGNAL_GENERATED| Arbiter[Arbiter Service]
    
    subgraph Decision Layer
        Arbiter -->|Check Preferences| Draft{Is Valid?}
        Draft -- Yes --> Guardian[Guardian Service]
        Draft -- No --> Ignore[Log & Ignore]
        
        Guardian -->|Check Risk| Approved{Safe?}
        Approved -- Yes --> Execution[Execution Service]
        Approved -- No --> Reject[Log Rejection]
    end
    
    Execution -->|Draft -> Order| MT5[MT5 Adapter]
```

## 2. Sequence Diagram: Ciclo de Vida do Sinal

O passo-a-passo temporal de um sinal de sucesso.

```mermaid
sequenceDiagram
    participant M as Market (MT5)
    participant S as Scanner
    participant ST as Strategy (Trend)
    participant B as EventBus
    participant A as Arbiter
    participant G as Guardian
    
    M->>S: New Candle (H1)
    S->>S: Update Internal Cache
    
    loop Intelligence Strategy
        S->>ST: calculate(prices)
        ST->>ST: Calc SMA20 vs Price
        ST-->>S: Signal(BUY, Score=85)
    end
    
    Note over S: Conflict Resolution (Winner: BUY)
    S->>B: Pub SIGNAL_GENERATED
    
    B->>A: On Signal
    A->>A: Check User Config (Profile)
    A->>B: Pub ORDER_DRAFT
    
    B->>G: On Draft
    G->>G: Check Hard Risk Cap
    G->>B: Pub ORDER_APPROVED
    
    Note right of G: Ready for Execution
```

## 3. Class Diagram: Contrato de Estratégia

A estrutura das classes Python planejadas.

```mermaid
classDiagram
    class IStrategy {
        <<Interface>>
        +name: str
        +calculate(market_data: DataFrame) SignalResult
    }
    
    class SignalResult {
        +direction: Enum [BUY, SELL, NEUTRAL]
        +score: int [0-100]
        +metadata: dict
        +timestamp: datetime
    }
    
    class TrendAnalysis {
        +period: int = 20
        +threshold: float = 0.001
        +calculate() SignalResult
    }
    
    class MeanReversion {
        +period: int = 14
        +overbought: int = 70
        +oversold: int = 30
        +calculate() SignalResult
    }
    
    IStrategy <|-- TrendAnalysis
    IStrategy <|-- MeanReversion
    IStrategy ..> SignalResult : Produces
```
