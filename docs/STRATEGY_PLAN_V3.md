# Strategy Layer Plan (V3) - Master Blueprint

## 1. Visão Geral e Filosofia

Este documento é o **mapa definitivo** para a camada de inteligência do **RL Trader V3**. Ele foi desenhado para transcender os "robôs de varejo" e implementar uma lógica institucional focada na **preservação de capital** e na **vantagem estatística (Alpha)**.

### 1.1 O Princípio "Sniper"
A maioria dos robôs opera com mentalidade de "Metralhadora" (muitos trades, risco alto). O V3 opera com mentalidade "Sniper":
1.  **Observa o Terreno:** (Regime de Mercado)
2.  **Confirma o Vento:** (Timeframe Superior)
3.  **Identifica o Alvo:** (Sinal Técnico)
4.  **Só dispara com Alta Probabilidade:** (Scoring System)

---

## 2. A Arquitetura de Decisão (O Cérebro)

Antes de falarmos de indicadores (RSI/SMA), precisamos entender **como** o robô decide. Não é um simples `if RSI < 30 then BUY`. É um pipeline de avaliação de risco/recompensa.

### 2.1 Pipeline de Decisão (Universe Gate + 8 Passos)
0.  **Active Set (Universe Gate):** carregar `active_symbols` do Asset Selection Service; se vazio/inválido → **NO-ENTRY**.
1.  **Pré-checagens (Hard):** O mercado está aberto? O spread está caro demais? (Se falhar, aborta).
2.  **Regime (Contexto):** O mercado está em **Tendência** ou **Lateral**? (ADX).
3.  **Sinais (Alpha):** As estratégias técnicas calculam seus scores *apenas* para o Active Set.
4.  **Confluência (Confirmação):** O gráfico Diário (D1) concorda com a operação?
5.  **Scoring (Nota Final):** Soma ponderada de tudo acima (0 a 100).
6.  **Seleção (Winner):** Escolhe o módulo com maior Score.
7.  **Gate Final (Filtro):** A nota atingiu o mínimo (ex: 75)?
8.  **Sizing (Aposta):** Quanto dinheiro colocar nessa operação?

---

## 3. Política Oficial de Regime (ADX) e Zonas

O sistema utiliza o indicador **ADX (14)** no timeframe operacional (H1) para definir 4 zonas de comportamento **exclusivas**.

| Zona | Range do ADX | Trend Strategy | Reversion Strategy | Breakout Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **RANGE** | ADX < 20 | **Penalizado** (Soft/Hard*) | **Priorizado** (Boost) | Permitido c/ Squeeze |
| **NEUTRA** | 20 <= ADX < 25 | Permitido (Score) | Permitido (Score) | Permitido (Score) |
| **TREND** | 25 <= ADX < 30 | **Priorizado** (Boost) | Penalizado (Soft) | Permitido (Score) |
| **TREND FORTE** | ADX >= 30 | **Dominante** (Boost++) | **Bloqueado/Hard** | **Dominante** (Boost) |

*Nota:* "Hard" ou "Soft" depende do Modo de Agressividade (vide Seção 5).
*Thresholds:* Valores acima (20, 25, 30) são defaults para Forex Majors. Podem ser ajustados por ativo (ex: GOLD pode exigir ADX > 40).

---

## 4. O "Dream Team" Estratégico (Componentes de Alpha)

### 4.1 Trend Following (Seguidor de Tendência)
-   **Função:** Capturar movimentos longos.
-   **Ferramenta:** SMA 20 + Price Action.
-   **Filtro:** Só opera se ADX >= 20.

### 4.2 Mean Reversion (Retorno à Média)
-   **Função:** Lucrar com correções em laterais.
-   **Ferramenta:** RSI (14) < 30 / > 70.
-   **Filtro:** Bloqueado se ADX >= 30 (Trend Forte).

### 4.3 Volatility Breakout (Rompimento)
-   **Função:** Capturar explosões de volatilidade.
-   **Ferramenta:** Keltner Channel (KC) + Bollinger Bands (BB).
-   **Critérios Objetivos:**
    1.  **Squeeze:** BB Width < Percentil 20 (Compressão).
    2.  **Gatilho:** Fechamento do candle FORA da Banda Superior (Compra) ou Inferior (Venda).
    3.  **Filtro:** Spread Relativo < 0.10 e ATR > Mínimo.

