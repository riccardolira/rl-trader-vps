---
description: UX Watchdog + Contract Guard (React Vite / REST /api + WS /ws/stream)
---

# UX Watchdog + Contract Guard (React Vite / REST /api + WS /ws/stream)

**Objetivo da Skill:**
Detectar rapidamente problemas de UX relacionados a falta de dados (via REST), stream estagnado (via WebSocket), payload inválido (quebra de contrato de dados) e estado de UI travado (loading infinito, ranking vazio sem motivo). Gerar relatórios acionáveis que identificam o problema, sua origem e como confirmar/consertar.

## Princípios (Mandatórios)
- Não modificar o resto da estrutura e funcionalidades do site.
- Não refatorar a arquitetura inteira.
- Mudanças mínimas, localizadas, focadas em observabilidade e diagnósticos.
- Tudo deve ser auditável e explicável.

---

## Escopo da Skill

### A) Especificação de “Sinais de Falha” (fail-fast UX)
Esta skill deve ajudar a diagnosticar e mapear eventos que configuram falhas silenciosas de UX:
- **Loading Prolongado:** Interface aguardando resposta por mais de `X` segundos.
- **WebSocket Conectado, mas Ocioso (Stale):** Conexão ativa, mas sem nenhuma mensagem recebida por mais de `Y` segundos.
- **Snapshot / Cycle_id Estagnado:** O backend não está atualizando o ciclo de processo, mantendo o mesmo `cycle_id` por mais de `Z` ciclos esperados (15-30s).
- **Anomalia de UI Vazia:** `ranking.count === 0` enquanto o status do backend está online.
- **Ação Sem Efeito:** Cliques em (toggle/botões) que não promovem mudanças de estado na inteface em até `T` segundos.
- **Contract Error (Schema Mismatch):** Carga recebida por REST / WS difere da estrutura mínima esperada (tipos diferentes, campos cruciais ausentes).

### B) Contratos de Dados (REST e WS)
Definição dos padrões mínimos para garantir que a interface opere de maneira robusta:

**Padrão de Schemas:**
- **Universe Snapshot:** Deve conter `ranking`, `count`, `timestamps`, `active_set`
- **WS Event Envelopes:** Eventos devem possuir `type`, `ts`, `payload` e `schema_version`

**Regras de Validação:**
- A validação no Frontend pode ocorrer em tempo de execução via manual check simples (`if (!data.type) throw new Error(...)`) ou esquema leve (ex: *Zod*).
- Todo erro de quebra de contrato deve registrar um log semântico detalhado (ex: `[CONTRACT_ERROR]: Campo 'count' não encontrado no payload`).
- A UI deve interceptar a falha e informar um erro amigável na área afetada (usando `ErrorBoundaries` ou overlays informativos), de modo a não exibir telas "brancas" ou loading infinito.

### C) Plano de Instrumentação no Frontend (Checklist sem refatoração imensa)
Este é o guia de pontos de contato no frontend (React/Vite) visando observabilidade.

- [ ] **Clientes de Conexão:** Localizar onde se faz requests HTTP e gerencia WebSockets (ex: Custom Fetchers, api hooks customizados, instâncias de `react-use-websocket`).
- [ ] **Eventos Chave para Registrar:**
  - `API_CALL`, `API_FAIL`
  - `WS_STATUS`, `WS_STALE`
  - `SNAPSHOT_STALE`
  - `CONTRACT_ERROR`
  - `UI_STUCK`, `ACTION_NO_EFFECT`
- [ ] **Visualização no Dashboard:** Exibição dessas métricas em tela dedicada como “Logs & Transparência” e adoção de um "Engineering Mode" (um alerta sutil visível que denuncie estagnação no DOM).

### D) Formato de Relatório (Output Padrão da Skill)
Quando nós (Antigravity e o Desenvolvedor) utilizarmos esta skill, a saída do rastreio de interface falha deve seguir este *template*:

```markdown
**Symptoms:** 
[Ex: Tela do Universo vazia; Spinner girando pra sempre após apertar 'Start'.]

**Most likely root causes:** 
[Ex: Faltou atributo 'count' na lista provida pela porta /api/state; WebSocket sem mensagens há mais de 10s.]

**How to confirm (1-2 passos):** 
[Ex: 1. Veja a aba de Networks se as msgs chegam. 2. Busque por [CONTRACT_ERROR] no Console.]

**Where to look (arquivos prováveis):** 
[Ex: frontend/src/components/universe/ClassesAndBlockedView.tsx; frontend/src/hooks/useWs.ts]

**Minimal fix suggestion:** 
[Ex: Atribuir fallback para data?.count ?? 0, implementar clearTimeout dentro do hook de mensagens do WebSocket.]
```

### E) Critérios de Aceite
1. Em até 60s de análise usando os comandos de busca (grep, list_dir, view_file), somos capazes de evidenciar a causa da UI estar "congelada".
2. Os erros de contrato já catalogados no Frontend não quebrarão todo o app (degradação amigável).
3. "WS stale" (stream travado) e "REST stale" (sem respostas) devem rapidamente se mostrar pro usuário ou relatar onde a engrenagem parou.

---

## Como a Skill Deve Operar (Passo a Passo da Investigação)

Quando o bot receber o comando para assumir o "UX Watchdog", ele deve:
1. **Detectar Estrutura:** Navegar pelo código do Frontend (`frontend/src`), validando rotas principais de `Universe`, `Logs` ou `Risk`.
2. **Localizar Clientes Base:** Inspecionar clientes de dados assíncronos atuais (funções que encapsulam fetch/requests) e clientes WS (`react-use-websocket`).
3. **Mapear Estados Vazios/Erro:** Procurar por variáveis/componentes que tratem de estados (ex: flags `isValidating`, `isError`, checks onde array vem nulo e trava mapeamento).
4. **Validar Contratos Existentes:** Olhar pro componente e entender se os campos esperados batem com os *schemas mínimos* aqui descritos.
5. **Apresentar o Plano Final no Código:** Mostrar quais componentes específicos num checklist (usando as seções listadas aqui) precisam da injeção de `Error Boundaries` e hooks customizados de tempo (timeout checks).
6. **Escrever o Relatório:** Encerrar exalando o status atual preenchido com as falhas detectadas (os três exemplos mais comuns: *REST offline*, *WS stale* e *Schema mismatch*).
