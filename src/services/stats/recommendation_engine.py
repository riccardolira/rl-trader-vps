from typing import Dict, Any, List

class RecommendationEngine:
    def generate_insights(self, metrics: Dict[str, Any]) -> List[Dict[str, str]]:
        """
        Consumes the output of StatsService and returns a list of actionable insights.
        Format: [{"type": "warning|success|info", "title": "...", "text": "..."}]
        """
        insights = []
        
        # 1. Macro Health
        win_rate = metrics.get("win_rate", 0.0)
        profit_factor = metrics.get("profit_factor", 0.0)
        total_trades = metrics.get("total_trades", 0)
        
        if total_trades < 10:
            insights.append({
                "type": "info",
                "title": "Amostragem Baixa",
                "message": f"O sistema possui apenas {total_trades} trades fechados. Recomendações mais precisas surgirão após 30 operações."
            })
            return insights # Not enough data for deep analysis
            
        if profit_factor > 2.0:
             insights.append({
                 "type": "success",
                 "title": "Eficiência Excepcional",
                 "message": f"Seu Fator de Lucro é {profit_factor}. Você ganha mais que o dobro do que perde nas operações vencedoras vs perdedoras. Mantenha a agressividade."
             })
        elif profit_factor < 1.0:
            insights.append({
                 "type": "warning",
                 "title": "Risco de Ruína (Edge Negativo)",
                 "message": f"Fator de Lucro em {profit_factor}. O sistema está perdendo mais dinheiro do que ganhando no acumulado. Considere aumentar a seletividade de sinais."
             })
             
        # 2. Symbol Performance
        symbol_stats = metrics.get("symbol_performance", {})
        for symbol, stats in symbol_stats.items():
            s_trades = stats.get("trades", 0)
            if s_trades >= 5: # Minimum sample per symbol
                s_win_rate = stats.get("win_rate", 0.0)
                if s_win_rate < 30.0:
                     insights.append({
                         "type": "warning",
                         "title": f"Maus Resultados em {symbol}",
                         "message": f"A taxa de acerto em {symbol} é de apenas {s_win_rate:.1f}% em {s_trades} tentativas. Sugerimos bloquear este ativo no Painel Universe temporariamente."
                     })
                elif s_win_rate > 75.0:
                     insights.append({
                         "type": "success",
                         "title": f"Mina de Ouro: {symbol}",
                         "message": f"Desempenho estelar de {s_win_rate:.1f}% de acerto em {symbol}. O sistema demonstra alta sinergia com o comportamento atual deste ativo."
                     })
                     
        # 3. Capital Protection
        max_dd = metrics.get("max_drawdown_amount", 0.0)
        worst_trade = metrics.get("worst_trade", 0.0)
        total_profit = metrics.get("total_profit", 0.0)
        
        # If a single trade wiped out more than 30% of accumulated profit (if profitable)
        if total_profit > 0 and abs(worst_trade) > (total_profit * 0.3):
             insights.append({
                 "type": "warning",
                 "title": "Furo no Stop Loss",
                 "message": f"O seu pior trade bateu ${worst_trade}, apagando mais de 30% dos seus lucros acumulados totais. Revise as posições do seu Motor de Risco."
             })
             
        # Always return at least a baseline status if empty
        if not insights:
            insights.append({
                "type": "info",
                "title": "Sistema Equilibrado",
                "message": "Nenhum gargalo matemático severo encontrado. As estratégias estão rodando dentro das expectativas normais."
            })
            
        return insights

recommendation_engine = RecommendationEngine()