---

## 5. Modos de Operação (Agressividade) e Política Hard/Soft

A definição estrita de quando um sinal é **Bloqueado (HARD)** ou apenas **Penalizado (SOFT)**.

| Regra | Conservador | Balanceado (Default) | Agressivo | Observação |
| :--- | :--- | :--- | :--- | :--- |
| **Spread > Limite** | **HARD** | **HARD** | **HARD** | Proteção de Custo. |
| **Falta de Dados** | **HARD** | **HARD** | **HARD** | Segurança. |
| **MTF Contra (D1)** | **HARD** | **SOFT** (-20) | **SOFT** (-10) | "Não nadar contra a maré". |
| **Regime Mismatch** | **HARD** | **SOFT** (informativo) | **SOFT** (informativo) | Impacto numérico via `score_regime_fit`. |
| **Breakout s/ Squeeze** | **HARD** | **HARD** | **SOFT** (-40) | Breakout sem força é perigoso. |
| **Score < Threshold** | **HARD** | **HARD** | **HARD** | Score final mínimo. |

---

## 6. Scoring (0–100): Componentes, Pesos e Fórmula

### Nota de Implementação (Anti-Duplicidade)
O Regime deve impactar o Score por apenas **um mecanismo principal** para evitar punição dupla. A política oficial do V3 é:
-   `score_regime_fit` é o mecanismo principal para refletir aderência ao regime (boost quando casa, baixo quando não casa).
-   A regra "Regime Mismatch" na Tabela Hard/Soft não aplica penalidade numérica adicional no modo Balanceado/Agressivo.

#### Componentes
-   **`score_signal` (0-100):** A força técnica do setup do módulo (ex: RSI=15 é mais forte que RSI=29).
-   **`score_regime_fit` (0-100):** Quão bem o módulo casa com o ADX atual.
-   **`score_mtf` (-100 a +100):** Alinhamento com D1.
-   **`penalty_microstructure` (0-50):** Custo do Spread e Volatilidade.
-   **`penalty_risk` (0-50):** Fatores de risco (ex: próximo de notícia).

#### Fórmula Oficial
```python
raw_score = (
    (w_signal * score_signal) +
    (w_regime * score_regime_fit) +
    (w_mtf   * score_mtf)
)
final_score = clamp(raw_score - penalty_microstructure - penalty_risk, 0, 100)
```

#### Pesos Iniciais (Sugestão)
-   `w_signal`: 0.5 (O sinal técnico é rei).
-   `w_regime`: 0.3 (O contexto é a rainha).
-   `w_mtf`: 0.2 (O D1 é o conselheiro).

#### Thresholds Finais
-   **Conservador:** Score >= 80
-   **Balanceado:** Score >= 75
-   **Agressivo:** Score >= 70

---

## 7. Seleção do Módulo (Winner) e Resolução de Conflitos

Quando múltiplos módulos geram sinal ao mesmo tempo.

**Regra Oficial:** "Winner Takes All based on Score".
1.  Calcula-se o `FinalScore` para cada módulo (Trend, Reversion, Breakout) independentemente.
2.  O módulo com o MAIOR `FinalScore` é o **Vencedor**.
3.  **Desempate:**
    -   Se diferença < 5 pontos:
        -   Em Regime **Trend**: Vence **Trend**.
        -   Em Regime **Range**: Vence **Reversion**.
        -   Em Regime **Neutra**: Vence o de **Menor Risco** (menor penalty).

---

## 8. Microestrutura: Spread vs ATR (Regra Operacional)

Evita operar quando o custo (Spread) come a margem de lucro (ATR).

### Especificação
-   **Timeframe ATR:** Mesmo do Scan (H1).
-   **Período ATR:** 14.
-   **Fórmula:** `Ratio = (Spread_Points / ATR_Points)`.
-   **Limite Default:** 0.10 (10%). O spread não pode custar mais que 10% da volatilidade média da vela.
-   **Ação:** Se Ratio > Limite -> **HARD BLOCK** (Spread Gate).

---

## 9. Qualidade, Observabilidade e Extras (Fase 2/3)

