import React, { useState } from 'react';
import { BookOpen, Layers, Target, Scissors, GraduationCap, ShieldCheck, Zap, Settings, X, ChevronRight, Fingerprint, Cpu, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ManualOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ManualOverlay: React.FC<ManualOverlayProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<string>('intro');
    const [isMenuCollapsed, setIsMenuCollapsed] = useState(false);

    const tabs = [
        { id: 'intro', label: 'Introdução', icon: BookOpen },
        { id: 'filter', label: '1. Filtro & Blocklist', icon: Layers },
        { id: 'context', label: '2. Contexto (MT5)', icon: Target },
        { id: 'spreadgate', label: '3. Spread Gate', icon: Scissors },
        { id: 'scoring', label: '4. Scoring Agnóstico', icon: GraduationCap },
        { id: 'hysteresis', label: '5. Histerese', icon: Zap },
        { id: 'gate', label: '6. Gate Guardian', icon: ShieldCheck },
        { id: 'anticorrelation', label: '7. Anti-Correlação', icon: Fingerprint },
        { id: 'calibration', label: '8. Calibragem (Pesos)', icon: Settings },
        { id: 'risk_calibration', label: '9. Calibragem de Risco', icon: ShieldCheck },
        { id: 'strategyengine', label: '10. Motor de Estratégias', icon: Cpu },
        { id: 'arbiterservice', label: '11. Serviço de Arbitragem', icon: Activity },
        { id: 'guardianservice', label: '12. Serviço Guardião', icon: ShieldCheck },
        { id: 'executionservice', label: '13. Serviço de Execução', icon: Zap },
        { id: 'testmodes', label: '14. Modos de Teste (Scanner)', icon: Activity },
        { id: 'testmodesops', label: '15. Modos de Teste (Motor V3)', icon: Target },
        { id: 'riskguide', label: '16. Masterclass: Risco Quanti', icon: Target },
    ] as const;

    // Don't render if not open to save DOM nodes, alternatively we can use translate-x
    // but a sliding panel is usually best kept mounted with a translate transform 
    // for smooth entrance/exit animations.

    return (
        <div
            className={cn(
                "fixed top-0 right-0 h-screen w-full md:w-[600px] lg:w-[800px] z-50",
                "bg-card/95 backdrop-blur-3xl border-l border-border/50 shadow-2xl overflow-hidden flex flex-col transition-transform duration-300 ease-in-out",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}
        >
            <header className="flex-none p-6 border-b border-border/50 bg-muted/20">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-primary/10 rounded-xl text-primary flex-shrink-0">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">Manual Técnico</h2>
                            <p className="text-sm text-muted-foreground">Sistema Agente Seletor (Scanner V3)</p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                        title="Fechar Manual"
                    >
                        <X size={20} />
                    </button>
                </div>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                {/* Menu Lateral do Overlay */}
                <nav className={cn(
                    "flex-none bg-muted/5 border-r border-border/50 overflow-y-auto transition-all duration-300",
                    isMenuCollapsed ? "w-16" : "w-64"
                )}>
                    <div className="p-2 flex justify-end">
                        <button
                            onClick={() => setIsMenuCollapsed(!isMenuCollapsed)}
                            className="p-1.5 text-muted-foreground hover:bg-muted rounded"
                            title={isMenuCollapsed ? "Expandir Menu" : "Recolher Menu"}
                        >
                            <ChevronRight size={16} className={cn("transition-transform", !isMenuCollapsed && "rotate-180")} />
                        </button>
                    </div>

                    <div className="flex flex-col gap-1 p-2">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    title={isMenuCollapsed ? tab.label : undefined}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-left",
                                        isActive
                                            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                        isMenuCollapsed && "justify-center px-0"
                                    )}
                                >
                                    <Icon size={18} className="flex-shrink-0" />
                                    {!isMenuCollapsed && <span className="truncate">{tab.label}</span>}
                                </button>
                            );
                        })}
                    </div>
                </nav>

                {/* Conteúdo Dinâmico */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">

                    {activeTab === 'intro' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <BookOpen className="text-primary" /> Filosofia do Sistema Mestre
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                O Sistema de Seleção (conhecido internamente como <strong>Scanner V3</strong>) age como um audacioso <em>funil institucional</em>.
                                Sua premissa arquitetural é de que ele <strong>não tenta adivinhar a direção do mercado</strong> (se a moeda subirá ou cairá, tarefa delegada aos motores de estratégia de trading).
                            </p>
                            <p className="text-muted-foreground leading-relaxed mt-4">
                                Em vez disso, ele é um <strong>Mecanismo de Rankeamento de Tracionamento</strong>. A sua principal responsabilidade é escanear massivamente (~2300) símbolos do MetaTrader 5 e entregar cirurgicamente ao robô quais ativos apresentam as <em>melhores condições matemáticas e estruturais</em> para operar num dado momento.
                            </p>
                            <div className="mt-8 p-4 bg-muted/30 rounded-lg border border-border/50">
                                <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">O Processo Completo ⚙️</h4>
                                <p className="text-sm text-muted-foreground">
                                    O processo é rodado via um evento concorrente a cada ciclo (aproximadamente a cada 15 minutos se forjado em Auto Mode) e é composto estritamente por 6 etapas avaliativas.
                                    Navegue pelo menu lateral para estudar com exatidão como cada peneira matemática foi forjada.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'filter' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <Layers className="text-primary" /> 1. Filtro Inicial & Blocklist
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                A base de todos os cálculos ocorre ao extrair do pool bruto de cotações os ativos sujos. Primeiro, o sistema captura centenas de moedas disponíveis no MetaTrader e varre sua nomenclatura em busca das categorias clássicas.
                            </p>
                            <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
                                <li><strong className="text-foreground">Classificação de Natureza:</strong> Ativos são categorizados via Expressões Regulares de Nome como `FOREX`, `METALS` (XAU, XAG), `CRYPTO` (BTC, ETH) ou `INDICES` (US30, NAS, WIN).</li>
                                <li><strong className="text-foreground">Exclusão Macro (Disable Class):</strong> Se a classe for desligada intencionalmente no Dashboard (Menu Criteria Editor), cem por cento da vertente é ejetada imediatamente salvando processamento de I/O de rede.</li>
                                <li><strong className="text-foreground">Exclusão Micro (Blocklist):</strong> Ativos explícitos como 'USDTBRL' postos na Blocklist morrem na origem do loop, garantindo que aberrações nunca poluam o funil.</li>
                            </ul>
                        </div>
                    )}

                    {activeTab === 'context' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <Target className="text-primary" /> 2. Leitura de Contexto Múltiplo (O Raio-X)
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Símbolos que sobrevivem ao abate primário disparam requisições assíncronas concorrentes via Threadpool IPC (ZeroMQ) diretamente à DLL do Terminal MT5 sob a latência de frações de milissegundos.
                            </p>
                            <p className="text-muted-foreground leading-relaxed mt-4">
                                Nesta fase o Motor de Triagem suga o <strong>Tick Inicial</strong> e logo depois extrai um vetor bruto de Numpy Arrays das últimas 200 velas (H1). Com esses dados são mapeados em DataFrames da biblioteca Pandas a extração de 3 grandezas que guiarão 100% da inteligência autônoma desse robô:
                            </p>

                            <div className="grid grid-cols-1 gap-4 mt-6">
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h3 className="font-bold text-sm text-foreground mb-1">Spread Observável:</h3>
                                    <p className="text-sm text-muted-foreground">Extraído em tempo real demonstrando a inflação flutuante instantânea do custo spread que a Corretora submete a quem opera este ativo naquele exato frame.</p>
                                </div>
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h3 className="font-bold text-sm text-foreground mb-1">ATR (Average True Range 14):</h3>
                                    <p className="text-sm text-muted-foreground">Descreve em pontos o tamanho financeiro real da volatilidade e da "respiração" do ativo na última quinzena de horas. Dita quão gorda é a amplitude que se pode capturar.</p>
                                </div>
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h3 className="font-bold text-sm text-foreground mb-1">ADX (Average Directional Index 14):</h3>
                                    <p className="text-sm text-muted-foreground">Mostra se essas "velas grandes" do ATR têm de fato vetores claros ou se as velas apenas pulam de forma suicida num caixote lateralizado.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'spreadgate' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <Scissors className="text-primary" /> 3. A Guilhotina Fria (Spread/ATR Gate)
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Esta é a proteção financeira suprema embutida no coração do sistema V3 que dita a vida ou a morte de uma operação de risco.
                            </p>
                            <p className="text-muted-foreground leading-relaxed mt-4">
                                Avaliar o Spread absoluto de um ativo de forma solta (Ex: "Spread 32" é caro ou barato?) é um equívoco letal cometido por traders físicos.
                                Para um algoritmo o spread deve sempre ser avaliado com relação direta com o que o ativo lhe dá em troca.
                            </p>

                            <div className="bg-destructive/10 border border-destructive/20 p-5 rounded-xl mt-6">
                                <h4 className="font-mono text-sm text-destructive font-bold mb-2">Fórmula de Sanidade Matemática:</h4>
                                <code className="text-lg text-foreground bg-background/50 px-3 py-1 rounded block mb-4">
                                    Ratio = (Spread_Points * Point_Value) / ATR_Value
                                </code>
                                <p className="text-sm text-muted-foreground">
                                    Se um ativo possui Spread de $2 para ser engatilhado, para valer a pena operá-lo a violência e o deslocamento médio de seus candles (ATR) tem de justificar enormemente a abertura.
                                    Se a taxa configurada na Guilhotina pelo Trader no Dashboard pregar um <code>Max Ratio = 0.20</code> (20%), e esta conta indicar que para aquele exato ativo o custo devoraria estrondosos 50% de todo seu movimento médio na largada,
                                    então o Scanner carimba um <strong>Hard Reject: SPREAD_GATE</strong> na memória cache. O ativo é obliterado do painel.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'scoring' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <GraduationCap className="text-primary" /> 4. Motor de Pontuação Agnóstico
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Passado pela triagem de custo punitivo, a Inteligência Artificial do Scanner gera uma <strong>Nota de Corte Sintética de 0.0 a 100.0</strong> para classificar rigorosamente o ativo baseado nas calibrações de quatro Pilares Multiplicadores (Pesos definidos em Tela).
                            </p>

                            <div className="space-y-4 mt-6">
                                <div className="flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">💧</div>
                                    <div>
                                        <h4 className="font-bold text-foreground">Score de Liquidez e Custo (Decaimento Exponencial)</h4>
                                        <p className="text-sm text-muted-foreground mb-2">Penaliza a degradação do spread de forma não-linear usando Euler. Spreads que beiram a perfeição (zero) ganham pontuações altíssimas comparados a spreads médios.</p>
                                        <code className="text-xs bg-background/50 px-2 py-1 rounded text-primary">Score = 100 * e^(-1.6 * RatioPct)</code>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0">⚡</div>
                                    <div>
                                        <h4 className="font-bold text-foreground">Score de Volatilidade (Curva Sigmoide)</h4>
                                        <p className="text-sm text-muted-foreground mb-2">Avalia o Momentum direcional via equação logística (ADX). Requer trações severas no mundo real (+50 ADX) para flertar com uma nota perfeita, impedindo empates rasos no topo do ranking.</p>
                                        <code className="text-xs bg-background/50 px-2 py-1 rounded text-primary">Score = 100 / (1 + e^(-0.15 * (ADX - 25)))</code>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">⚖️</div>
                                    <div>
                                        <h4 className="font-bold text-foreground">Score de Estabilidade (Risco Relativo Absoluto)</h4>
                                        <p className="text-sm text-muted-foreground mb-2">Pune severamente ativos caóticos ou tóxicos (Meme Coins) subtraindo da nota básica a porcentagem de risco e oscilação diárias dividida pelo valor nominal do ativo no período.</p>
                                        <code className="text-xs bg-background/50 px-2 py-1 rounded text-primary">Score = 100 - ((ATR / Price) * 100 * 10)</code>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'hysteresis' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <Zap className="text-primary" /> 5. Histerese Anti-Ruído
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Uma vez empilhados os ativos campeões ordenados pela Nota Global `Score`, o Scanner vai preencher o <strong>Active Set</strong> (O Buffer principal de ativos elegíveis cujos robôs escutarão cotações). Ex: Top 10 ativos.
                            </p>
                            <p className="text-muted-foreground leading-relaxed mt-4">
                                Mas robôs agindo no mundo real são vitimas da Flutuação de Mercado. Se a moeda <em>EURUSD</em> for ranqueada como Décima colocada (Score 89.2), e <em>GBPUSD</em> for rebaixado a Décimo Primeiro (Score 89.1), na rodada seguinte eles poderiam inverter. Isso causaria o fechamento massivo de posições abertas pela Inteligência e reinstalamento de Indicadores na memória por meros centésimos decimais inúteis.
                            </p>

                            <div className="mt-8">
                                <h4 className="text-foreground font-bold mb-2">O Buffer de Memória Retentiva:</h4>
                                <p className="text-sm text-muted-foreground border-l-2 border-primary pl-4">
                                    Para solucionar sub-oscilações o núcleo matemático implementa um <em>Rank Allowance Hold Buffer</em> (Histerese). Se uma moeda ativa nos "Top 10" despencar sua nota de repente, e descer a escada de qualificação para o Top 12 (dependendo do delta do buffer parametrizado), ela <strong>NÃO</strong> é descartada precipitadamente pela Mente do Scanner garantindo fluidez e preservidade da rede em momentos de abalo temporário. Ela retém sua coroa.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'gate' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <ShieldCheck className="text-primary" /> 6. Triagem Mestra (Gate Guardian)
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                No fim do Loop o Scanner analisa o resultado dos despojos da guerra matemática que ocorreu. Se houverem ativos sãos (Acima do <code>Minimum Active Set Requirement</code> estipulado por você) a porta é blindada com cor Verde <strong>"OPEN"</strong> liberando fluxos de caça as Estratégias do RlTrader no backend.
                            </p>

                            <div className="mt-6 flex flex-col gap-3">
                                <div className="p-4 bg-muted/20 border border-orange-500/20 rounded-lg">
                                    <h4 className="text-sm text-orange-500 font-bold">Inverno de Baixa Liquidez no Hemisfério</h4>
                                    <p className="text-xs text-muted-foreground mt-1">Se os Feriados de Bancos Centrais congelarem as Bolsas de Câmbio em um breu, espalhar os Spreads mundiais em +600% ou não reportarem tração (ADX {'<'} 10) nas ultimas 2 semanas, o filtro matará os Símbolos todos em cascata pela mecânica das fases 3 e 4.</p>
                                </div>
                                <div className="p-4 bg-muted/20 border border-emerald-500/20 rounded-lg">
                                    <h4 className="text-sm text-emerald-500 font-bold">Comando de Lockdown Global</h4>
                                    <p className="text-xs text-muted-foreground mt-1">Neste cenário infame de zero qualidade operacional se a caçareira resultar numa cesta limpa os portões murcham a Bandeira pra Vermelho <code>"CLOSED" (ELIGIBLE_BELOW_MIN)</code> irradiando ordens expressas pela Websocket desarmando instantâneamente os "Gatilhos" de Ordens OCO dos algoritmos no mundo externo enquanto as coisas não melhorarem.</p>
                                </div>
                                <div className="p-4 bg-muted/20 border border-purple-500/20 rounded-lg">
                                    <h4 className="text-sm text-purple-500 font-bold">Escudo Contra Notícias (Macro Mapping)</h4>
                                    <p className="text-xs text-muted-foreground mt-1">Integra o NewsWorker para blindar a cesta contra o Calendário Econômico Global (ForexFactory). O filtro mapeia moedas implícitas, ou seja, se houver um <strong className="text-red-400">Payroll (USD)</strong> prestes a estourar, além de congelar o EURUSD, o sistema também entende via Macro-Map que os índices <strong>US30</strong>, <strong>NAS100</strong> e <strong>XAUUSD</strong> devem ser sumariamente banidos e congelados.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'anticorrelation' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <Fingerprint className="text-primary" /> 7. Anti-Clóner Shield (Filtro de Correlação)
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Operar muitos ativos ao mesmo tempo gera um problema estatístico oculto: A Superexposição de Risco. O V3 introduz o Escudo Anti-Correlação para evitar a negociação fantasma de um ativo espelho.
                            </p>
                            <p className="text-muted-foreground leading-relaxed mt-4">
                                Se o ativo A (EURUSD) e o ativo B (GBPUSD) reagem ao mesmo vetor (Força do Dólar), operar ambos de forma simultânea anula a diversificação (o Hedge) e dobra a exposição a um mesmo choque em um vetor.
                            </p>

                            <div className="mt-8">
                                <h4 className="text-foreground font-bold mb-2">Matemática do Fator de Pearson Absoluto:</h4>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-8">
                                    <li><strong className="text-foreground">Fórmula Absoluta `abs()`:</strong> O cálculo de correlação captura valores de [-1 a +1]. No V3, a validação é Absoluta. Isso significa que ele irá punir moedas perfeitamente iguais (Correlação Positiva Ex: +0.90) e também blindará moedas inversamente perfeitas (Correlação Negativa Ex: -0.90 EURUSD / USDCHF).</li>
                                    <li><strong className="text-foreground">Varredura Exclusiva (Matrix):</strong> O Scanner cruza <em>todos</em> os ativos pré-aprovados entre si, comparando históricos de fechamento armazenados em <strong>Cache Ultra-rápido Local</strong> (evitando sobrecarga de requisições lentas RPC / IPC do MT5).</li>
                                    <li><strong className="text-foreground">Sobrevivência do Maior Score:</strong> Quando dois clones são detectados acima do "Threshold" configurado (Geralmente 85%), o Scanner invoca o placar do Motor Agnóstico e <strong>Ejeta da lista o par com menor Score</strong>, concedendo a vaga apenas ao "Alpha".</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {activeTab === 'calibration' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <Settings className="text-primary" /> 8. Calibragem Ideal do Seletor
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                O motor matemático possui pesos calibrados de acordo com a realidade microestrutural de cada mercado no MetaTrader.
                                Abaixo estão as configurações atualizadas baseadas na recomendação do <code>universe_config.json</code> implantadas nativamente no sistema mestre.
                            </p>

                            <h3 className="text-xl font-bold mt-8 mb-4 text-foreground">Pesos Multiplicadores e Limites por Mercado</h3>

                            <div className="space-y-6">
                                {/* FOREX */}
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h4 className="font-bold text-foreground mb-2 text-lg">FOREX</h4>
                                    <p className="text-sm text-muted-foreground mb-3">Mercado com alta liquidez e ticks extremamente frequentes. Volatilidade e custo recebem mais peso.</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div><span className="text-foreground font-semibold">Max Spread/ATR:</span> 0.10</div>
                                        <div><span className="text-foreground font-semibold">Liquidez:</span> 1.0</div>
                                        <div><span className="text-foreground font-semibold">Volatilidade:</span> 1.5</div>
                                        <div><span className="text-foreground font-semibold">Custo:</span> 2.0</div>
                                        <div><span className="text-foreground font-semibold">Estabilidade:</span> 1.0</div>
                                    </div>
                                </div>

                                {/* INDICES */}
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h4 className="font-bold text-foreground mb-2 text-lg">ÍNDICES (Gerais, NY, B3, EU)</h4>
                                    <p className="text-sm text-muted-foreground mb-3">Tendem a dar "tiros" direcionais fortes. A volatilidade ganha destaque em índices globais.</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div><span className="text-foreground font-semibold">Max Spread/ATR:</span> 0.10 a 0.15</div>
                                        <div><span className="text-foreground font-semibold">Liquidez:</span> 1.0 a 1.5</div>
                                        <div><span className="text-foreground font-semibold">Volatilidade:</span> 1.0 a 2.0</div>
                                        <div><span className="text-foreground font-semibold">Custo:</span> 1.0</div>
                                        <div><span className="text-foreground font-semibold">Estabilidade:</span> 1.0</div>
                                    </div>
                                </div>

                                {/* METALS */}
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h4 className="font-bold text-foreground mb-2 text-lg">METAIS (Metals)</h4>
                                    <p className="text-sm text-muted-foreground mb-3">Movimentos pesados no preço das commodities raras exigem maior tolerância ao spread.</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div><span className="text-foreground font-semibold">Max Spread/ATR:</span> 0.20</div>
                                        <div><span className="text-foreground font-semibold">Liquidez:</span> 1.0</div>
                                        <div><span className="text-foreground font-semibold">Volatilidade:</span> 2.0</div>
                                        <div><span className="text-foreground font-semibold">Custo:</span> 2.0</div>
                                        <div><span className="text-foreground font-semibold">Estabilidade:</span> 1.0</div>
                                    </div>
                                </div>

                                {/* CRYPTO */}
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h4 className="font-bold text-foreground mb-2 text-lg">CRIPTOATIVOS</h4>
                                    <p className="text-sm text-muted-foreground mb-3">Spreads massivos das corretoras MT5 forçam a tolerância chegar a até 25% para encontrar os pontos ótimos.</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div><span className="text-foreground font-semibold">Max Spread/ATR:</span> 0.25</div>
                                        <div><span className="text-foreground font-semibold">Liquidez:</span> 0.5</div>
                                        <div><span className="text-foreground font-semibold">Volatilidade:</span> 2.0</div>
                                        <div><span className="text-foreground font-semibold">Custo:</span> 2.0</div>
                                        <div><span className="text-foreground font-semibold">Estabilidade:</span> 1.0</div>
                                    </div>
                                </div>

                                {/* STOCKS */}
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h4 className="font-bold text-foreground mb-2 text-lg">AÇÕES (US, BR, EU)</h4>
                                    <p className="text-sm text-muted-foreground mb-3">Podem possuir gaps. Requerem boa estabilidade e custo de spread equilibrado conforme o mercado primário (Bolsas americanas x B3).</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div><span className="text-foreground font-semibold">Max Spread/ATR:</span> 0.05 a 0.15</div>
                                        <div><span className="text-foreground font-semibold">Liquidez:</span> 1.0 a 2.0</div>
                                        <div><span className="text-foreground font-semibold">Volatilidade:</span> 1.0 a 1.5</div>
                                        <div><span className="text-foreground font-semibold">Custo:</span> 1.0 a 1.5</div>
                                        <div><span className="text-foreground font-semibold">Estabilidade:</span> 1.0</div>
                                    </div>
                                </div>

                                {/* COMMODITIES */}
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h4 className="font-bold text-foreground mb-2 text-lg">COMMODITIES (Agri / Energia)</h4>
                                    <p className="text-sm text-muted-foreground mb-3">Setor bem diversificado, exigindo balanceamento e moderação na cobrança da estabilidade pela volatilidade exógena do clima e estoques.</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div><span className="text-foreground font-semibold">Max Spread/ATR:</span> 0.10 a 0.20</div>
                                        <div><span className="text-foreground font-semibold">Liquidez:</span> 0.5 a 1.0</div>
                                        <div><span className="text-foreground font-semibold">Volatilidade:</span> 1.0 a 2.0</div>
                                        <div><span className="text-foreground font-semibold">Custo:</span> 1.0</div>
                                        <div><span className="text-foreground font-semibold">Estabilidade:</span> 1.0</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'risk_calibration' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <ShieldCheck className="text-primary" /> 9. Calibragem dos Valores de Risco
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Abaixo estão os parâmetros de controle de risco exatos usados pelo <strong>Guardian Service</strong> de acordo com a configuração nativa (<code>risk_config.json</code>).
                            </p>

                            <h3 className="text-xl font-bold mt-8 mb-4 text-foreground">Regras Globais de Proteção</h3>
                            <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                <li><strong className="text-foreground">Perda Máxima Financeira Aceitável (Hard Risk Cap):</strong> $50.00 (Caso acionado, trava as operações de risco temporariamente).</li>
                                <li><strong className="text-foreground">Máximo de Trades Abertos:</strong> 5 Simultâneos (Regra padrão em teste/demo, redimensionada conforme o patrimônio).</li>
                                <li><strong className="text-foreground">Drawdown Diário Máximo:</strong> 5% (0.05).</li>
                                <li><strong className="text-foreground">Lote Máximo Violento:</strong> 0.05 lotes (Capping do algoritmo).</li>
                                <li><strong className="text-foreground">Filtro de Notícias & Spread Tracker:</strong> Verdadeiro (Ativado globalmente no setup inicial).</li>
                            </ul>

                            <h3 className="text-xl font-bold mt-8 mb-4 text-foreground">Limites Restritivos por Classe de Ativo</h3>
                            <div className="space-y-6">
                                {/* FOREX */}
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h4 className="font-bold text-foreground mb-2 text-lg">FOREX</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm text-foreground/80">
                                        <div><span className="text-muted-foreground font-semibold">Risco Máx por Trade:</span> 1% (0.01)</div>
                                        <div><span className="text-muted-foreground font-semibold">Score de Segurança Mín:</span> 65.0</div>
                                        <div><span className="text-muted-foreground font-semibold">Spread Máx Absoluto:</span> 200 pts</div>
                                        <div><span className="text-muted-foreground font-semibold">Buffer de Slippage (Derrapagem):</span> 100 pts</div>
                                    </div>
                                </div>

                                {/* INDICES */}
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h4 className="font-bold text-foreground mb-2 text-lg">ÍNDICES (NY, B3, EU)</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm text-foreground/80">
                                        <div><span className="text-muted-foreground font-semibold">Risco Máx por Trade:</span> 1% (0.01)</div>
                                        <div><span className="text-muted-foreground font-semibold">Score de Segurança Mín:</span> 65.0</div>
                                        <div><span className="text-muted-foreground font-semibold">Spread Máx Absoluto:</span> B3: 25 pts | NY/EU: 400 pts</div>
                                        <div><span className="text-muted-foreground font-semibold">Buffer de Slippage:</span> B3: 10 pts | NY/EU: 200 pts</div>
                                    </div>
                                </div>

                                {/* CRYPTO e METALS */}
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h4 className="font-bold text-foreground mb-2 text-lg">CRIPTOATIVOS & METAIS</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm text-foreground/80">
                                        <div><span className="text-muted-foreground font-semibold">Risco Máx por Trade:</span> 1% (0.01)</div>
                                        <div><span className="text-muted-foreground font-semibold">Score de Segurança Mín:</span> Crypto 70.0 | Metals 65.0</div>
                                        <div><span className="text-muted-foreground font-semibold">Spread Máx Absoluto:</span> Crypto 5000 pts | Metals 500 pts</div>
                                        <div><span className="text-muted-foreground font-semibold">Buffer de Slippage:</span> Crypto 1500 pts | Metals 150 pts</div>
                                    </div>
                                </div>

                                {/* STOCKS */}
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h4 className="font-bold text-foreground mb-2 text-lg">MERCADO DE AÇÕES (Stocks BR/US/EU)</h4>
                                    <div className="grid grid-cols-2 gap-2 text-sm text-foreground/80">
                                        <div><span className="text-muted-foreground font-semibold">Risco Máx por Trade:</span> BR: 2% (0.02) | Resto: 1%</div>
                                        <div><span className="text-muted-foreground font-semibold">Score de Segurança Mín:</span> BR: 70.0 | US/EU: 75.0</div>
                                        <div><span className="text-muted-foreground font-semibold">Spread Máx Absoluto:</span> BR: 15 pts | US/EU: 25 pts</div>
                                        <div><span className="text-muted-foreground font-semibold">Buffer de Slippage:</span> Todos: 10 pts</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'strategyengine' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <Cpu className="text-primary" /> 9. Motor de Estratégias (Strategy Engine)
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                O <strong>Strategy Engine</strong> é o módulo analítico central da arquitetura. Ele opera em um ciclo contínuo, processando exclusivamente o subconjunto de ativos que foram pré-qualificados e marcados como elegíveis (Active Set) pela camada de Seleção de Ativos.
                            </p>
                            <div className="mt-6 flex flex-col gap-4">
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h4 className="font-bold text-foreground mb-1">Análise de Confluência Múltipla</h4>
                                    <p className="text-sm text-muted-foreground">O motor instancializa simultaneamente múltiplos algoritmos especializados (ex: <code>TrendStrategy</code>, <code>MeanReversionStrategy</code>, <code>BreakoutStrategy</code>). Cada um avalia o contexto atual do ativo e emite uma projeção matemática baseada em indicadores técnicos e análise de volatilidade histórica.</p>
                                </div>
                                <div className="bg-muted/20 p-4 border border-border/30 rounded-lg">
                                    <h4 className="font-bold text-foreground mb-1">Geração de Sinal Matemático (`SignalGenerated`)</h4>
                                    <p className="text-sm text-muted-foreground">Caso a pontuação final de um ativo supere o limite de confiança estabelecido (<code>Threshold</code>), o motor gera uma entidade de sinal rigorosa. Esta entidade contém não apenas a direção estrutural (Comprar/Vender), mas metadados críticos como Múltiplos de ATR para precificação sintética de Risco/Retorno, que serão indispensáveis para o dimensionamento dinâmico a jusante.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'arbiterservice' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <Activity className="text-primary" /> 10. Serviço de Arbitragem (Arbiter Service)
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                O <strong>Arbiter Service</strong> atua como o calculador oficial do sistema e precificador de exposição. Sua função é transmutar um sinal abstrato de mercado em uma proposta tangível de roteamento de capital (um <code>DraftOrder</code>).
                            </p>
                            <ul className="list-disc pl-6 space-y-3 mt-6 text-muted-foreground">
                                <li><strong className="text-foreground">Sondagem de Equidade Funcional:</strong> Antes de qualquer operação aritmética, o serviço invoca o Worker do MetaTrader 5 para adquirir o balanço e a equidade (patrimônio líquido) real-time da conta em produção. Nenhuma estimativa de risco é baseada em saldo defasado.</li>
                                <li><strong className="text-foreground">Projeção de Distância de Interrupção (Stop Loss):</strong> O módulo converte a volatilidade intrínseca (ATR) enviada pelo Strategy Engine multiplicada pelo coeficiente de proteção em uma distância em pontos absolutos, ditando com exatidão o nível de fechamento obrigatório na corretora através do preço de cotação corrente.</li>
                                <li><strong className="text-foreground">Dimensionamento de Posição Dinâmica (Position Sizing):</strong> Emprega a fórmula universal de restrição de caixa. Ao dividir o Montante de Risco Máximo Permitido (ex: 2% da Equidade Ponderada) pelo Custo do Ponto vezes a Distância do Stop Loss, ele deriva dinamicamente a volumetria precisa de Lotes necessária para que, ao atingir a interrupção, o impacto financeiro coincida matematicamente com a porcentagem delegada pela Política de Risco.</li>
                            </ul>
                        </div>
                    )}

                    {activeTab === 'guardianservice' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <ShieldCheck className="text-primary" /> 11. Serviço Guardião (Guardian Service)
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                O <strong>Guardian Service</strong> representa a última barreira de validação e governança do fluxo arquitetônico. Ele é o detentor primário do <code>risk_config.json</code> e possui autoridade administrativa para vetar ordens iminentes baseadas no Estado Macroeconômico Corrente ou limites instrumentais da corretora.
                            </p>
                            <div className="space-y-4 mt-6">
                                <div className="p-4 border-l-4 border-l-rose-500 bg-rose-500/5 rounded-r">
                                    <h4 className="font-bold text-foreground">Matrizes de Validação Categórica</h4>
                                    <p className="text-sm text-muted-foreground mt-1">O volume e a especificidade do rascunho de ordem são contrapostos aos perfis de restrição. Se a requisição de Lote (Volume) cruzar os cinturões de segurança do `Max Global Lot` ou tentar burlar uma inatividade preestabelecida de uma sub-classe de ativo, o evento converte-se em um recuso categórico (<code>OrderRejected</code>), emitindo logs analíticos detalhados de auditoria e evitando liquidação prematura de conta por falhas computacionais.</p>
                                </div>
                                <div className="p-4 border-l-4 border-l-purple-500 bg-purple-500/5 rounded-r">
                                    <h4 className="font-bold text-foreground">Snapshot Final de Responsabilidade</h4>
                                    <p className="text-sm text-muted-foreground mt-1">Se todos os critérios prudenciais forem satisfeitos, o Guardião arquiva a estampa das condições autorizadas daquele momento e sela a transação digital cunhando um evento <code>OrderApproved</code> para processamento sistêmico terminal.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'executionservice' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <Zap className="text-primary" /> 12. Serviço de Execução (Execution Service)
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                O <strong>Execution Service</strong>, juntamente com o seu adaptador isolado de protocolo local (MT5 Worker), constitui o módulo condutor de Interfaceamento Físico. Seu escopo único e final é realizar a transmissão segura e idempotente das requisições via IPC para o Terminal Desktop do MetaTrader.
                            </p>
                            <p className="text-muted-foreground leading-relaxed mt-4">
                                Esta barreira garante o isolamento seguro do núcleo logístico em relação ao terminal alvo. Caso o Módulo da Corretora sofra instabilidade (rejeição por latência crônica, preço fora do escopo (<em>Requote</em>), ou ausência de cotação sincrônica), a requisição passa por protocolos embutidos de "Interrupção" ou "Reiteração" do comando binário <code>order_send</code>, garantindo que aberrações sistêmicas (Múltiplas operações devido ao envio repetitivo pelo Timeout do Backend) não afundem a gestão do capital investido.
                            </p>
                        </div>
                    )}

                    {activeTab === 'testmodes' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <Activity className="text-primary" /> 14. Modos de Teste Estratégicos (Scanner)
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Abaixo estão definidos 3 perfis de calibração que funcionam como <strong>modos operacionais distintos</strong> para o Scanner V3. O objetivo é permitir simulações e auditorias na capacidade de encontrar oportunidades e medir o volume de trades processados pelo Robô.
                            </p>
                            <p className="text-muted-foreground leading-relaxed mt-4">
                                Você pode configurar estas propriedades no painel principal ou <strong>Criteria Editor</strong>.
                            </p>

                            <div className="space-y-6 mt-8">
                                {/* Modo Conservador */}
                                <div className="bg-muted/20 p-5 border border-border/30 rounded-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full translate-x-1/2 -translate-y-1/2" />
                                    <div className="flex gap-4 items-start relative z-10">
                                        <div className="w-12 h-12 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">🛡️</div>
                                        <div>
                                            <h3 className="font-bold text-lg text-emerald-500 mb-1">Modo 1: Conservador Sniper (Extreme Strict)</h3>
                                            <p className="text-sm text-foreground/90 font-medium mb-3">Foco: Proteger Capital. Menos trades, maior assertividade teórica.</p>
                                            <p className="text-sm text-muted-foreground mb-4">
                                                A tolerância a custos é baixíssima. Ativos com spread minimamente alto serão abortados. Resulta frequentemente em "Scanner Vazio" se o mercado estiver hostil, operando apenas com a nata do mercado (spread muito próximo a zero).
                                            </p>
                                            <div className="bg-background/40 rounded p-3 text-sm grid grid-cols-2 gap-2">
                                                <div className="text-muted-foreground">Max Spread/ATR: <span className="text-foreground font-semibold ml-1">0.05 a 0.08</span></div>
                                                <div className="text-muted-foreground">Peso Custo: <span className="text-foreground font-semibold ml-1">2.0</span></div>
                                                <div className="text-muted-foreground">Peso Estabilidade: <span className="text-foreground font-semibold ml-1">2.0</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Modo Balanceado */}
                                <div className="bg-muted/20 p-5 border border-border/30 rounded-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full translate-x-1/2 -translate-y-1/2" />
                                    <div className="flex gap-4 items-start relative z-10">
                                        <div className="w-12 h-12 rounded-lg bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">⚖️</div>
                                        <div>
                                            <h3 className="font-bold text-lg text-blue-500 mb-1">Modo 2: Balanceado (Produção Padrão)</h3>
                                            <p className="text-sm text-foreground/90 font-medium mb-3">Foco: Seguir oscilações normais. Equilíbrio de risco e retorno.</p>
                                            <p className="text-sm text-muted-foreground mb-4">
                                                É a configuração oficial para o dia a dia. Busca capturar ativos com volatilidade orgânica, punindo spreads abusivos mas sendo flexível para abrir oportunidades durante expansões naturais do mercado.
                                            </p>
                                            <div className="bg-background/40 rounded p-3 text-sm grid grid-cols-2 gap-2">
                                                <div className="text-muted-foreground">Max Spread/ATR: <span className="text-foreground font-semibold ml-1">0.15 a 0.20</span></div>
                                                <div className="text-muted-foreground">Peso Volatilidade: <span className="text-foreground font-semibold ml-1">1.5</span></div>
                                                <div className="text-muted-foreground">Peso Liquidez: <span className="text-foreground font-semibold ml-1">1.0</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Modo Agressivo */}
                                <div className="bg-muted/20 p-5 border border-border/30 rounded-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-bl-full translate-x-1/2 -translate-y-1/2" />
                                    <div className="flex gap-4 items-start relative z-10">
                                        <div className="w-12 h-12 rounded-lg bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">🔥</div>
                                        <div>
                                            <h3 className="font-bold text-lg text-rose-500 mb-1">Modo 3: Stress Test (Agressivo / Laboratório)</h3>
                                            <p className="text-sm text-foreground/90 font-medium mb-3">Foco: Debugar o motor de trading e infraestrutura do bot.</p>
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Abre a "torneira de ativos". O Scanner irá popular o Active Set com moedas super voláteis ignorando se o pedágio (Spread) for desproporcional. Ideal para estressar a máquina e avaliar as execuções de ordens e limites de lotes da conta.
                                            </p>
                                            <div className="bg-background/40 rounded p-3 text-sm grid grid-cols-2 gap-2">
                                                <div className="text-muted-foreground">Max Spread/ATR: <span className="text-foreground font-semibold ml-1">0.40 a 0.50</span></div>
                                                <div className="text-muted-foreground">Peso Volatilidade: <span className="text-foreground font-semibold ml-1">3.0</span></div>
                                                <div className="text-muted-foreground">Peso Custo: <span className="text-foreground font-semibold ml-1">0.5</span></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'testmodesops' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <Target className="text-primary" /> 15. Modos de Teste do Motor de Operações (Risco & Tuning)
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Abaixo estão 3 calibrações de laboratório focadas em testar as proteções do <strong>Guardian Service</strong> e o rigor do <strong>Strategy Engine</strong>. Você deve configurar estes valores nas telas de `Motor de Operações` (para os Scores das Estratégias) e `Risco` (para Max Trades e % de perda).
                            </p>

                            <div className="space-y-6 mt-8">
                                {/* Modo Conservador */}
                                <div className="bg-muted/20 p-5 border border-border/30 rounded-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full translate-x-1/2 -translate-y-1/2" />
                                    <div className="flex gap-4 items-start relative z-10">
                                        <div className="w-12 h-12 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">🎯</div>
                                        <div>
                                            <h3 className="font-bold text-lg text-emerald-500 mb-1">Modo 1: Atirador de Elite (Sniper / Conservador)</h3>
                                            <p className="text-sm text-foreground/90 font-medium mb-3">Foco: Segurar munição e disparar apenas em cenários de ouro. Baixa frequência.</p>
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Exige que os scores das estratégias sejam quase perfeitos. As proteções do Guardian Service impedirão múltiplas posições engavetadas.
                                            </p>
                                            <div className="bg-background/40 rounded p-4 text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">No Motor de Operações</span>
                                                    <div>Exigência Score: <span className="text-foreground font-semibold ml-1">80.0 a 90.0</span></div>
                                                    <div>Ativas: <span className="text-foreground font-semibold ml-1">Apenas SmartMoney / Trend</span></div>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">No Painel de Risco</span>
                                                    <div>Max Trades Abertos: <span className="text-foreground font-semibold ml-1">2 a 3</span></div>
                                                    <div>Max trades / Ativo: <span className="text-foreground font-semibold ml-1">1</span></div>
                                                    <div>Risco por Trade: <span className="text-foreground font-semibold ml-1">0.5 a 1%</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Modo Balanceado */}
                                <div className="bg-muted/20 p-5 border border-border/30 rounded-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-bl-full translate-x-1/2 -translate-y-1/2" />
                                    <div className="flex gap-4 items-start relative z-10">
                                        <div className="w-12 h-12 rounded-lg bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">⚖️</div>
                                        <div>
                                            <h3 className="font-bold text-lg text-blue-500 mb-1">Modo 2: Produção Standard (Balanceado)</h3>
                                            <p className="text-sm text-foreground/90 font-medium mb-3">Foco: Dia a dia natural com diversificação moderada.</p>
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Permite que fractais razoáveis gerem posições, distribuindo pequenas frações de lotes por até 10 papéis diferentes simultaneamente sem alavancar a conta no limite.
                                            </p>
                                            <div className="bg-background/40 rounded p-4 text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">No Motor de Operações</span>
                                                    <div>Exigência Score: <span className="text-foreground font-semibold ml-1">60.0 a 65.0</span></div>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">No Painel de Risco</span>
                                                    <div>Max Trades Abertos: <span className="text-foreground font-semibold ml-1">5 a 10</span></div>
                                                    <div>Max trades / Ativo: <span className="text-foreground font-semibold ml-1">1 ou 2</span></div>
                                                    <div>Risco por Trade: <span className="text-foreground font-semibold ml-1">1.0 a 2.0%</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Modo Agressivo */}
                                <div className="bg-muted/20 p-5 border border-border/30 rounded-xl relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-bl-full translate-x-1/2 -translate-y-1/2" />
                                    <div className="flex gap-4 items-start relative z-10">
                                        <div className="w-12 h-12 rounded-lg bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">🔥</div>
                                        <div>
                                            <h3 className="font-bold text-lg text-rose-500 mb-1">Modo 3: Stress Lab (Agressivo / Metralhadora)</h3>
                                            <p className="text-sm text-foreground/90 font-medium mb-3">Foco: Testar limites da infra, latência e lotar a tela de execuções.</p>
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Aprova quase todos os sinais que recebem o mínimo de indicação da estratégia independente de mercado terrível. Cuidado absoluto: o risco fatiado deve ser microscópico para este setup, caso contrário o margin call chega em poucas horas.
                                            </p>
                                            <div className="bg-background/40 rounded p-4 text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">No Motor de Operações</span>
                                                    <div>Exigência Score: <span className="text-foreground font-semibold ml-1">20.0 a 30.0</span></div>
                                                    <div>Ativas: <span className="text-foreground font-semibold ml-1">Todas ligadas</span></div>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">No Painel de Risco</span>
                                                    <div>Max Trades Abertos: <span className="text-foreground font-semibold ml-1">20 a 30</span></div>
                                                    <div>Max trades / Ativo: <span className="text-foreground font-semibold ml-1">3 a 5</span></div>
                                                    <div className="text-rose-400 font-bold">Risco por Trade: <span className="text-rose-500 ml-1">Fixar 0.01 lote ou 0.1%</span></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'testmodesops' && (
                        <div className="prose prose-invert max-w-none pb-20">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <Target className="text-primary" /> 15. Modos de Teste (Motor V3)
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Para calibrar, testar latência de corretora, ou colocar o robô em produção, o Motor de Operações e o Serviço Guardião (Risco) precisam estar em harmonia. Abaixo estão três modos operacionais clássicos sugeridos para configuração manual na interface:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                                {/* Modo 1: Atirador de Elite */}
                                <div className="p-6 bg-card border border-border/50 rounded-xl shadow-sm hover:border-primary/50 transition-colors">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
                                            <Target size={20} />
                                        </div>
                                        <h3 className="text-lg font-bold">1. Atirador de Elite (Sniper)</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Foco extremo. O robô atua cirurgicamente, segurando munição e executando apenas cenários de ouro multitimeframe. Pode passar dias sem operar.
                                    </p>
                                    <div className="space-y-4">
                                        <div className="p-3 bg-muted/30 rounded-lg border border-border/30">
                                            <h4 className="text-xs font-bold uppercase text-foreground/70 mb-2">Engrenagens Específicas</h4>
                                            <ul className="text-sm text-muted-foreground space-y-1">
                                                <li><span className="text-foreground">Exigência (Score):</span> 80.0 a 90.0</li>
                                                <li><span className="text-foreground">Estratégias:</span> SmartMoney e TrendFollowing (Pesos 1.0)</li>
                                            </ul>
                                        </div>
                                        <div className="p-3 bg-muted/30 rounded-lg border border-border/30">
                                            <h4 className="text-xs font-bold uppercase text-foreground/70 mb-2">Pilar de Risco</h4>
                                            <ul className="text-sm text-muted-foreground space-y-1">
                                                <li><span className="text-foreground">Max Trades Abertos:</span> 2 a 3 totais (1 por ativo)</li>
                                                <li><span className="text-foreground">Risco por Trade:</span> Conservador (0.5% a 1.0%)</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Modo 2: Produção Standard */}
                                <div className="p-6 bg-card border border-primary/30 rounded-xl shadow-[0_0_15px_rgba(var(--primary),0.1)] relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2">
                                        <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary rounded-full">Recomendado</span>
                                    </div>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                                            <Layers size={20} />
                                        </div>
                                        <h3 className="text-lg font-bold">2. Produção Padrão (Balanceado)</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        O setup pretendido para o dia a dia. Extrai rentabilidade constante acompanhando fractais intermediários sem comprometer o Drawdown.
                                    </p>
                                    <div className="space-y-4">
                                        <div className="p-3 bg-muted/30 rounded-lg border border-border/30">
                                            <h4 className="text-xs font-bold uppercase text-foreground/70 mb-2">Engrenagens Específicas</h4>
                                            <ul className="text-sm text-muted-foreground space-y-1">
                                                <li><span className="text-foreground">Exigência (Score):</span> 60.0 a 65.0</li>
                                                <li><span className="text-foreground">Estratégias:</span> Favoritas ligadas (Pesos 1.5 e 1.0)</li>
                                            </ul>
                                        </div>
                                        <div className="p-3 bg-muted/30 rounded-lg border border-border/30">
                                            <h4 className="text-xs font-bold uppercase text-foreground/70 mb-2">Pilar de Risco</h4>
                                            <ul className="text-sm text-muted-foreground space-y-1">
                                                <li><span className="text-foreground">Max Trades Abertos:</span> 5 a 10 totais (Até 2 por ativo)</li>
                                                <li><span className="text-foreground">Risco por Trade:</span> Intermediário (1.0% a 2.0%)</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Modo 3: Stress Lab */}
                                <div className="p-6 bg-card border border-destructive/30 rounded-xl shadow-sm md:col-span-2 hover:border-destructive/50 transition-colors">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-destructive/10 rounded-lg text-destructive">
                                            <Activity size={20} />
                                        </div>
                                        <h3 className="text-lg font-bold">3. Stress Lab (Agressivo / Metralhadora)</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Força o Strategy Engine a aprovar jorros de sinais ignorando confluências rigorosas. Útil <strong>apenas</strong> para testar latência de execução do MT5 e as travas simultâneas da GUI.
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-3 bg-muted/30 rounded-lg border border-border/30">
                                            <h4 className="text-xs font-bold uppercase text-foreground/70 mb-2">Engrenagens Específicas</h4>
                                            <ul className="text-sm text-muted-foreground space-y-1">
                                                <li><span className="text-foreground">Exigência (Score):</span> 20.0 a 30.0 (Tudo ativado)</li>
                                                <li><span className="text-foreground">Propósito:</span> Inundar o EventBus com sinais.</li>
                                            </ul>
                                        </div>
                                        <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20 relative">
                                            <h4 className="text-xs font-bold uppercase text-destructive mb-2 flex items-center gap-2">
                                                <AlertTriangle size={14} /> Aviso Crítico de Risco
                                            </h4>
                                            <ul className="text-sm text-muted-foreground space-y-1">
                                                <li><span className="text-foreground">Max Trades:</span> 20 a 30 (Livre por ativo)</li>
                                                <li><span className="text-destructive font-bold">PERIGO: Risco MÁX. de 0.1% por Trade!</span> Se você configurar 1.0% sob essa rajada, limpamos a conta.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'riskguide' && (
                        <div className="prose prose-invert max-w-none">
                            <h2 className="text-2xl font-bold mb-4 text-foreground flex items-center gap-2">
                                <Target className="text-primary" /> 13. Masterclass: Parâmetros e Risco Quantitativo
                            </h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Configurar o <strong>Asset Class Profiles</strong> não é sobre "chutar" números que pareçam confortáveis. No Trading Sistematizado, a ruína financeira não ocorre por conta de "mercados ruins", mas por uma assimetria letal entre a oscilação inata de um ativo e a expectativa engessada do operador.
                            </p>

                            <div className="mt-8 space-y-8">
                                {/* Seção 1: Risco Per Trade */}
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <span className="w-8 h-8 rounded bg-primary/20 text-primary flex items-center justify-center text-sm">1</span>
                                        A Ilusão da Conta Pequena e a Regra do 1%
                                    </h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        O instinto de um iniciante com uma conta de $1.000 é arriscar $100 (10%) por operação para "sentir algum lucro". Matematicamente, isso se chama <strong>Drawdown Geométrico</strong>. Se você perde 50% de uma banca, você não precisa de 50% para voltar ao zero: você precisa de estrondosos <strong>100% de lucro</strong> apenas para empatar.
                                    </p>
                                    <div className="bg-muted/10 border-l-4 border-emerald-500 p-4 mt-4 rounded-r-lg">
                                        <h4 className="font-bold text-emerald-500 text-sm mb-1">Como o Arbiter resolve isso?</h4>
                                        <p className="text-sm text-foreground/80">
                                            Se configurarmos <code>1%</code> no limite de risco do <strong>FOREX</strong>, o Arbiter Service faz o seguinte cálculo invisível antes de abrir a ordem:
                                        </p>
                                        <ul className="list-disc pl-5 mt-2 text-sm text-muted-foreground">
                                            <li>Ele pega seu capital real ($1.000). 1% = $10.</li>
                                            <li>Ele analisa o Stop Loss matemático da Estratégia (ex: 200 pontos de distância).</li>
                                            <li>Ele <strong>divide e encolhe o Volume de Lotes</strong> perfeitamente até que 200 pontos valham exatamente $10 no Metatrader.</li>
                                            <li><strong className="text-foreground">O resultado?</strong> O mercado pode fazer a loucura que for e despencar 200 pontos de uma vez; você será stopado com apenas míseros $10 de arranhão, garantindo vida longa no jogo.</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Seção 2: Spread vs ATR */}
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <span className="w-8 h-8 rounded bg-orange-500/20 text-orange-500 flex items-center justify-center text-sm">2</span>
                                        O Mito do Spread "Caro" ou "Barato"
                                    </h3>
                                    <p className="text-muted-foreground leading-relaxed">
                                        Um erro letal é travar o Spread Max de todos os ativos no mesmo valor (Exemplo: 50 Pontos). O Custo (Spread) de um ativo é absolutamente <strong>irrelevante</strong> por si só. Ele só existe em relação ao prêmio que ele oferece, medido pelo <strong>ATR</strong> (Average True Range).
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                        <div className="bg-muted/20 border border-border/30 p-4 rounded-lg">
                                            <h4 className="font-bold text-foreground text-sm">A Armadilha do Câmbio (EURUSD)</h4>
                                            <p className="text-xs text-muted-foreground mt-2">Um spread de <strong>60 pontos</strong> no EURUSD é um veneno puro. O EURUSD geralmente possui um ATR minúsculo de 400 pontos diários. Pagar 60 pra entrar significa deixar mais de 15% do seu percurso engolido só de pedágio pela corretora.</p>
                                        </div>
                                        <div className="bg-muted/20 border border-border/30 p-4 rounded-lg">
                                            <h4 className="font-bold text-foreground text-sm">O Ouro Indomável (XAUUSD)</h4>
                                            <p className="text-xs text-muted-foreground mt-2">Você aceita pagar gritantes <strong>120 pontos</strong> de spread para entrar no Ouro com sorriso no rosto. Por quê? Porque o ATR diário dele passa de 2000 pontos! 120 pontos no Ouro não faz nem cócegas (apenas 6%) na avalanche de distância que ele anda a seu favor.</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Seção 3: Ativos Exóticos */}
                                <div>
                                    <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
                                        <span className="w-8 h-8 rounded bg-purple-500/20 text-purple-500 flex items-center justify-center text-sm">3</span>
                                        Peculiaridades do Mercado MT5
                                    </h3>

                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="font-mono text-purple-400 font-bold shrink-0">CRYPTO</div>
                                            <div>
                                                <p className="text-sm text-foreground mb-1">Spread recomendável: <strong>800+</strong> | Risco recomendável: <strong>2% a 5%</strong></p>
                                                <p className="text-xs text-muted-foreground">O mercado de criptomoedas em plataformas como MetaTrader não opera no sistema de Order Book Spot, mas sim como um derivativo (CFD) fechado com o provedor de liquidez daquela corretora. Isso resulta em <em>spreads desastrosamente largos</em> nos finais de semana. Se travar cripto em 50pts, o robô jamais entrará num trade. Além disso, pelo alto custo alavancado e micro-volumes permitidos nas exchanges, elevar a fração de risco pra 2%~5% costuma ser fundamental para ultrapassar o "Breakeven" financeiro da corretora.</p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="font-mono text-purple-400 font-bold shrink-0">INDICES</div>
                                            <div>
                                                <p className="text-sm text-foreground mb-1">Spread recomendável: <strong>250+</strong></p>
                                                <p className="text-xs text-muted-foreground">Índices (US30, NAS100) são propensos a "Gaps de Abertura" letais onde a vela abre dezenas de pontos saltados acima da antiga, rasgando Stops no pulo do mercado. A proteção via <strong>Buffer de Slippage</strong> (Derrapagem) é crítica aqui, e os algoritmos do RLTrader injetam um "chute matemático" mitigando essa derrapagem caso ela atropele as intenções primárias do Order_Draft.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                </div>
            </div>
            {/* Minimal Background gradient flare specific to the overlay */}
            <div className="absolute top-0 right-0 w-full h-[300px] bg-primary/5 pointer-events-none rounded-bl-full mix-blend-screen" />
        </div>
    );
};
