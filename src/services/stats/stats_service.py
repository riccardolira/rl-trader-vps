import aiomysql
from src.infrastructure.database.connection import db_pool
from typing import List, Dict, Any
from datetime import datetime, timedelta
from src.infrastructure.config import settings
from src.domain.models import Trade

class StatsService:
    async def get_raw_trades(self, limit: int = 1000, start_dt: datetime = None, end_dt: datetime = None) -> List[Dict[str, Any]]:
        """Fetch raw closed trades from DB for analytics processing."""
        trades = []
        try:
            pool = await db_pool.get_pool()
            async with pool.acquire() as db:
                query = "SELECT * FROM trades WHERE status = 'CLOSED'"
                params = []
                if start_dt:
                    query += " AND close_time >= ?"
                    params.append(start_dt.isoformat())
                if end_dt:
                    query += " AND close_time <= ?"
                    params.append(end_dt.isoformat())
                    
                query += " ORDER BY close_time ASC LIMIT ?"
                params.append(limit)
                
                from src.domain.models import get_strategy_for_magic, get_asset_class
                
                async with db.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute(query.replace('?', '%s'), params)
                    async for row in cursor:
                        # Convert to standard Dictionary
                        tdict = row
                        # Ensure profit is float
                        tdict['profit'] = float(tdict.get('profit') or 0.0)
                        
                        # Dynamically decode Magic Number to Strategy Name to ensure historical accuracy
                        magic = tdict.get('magic')
                        strat = get_strategy_for_magic(magic) if magic else "Unknown"
                        if strat != "Unknown":
                            tdict['strategy_name'] = strat
                        else:
                            db_strat = tdict.get('strategy_name')
                            if not db_strat or db_strat == "Unknown":
                                tdict['strategy_name'] = "Unknown"
                            # Else, keep the original db_strat
                            
                        # Add dynamic asset class based on symbol
                        tdict['asset_class'] = get_asset_class(tdict['symbol']).value

                        trades.append(tdict)
        except Exception as e:
            from src.infrastructure.logger import log
            log.error(f"StatsService: Failed to fetch trades {e}")
        return trades

    def calculate_metrics(self, trades: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Crunch the numbers over the history to find Win Rate, Drawdown, etc."""
        if not trades:
            return {
                "total_trades": 0,
                "total_profit": 0.0,
                "win_rate": 0.0,
                "profit_factor": 0.0,
                "max_drawdown_amount": 0.0,
                "best_trade": 0.0,
                "worst_trade": 0.0,
                "symbol_performance": {},
                "capital_curve": []
            }

        total_profit = 0.0
        gross_profit = 0.0
        gross_loss = 0.0
        wins = 0
        peak_capital = 0.0
        max_dd = 0.0
        
        best_trade = float('-inf')
        worst_trade = float('inf')
        
        symbol_stats = {}
        strategy_stats = {}
        capital_curve = [] # [{name: 'T#1', pnl: 10.5}, ...]

        for i, t in enumerate(trades):
            profit = t['profit']
            symbol = t['symbol']
            strategy_name = t.get('strategy_name', 'Unknown')
            
            # Global Aggregation
            total_profit += profit
            capital_curve.append({"name": f"T#{i+1}", "val": round(total_profit, 2)})
            
            if total_profit > peak_capital:
                peak_capital = total_profit
            
            current_dd = peak_capital - total_profit
            if current_dd > max_dd:
                max_dd = current_dd

            if profit > 0:
                wins += 1
                gross_profit += profit
            else:
                gross_loss += abs(profit)
                
            if profit > best_trade: best_trade = profit
            if profit < worst_trade: worst_trade = profit
            
            # Symbol Aggregation
            if symbol not in symbol_stats:
                symbol_stats[symbol] = {"trades": 0, "wins": 0, "profit": 0.0}
            
            symbol_stats[symbol]["trades"] += 1
            if profit > 0: symbol_stats[symbol]["wins"] += 1
            symbol_stats[symbol]["profit"] += profit

            # Strategy Aggregation
            if strategy_name not in strategy_stats:
                strategy_stats[strategy_name] = {"trades": 0, "wins": 0, "profit": 0.0}
                
            strategy_stats[strategy_name]["trades"] += 1
            if profit > 0: strategy_stats[strategy_name]["wins"] += 1
            strategy_stats[strategy_name]["profit"] += profit

        win_rate = (wins / len(trades)) * 100.0 if trades else 0.0
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else float('inf')
        
        # Calculate symbol specific win rates
        for sym, stats in symbol_stats.items():
            stats["win_rate"] = (stats["wins"] / stats["trades"]) * 100.0 if stats["trades"] > 0 else 0.0
            stats["profit"] = round(stats["profit"], 2)

        # Calculate strategy specific win rates
        for strat, stats in strategy_stats.items():
            stats["win_rate"] = (stats["wins"] / stats["trades"]) * 100.0 if stats["trades"] > 0 else 0.0
            stats["profit"] = round(stats["profit"], 2)

        return {
            "total_trades": len(trades),
            "total_profit": round(total_profit, 2),
            "win_rate": round(win_rate, 2),
            "profit_factor": round(profit_factor, 2) if profit_factor != float('inf') else 999.0,
            "max_drawdown_amount": round(max_dd, 2),
            "best_trade": round(best_trade if best_trade != float('-inf') else 0.0, 2),
            "worst_trade": round(worst_trade if worst_trade != float('inf') else 0.0, 2),
            "symbol_performance": symbol_stats,
            "strategy_performance": strategy_stats,
            "capital_curve": capital_curve
        }

    async def get_dashboard_data(self, start_dt: datetime = None, end_dt: datetime = None) -> Dict[str, Any]:
        """Aggregate data specifically for the new Analytics Dashboard."""
        trades = await self.get_raw_trades(limit=5000, start_dt=start_dt, end_dt=end_dt) # Deep lookback with strict filters
        metrics = self.calculate_metrics(trades)
        
        # Prepare for REST payload
        return {
            "metrics": metrics,
            "recent_ledger": trades[-100:] if trades else [] # Only send last 100 for the table to avoid bloat
        }

    async def get_transparency_metrics(self) -> Dict[str, Any]:
        """Aggregate data for the Transparency & Analytics integration (Glass Box)."""
        metrics = {
            "funnel": {
                "generated": 0,
                "drafted": 0,
                "approved": 0,
                "executed": 0,
                "rejected_arbiter": 0,
                "rejected_guardian": 0
            },
            "guardian_rejections": {},
            "scanner_reasons": {},
            "feed": []
        }
        
        try:
            import json
            pool = await db_pool.get_pool()
            async with pool.acquire() as db:
                
                # 1. Funnel Stats
                funnel_query = "SELECT type, count(*) as count FROM audit_events GROUP BY type"
                async with db.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute(funnel_query)
                    async for row in cursor:
                        t = row["type"]
                        c = row["count"]
                        if t == "SIGNAL_GENERATED":
                            metrics["funnel"]["generated"] = c
                        elif t == "ORDER_DRAFTED":
                            metrics["funnel"]["drafted"] = c
                        elif t == "ORDER_APPROVED":
                            metrics["funnel"]["approved"] = c
                        elif t == "ORDER_FILLED":
                            metrics["funnel"]["executed"] = c
                        elif t == "ORDER_REJECTED":
                            metrics["funnel"]["rejected_guardian"] = c

                metrics["funnel"]["rejected_arbiter"] = metrics["funnel"]["generated"] - metrics["funnel"]["drafted"]

                # 1b. Strategy Signals
                metrics["strategy_signals"] = {}
                strategy_signals_query = "SELECT json_extract(payload_json, '$.strategy_name') as strategy_name, count(*) as count FROM audit_events WHERE type = 'SIGNAL_GENERATED' GROUP BY json_extract(payload_json, '$.strategy_name')"
                async with db.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute(strategy_signals_query)
                    async for row in cursor:
                        s_name = row["strategy_name"] or "Unknown"
                        metrics["strategy_signals"][s_name] = row["count"]
                
                # 2. Guardian Rejection Reasons (Pie chart)
                reject_query = "SELECT json_extract(payload_json, '$.reason') as reason, count(*) as count FROM audit_events WHERE type = 'ORDER_REJECTED' GROUP BY json_extract(payload_json, '$.reason')"
                async with db.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute(reject_query)
                    async for row in cursor:
                        reason = row["reason"] or "Unknown"
                        metrics["guardian_rejections"][reason] = row["count"]
                            
                # 3. Scanner Rejection Reasons (Pie chart from the most recent scan)
                scan_query = "SELECT payload_json FROM audit_events WHERE type = 'UNIVERSE_RANKING_COMPUTED' ORDER BY timestamp DESC LIMIT 1"
                async with db.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute(scan_query)
                    async for row in cursor:
                        try:
                            payload = json.loads(row["payload_json"])
                            reasons = payload.get("reasons", {})
                            metrics["scanner_reasons"] = reasons
                        except:
                            pass

                # 4. Live Feed (Latest 50 important events)
                feed_query = "SELECT timestamp, type, component, severity, payload_json FROM audit_events ORDER BY timestamp DESC LIMIT 50"
                async with db.cursor(aiomysql.DictCursor) as cursor:
                    await cursor.execute(feed_query)
                    async for row in cursor:
                        try:
                            metrics["feed"].append({
                                "timestamp": row["timestamp"],
                                "type": row["type"],
                                "component": row["component"],
                                "severity": row["severity"],
                                "payload": json.loads(row["payload_json"])
                            })
                        except:
                            pass
                            
        except Exception as e:
            from src.infrastructure.logger import log
            log.error(f"StatsService: Failed to fetch transparency metrics: {e}")
            
        return metrics

stats_service = StatsService()