### 9.1 Confluência Multi-Timeframe (MTF) — *Fase 2*
-   Valida sinal H1 com D1 (EMA 200).
-   Política Hard/Soft definida na Seção 5 (por modo).

### 9.2 Filtro de Notícias (News Filter) — *Fase 3*
-   Shutdown 15 min antes/depois de High Impact.

---

## 10. Subsystems e Contratos (Asset Selection ↔ Strategy Engine ↔ Execution Engine)

### 10.1 Asset Selection Service (ASS)
**Responsabilidade:** Escanear universo, ranquear ativos de forma agnóstica à estratégia, produzir um `Active Set` estável e auditar mudanças.
- **Saídas Obrigatórias:**
    - `active_symbols` (lista final de IDs).
    - `selection_mode` (auto/manual/hybrid).
    - `selection_cycle_id`, `selection_timestamp_utc`.
    - `ranking_table` (Top N com breakdown de pontuação).
    - `decision_log` (added/removed + reason codes).
    - `universe_snapshot` (estado do universo por ativo).

### 10.2 Strategy Engine (SE)
**Responsabilidade:** Para cada símbolo no `Active Set`, gerar candidatos de trade, calcular scores por módulo e escolher o Winner.
- **Saídas:**
    - `trade_candidates` (somente para symbols do `active_symbols`).
    - `scoring_breakdown` (detalhe dos pontos por candidato).
    - `reason_codes` (motivo de rejeição ou aprovação).

### 10.3 Execution Engine (EE)
**Responsabilidade:** Validar ordens finais, calcular sizing, enviar/gerenciar posições e respeitar hard caps.
- **Saídas:**
    - `orders_submitted` / `rejected` (com motivo).
    - `position_state`, `exits`, `ttl`.

### 10.4 Universe Gate (Regra Inviolável)
-   Nenhuma estratégia, scoring, winner selection ou execução pode ocorrer fora de `active_symbols`.
-   O Execution Engine rejeita qualquer ordem cujo símbolo não esteja em `active_symbols` no momento da decisão.
-   **Se `active_symbols` estiver vazio ou inválido:**
    -   Entra em modo **NO-ENTRY** (não abre novas operações).
    -   Mantém apenas gerenciamento de posições já abertas (**managed-only**).
-   **Reason Codes Obrigatórios:**
    -   `NO_ACTIVE_SET` (não carregado/indisponível).
    -   `ACTIVE_SET_EMPTY` (carregado porém vazio por filtros/score).
    -   `SYMBOL_NOT_IN_ACTIVE_SET` (tentativa de operar fora do set).

---

## 11. Parâmetros por Subsystem (Namespaces Separados)

### A) selection.* (Asset Selection)
*Ranking agnóstico, independente de SMA/RSI.*
-   `selection.mode`: `auto` | `manual` | `hybrid`
-   `selection.universe_symbols`: (lista de ativos monitorados)
-   `selection.max_active_symbols`: (int, ex: 10)
-   `selection.min_score_to_enter`: (int)
-   `selection.rebalance_every_minutes`: (int)
-   `selection.min_hold_minutes`: (int, evitar troca frenética)
-   `selection.replace_delta_points`: (int, buffer para troca)
-   `selection.trade_lock_enabled`: (bool, mantém ativo c/ posição aberta)
-   `selection.manual_pin_enabled`: (bool)
-   `selection.snapshot_freeze_enabled`: (bool)
-   `selection.weights.*`: (`w_mkt`, `w_ops`, `w_opp`, `w_pen`)
-   `selection.ui_realtime_scan_enabled`: (bool)

### B) strategy.* (Strategy Engine)
*Atua somente sobre o Active Set.*
-   `strategy.enabled_modules`: (`trend`, `reversion`, `breakout`)
-   `strategy.timeframe_operational`: (ex: `H1`)
-   `strategy.adx_period`: (14)
-   `strategy.regime_policy.thresholds`: (20/25/30 + histerese)
-   `strategy.scoring.weights`: (`w_signal`, `w_regime`, `w_mtf`, etc.)
-   `strategy.thresholds_by_mode`: (80 / 75 / 70)
-   `strategy.winner_tiebreak.delta_points`: (ex: 5)
-   `strategy.logs.verbose_level`: (int)

### C) execution.* (Execution Engine)
*Gerenciamento de Ordens e Risco.*
-   `execution.sizing.enabled`: (bool)
-   `execution.risk_per_trade_pct`: (float)
-   `execution.daily_loss_limit_pct`: (float)
-   `execution.max_lot`, `min_lot`, `lot_step`
-   `execution.spread_gate_ratio_limit`: (0.10)
-   `execution.ttl.enabled`: (bool)
-   `execution.ttl_candles`: (int)
-   `execution.position_management.policy`: (`managed-only` se set vazio)
-   `execution.order_rejection_reasons`: (lista padronizada)

### D) risk.* (Caps Transversais)
-   `risk.hard_risk_cap_usd`: (Valor Monetário Máximo)
-   `risk.max_drawdown_pct`: (Stop Global)
-   `risk.max_open_positions_total`: (int)
-   `risk.max_positions_per_symbol`: (int)

---

## 12. Roadmap de Implementação

### Fase 1: MVP (A Base Sólida)
-   **Requisito Mínimo:** `selection.mode = manual`, `active_symbols` definido (whitelist), Logs do Universe Gate ativos.
-   Implementar `IStrategy`, `TrendStrategy`, `MeanReversionStrategy`.
-   Implementar scoring básico e Logs (Shadow Mode).

### Fase 2: Inteligência & Asset Selection Service
-   Entrega do **Asset Selection Service** (Scan + Ranking + Active Set Manager).
-   UI de Transparência do Universe (Tabela Ranking, Status).
-   Implementar `RegimeFilter` (ADX) e Política de Zonas.
-   Implementar `BreakoutStrategy` e `MTF_Verifier`.

### Fase 3: Refinamento (O Toque Pro)
-   News Filter e Dynamic Sizing.

---

## 13. UI/Transparência (Universe Status)

**Garantia de Auditoria em Tempo Real:**
1.  **Barra Fixa:** `universe_total`, `scanned_count`, `scan_progress`, `scan_rate`, `last_update_utc`, `cycle_id`.
2.  **Tabela Ranking:** Paginada, com filtros e busca.
3.  **Drawer de Detalhes:** Breakdown numérico do score de seleção + reason codes para exclusão.
4.  **Cesta Manual:** Contador `selected_count / K`, pins manuais e flags de `trade_lock`.
5.  **Snapshot Freeze:** Capacidade de congelar o estado visual por `cycle_id`.

---

## 14. Refinamentos de Robustez (Histerese, ATR Exits, TTL)

### 1) Histerese no Regime (Anti “Pisca-Pisca”)
**Objetivo:** Evitar o robô ficar alternando regime/estratégia quando o ADX fica oscilando perto dos thresholds (20/25/30).

**Política Oficial:**
-   O regime passa a ser um **“estado” com memória (stateful)**, não uma classificação instantânea a cada candle.
-   Para mudar de um estado para outro, exige-se cruzar um threshold de **ENTRADA** e um threshold de **SAÍDA** (deadband).

**Defaults (ajustáveis por ativo):**
-   Histerese do ADX: `delta_h = 2` pontos (deadband).

**Regras de Transição (Padrão):**
-   Para ENTRAR em TREND: `ADX >= 25`
-   Para SAIR de TREND (voltar NEUTRA): `ADX <= 23`
-   Para ENTRAR em TREND FORTE: `ADX >= 30`
-   Para SAIR de TREND FORTE (voltar TREND): `ADX <= 28`
-   Para ENTRAR em RANGE: `ADX < 20`
-   Para SAIR de RANGE (voltar NEUTRA): `ADX >= 22`

**Observações:**
-   A zona NEUTRA funciona como “buffer” natural entre RANGE e TREND.
-   O objetivo é estabilidade: o regime não muda toda hora; só muda quando há confirmação.

**Parâmetros Sugeridos:**
-   `enable_regime_hysteresis` (bool, default true)
-   `adx_hysteresis_points` (int, default 2)
-   `adx_entry_trend`, `adx_exit_trend`
-   `adx_entry_trend_strong`, `adx_exit_trend_strong`
-   `adx_entry_range`, `adx_exit_range`

**Log Obrigatório:**
-   `regime_previous`, `regime_current`
-   `adx_value`
-   `transition_reason` (ex: “ADX crossed entry_trend”)

---

### 2) Saídas Dinâmicas por ATR (ATR Exits)
**Objetivo:** Tornar stops/targets adaptativos à volatilidade (evitar SL fixo que falha quando ATR muda).

**Política Oficial:**
-   Cada Strategy, além do sinal, define uma “proposta de saída” baseada em ATR.
-   A execução (Execution/Arbiter) usa essa proposta respeitando caps de risco (Risk Cap).

**Especificação Mínima:**
-   **ATR:** Período 14, timeframe operacional (mesmo do scan).
-   **A Strategy retorna:**
    -   `stop_atr_mult` (multiplicador do ATR para SL)
    -   `take_atr_mult` (multiplicador do ATR para TP) OU um modo de trailing
    -   `exit_style` (enum): `fixed_sl_tp` | `trailing` | `time_based` (opcional)

**Defaults Sugeridos:**
-   **Trend Following:**
    -   `stop_atr_mult` = 3.0 (Stop Longo)
    -   `take_atr_mult` = 6.0 (ou Trailing)
-   **Mean Reversion:**
    -   `stop_atr_mult` = 1.5 (Stop Curto)
    -   `take_atr_mult` = 1.5 a 2.0
-   **Breakout:**
    -   `stop_atr_mult` = 2.0
    -   `take_atr_mult` = 4.0

**Caps de Segurança:**
-   `min_stop_distance_points` (evitar stop colado)
-   `max_stop_distance_points` (respeitar Hard Risk Cap)

**Parâmetros Sugeridos:**
-   `enable_atr_exits` (bool, default true)
-   `atr_period` (default 14)
-   `trend_sl_atr_mult`, `trend_tp_atr_mult`
-   `reversion_sl_atr_mult`, `reversion_tp_atr_mult`
-   `breakout_sl_atr_mult`, `breakout_tp_atr_mult`

**Log Obrigatório:**
-   `atr_value`, `sl_distance`, `tp_distance`
-   `cap_applied` (true/false)

---

### 3) Validade do Sinal (TTL — Time To Live)
**Objetivo:** Evitar executar sinal “velho” quando o timing já passou (atraso do arbiter, mercado parado, spread mudou etc.).

**Política Oficial:**
-   Todo sinal possui **TTL** em número de candles.
-   Se não for executado dentro do TTL, o sinal **expira** e é descartado.
-   *Opcional:* Expirar também se condições essenciais mudarem (Regime, MTF, Spread).

**Defaults Sugeridos:**
-   `ttl_candles` = 2 (No H1, vale por 2 horas).

**Parâmetros Sugeridos:**
-   `enable_signal_ttl` (bool, default true)
-   `signal_ttl_candles` (int, default 2)
-   `signal_expire_on_regime_change` (bool, default true)

**Log Obrigatório:**
-   `signal_timestamp`, `ttl_remaining`
-   `expired_reason` (ex: “ttl_candles exceeded”)

**Conclusão:**
Esses refinamentos não aumentam complexidade de indicador; aumentam robustez operacional (estabilidade de regime, saídas adaptativas e descarte de sinais vencidos).

---

## 15. Definição de Sucesso (KPIs)

1.  **Profit Factor:** > 1.5.
2.  **Drawdown Máximo:** < 15%.
3.  **Log Quality:** Logs auto-explicativos.

---

### Changelog
- **v3.0 (Standardized):** Definição estrita das 4 Zonas de ADX. Política Hard/Soft explícita por modo. Fórmula de Scoring fechada. Regra de Winner fechada. Especificação de ATR/Spread e Breakout.
- **v3.1 (Corrected):** Ajuste de Pipeline para 8 passos. Prevenção de "Dupla Contagem" em Regime Penalties. MTF movido para Fase 2.
- **v3.2 (Robustness):** Adicionada seção **Refinamentos de Robustez** (Histerese, ATR Exits, TTL).
- **v3.3 (Subsystems):** Separação arquitetural em Asset Selection, Strategy e Execution. Criação do contrato **Universe Gate**. Namespaces de parâmetros separados (`selection`, `strategy`, `execution`, `risk`). UI Specs incluídas.
