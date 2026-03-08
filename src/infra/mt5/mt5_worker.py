import sys
import multiprocessing
import traceback
import time
from datetime import datetime

# NOTE: This file runs in a SEPARATE PROCESS.
# Do NOT import complex project dependencies here if possible to keep it lightweight.
# Only import MetaTrader5 here.

def mt5_worker_loop(command_queue, result_queue, login_config):
    """
    Main loop for the isolated MT5 process.
    """
    try:
        import MetaTrader5 as mt5
    except ImportError:
        result_queue.put({"type": "FATAL", "error": "MetaTrader5 module not found"})
        return

    # 1. Initialize MT5
    init_kwargs = {}
    if login_config.get("path"):
        init_kwargs["path"] = login_config["path"]
    if login_config.get("login"):
        init_kwargs["login"] = login_config["login"]
    if login_config.get("password"):
        init_kwargs["password"] = login_config["password"]
    if login_config.get("server"):
        init_kwargs["server"] = login_config["server"]

    init_res = mt5.initialize(**init_kwargs)

    if not init_res:
        path = login_config.get("path")
        result_queue.put({"type": "FATAL", "error": f"Init failed (Path={path}): {mt5.last_error()}"})
        return

    # 2. Login
    if login_config.get("login"):
        authorized = mt5.login(
            login=login_config["login"],
            password=login_config["password"],
            server=login_config["server"]
        )
        if not authorized:
            result_queue.put({"type": "FATAL", "error": f"Login failed: {mt5.last_error()}"})
            mt5.shutdown()
            return

    # Ready Signal
    result_queue.put({"type": "READY", "info": mt5.terminal_info()._asdict()})

    while True:
        try:
            # Block until command received
            cmd_packet = command_queue.get()
            
            if cmd_packet is None: # Sentinel for shutdown
                break
                
            req_id = cmd_packet["id"]
            method = cmd_packet["method"]
            args = cmd_packet.get("args", [])
            kwargs = cmd_packet.get("kwargs", {})
            
            start_time = time.perf_counter()
            response = {"id": req_id, "status": "error", "data": None}

            try:
                # Dispatch Method
                if method == "shutdown":
                    break
                
                elif method == "get_account":
                    info = mt5.account_info()
                    if info:
                        response["data"] = info._asdict()
                        response["status"] = "ok"
                    else:
                        response["error"] = str(mt5.last_error())

                elif method == "get_positions":
                    positions = mt5.positions_get()
                    if positions is not None:
                        response["data"] = [p._asdict() for p in positions]
                        response["status"] = "ok"
                    else:
                        response["error"] = str(mt5.last_error())
                        
                elif method == "get_server_time":
                    # Proxy via Tick
                    symbol = args[0] if args and len(args) > 0 else "EURUSD"
                    tick = mt5.symbol_info_tick(symbol) # Configurable symbol
                    
                    if not tick:
                        # FALLBACK: Try to find ANY symbol that works to confirm connection
                        # This happens if the user configured a symbol that is not in Market Watch
                        # or is closed.
                        # We try a few majors or indices to be safe.
                        fallbacks = ["EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "ETHUSD", "XAUUSD", "WIN$N", "WDO$N"]
                        for fb in fallbacks:
                            if fb == symbol: continue
                            tick = mt5.symbol_info_tick(fb)
                            if tick:
                                response["data"] = tick.time
                                response["status"] = "ok"
                                response["note"] = f"Fallback used: {fb}"
                                break
                    else:
                        response["data"] = tick.time
                        response["status"] = "ok"

                    if "status" not in response or response["status"] != "ok":
                         response["status"] = "error"
                         response["error"] = f"Market likely closed (No Tick for {symbol} or fallbacks)"

                elif method == "get_symbol_info":
                    symbol = args[0]
                    ticks = mt5.symbol_info(symbol)
                    if ticks:
                        response["data"] = ticks._asdict()
                        response["status"] = "ok"
                    else:
                        response["error"] = str(mt5.last_error())

                elif method == "get_history":
                    # args: symbol, timeframe, start_pos, count
                    # Force limits to avoid OOM
                    symbol = args[0]
                    tf = args[1]
                    start = args[2]
                    count = min(args[3], 1000) # Hard limit 1000 candles
                    
                    rates = mt5.copy_rates_from_pos(symbol, tf, start, count)
                    if rates is not None:
                        # Convert numpy array to list of dicts/tuples for serialization
                        # This is heavy for IPC, be careful.
                        response["data"] = rates.tolist()
                        response["status"] = "ok"
                    else:
                        response["error"] = str(mt5.last_error())

                elif method == "get_history_deals":
                    from datetime import datetime
                    from_date = args[0]
                    to_date = args[1]
                    
                    deals = mt5.history_deals_get(from_date, to_date)
                    if deals is not None:
                        response["data"] = [d._asdict() for d in deals]
                        response["status"] = "ok"
                    else:
                        response["error"] = str(mt5.last_error())

                elif method == "order_send":
                    current_retry = 0
                    # Basic retry logic for IOC
                    while current_retry < 3:
                        res = mt5.order_send(kwargs.get("request"))
                        if res and res.retcode == mt5.TRADE_RETCODE_DONE:
                            response["data"] = res._asdict()
                            response["status"] = "ok"
                            break
                        elif res and res.retcode in [mt5.TRADE_RETCODE_REQUOTE, mt5.TRADE_RETCODE_PRICE_OFF, mt5.TRADE_RETCODE_CONNECTION]:
                             current_retry += 1
                             time.sleep(0.5 * current_retry) # Incremental backoff (0.5s, 1.0s, 1.5s)
                        else:
                            response["error"] = f"{res.comment if res else 'Unknown error'} ({res.retcode if res else 'N/A'})"
                            break
                    if response["status"] != "ok" and "error" not in response:
                         response["error"] = "Max retries exceeded"

                elif method == "close_position":
                    ticket = args[0]
                    # Get position details
                    positions = mt5.positions_get(ticket=ticket)
                    if positions is None or len(positions) == 0:
                        response["error"] = f"Position {ticket} not found or already closed."
                    else:
                        pos = positions[0]
                        # Support partial close
                        requested_volume = args[1] if len(args) > 1 and args[1] is not None else pos.volume
                        # Ensure we don't try to close more than we have
                        close_volume = min(float(requested_volume), pos.volume)

                        # Determine opposite type
                        close_type = mt5.ORDER_TYPE_SELL if pos.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY
                        
                        current_retry = 0
                        while current_retry < 3:
                            # Re-fetch tick inside retry loop for fresh price
                            tick = mt5.symbol_info_tick(pos.symbol)
                            price = tick.bid if close_type == mt5.ORDER_TYPE_SELL else tick.ask
                            
                            request = {
                                "action": mt5.TRADE_ACTION_DEAL,
                                "symbol": pos.symbol,
                                "volume": close_volume,
                                "type": close_type,
                                "position": pos.ticket,
                                "price": price,
                                "deviation": 20,
                                "magic": pos.magic,
                                "comment": "Manual Close User",
                                "type_time": mt5.ORDER_TIME_GTC,
                                "type_filling": mt5.ORDER_FILLING_IOC,
                            }
                            
                            res = mt5.order_send(request)
                            if res and res.retcode == mt5.TRADE_RETCODE_DONE:
                                response["data"] = res._asdict()
                                response["status"] = "ok"
                                break
                            elif res and res.retcode in [mt5.TRADE_RETCODE_REQUOTE, mt5.TRADE_RETCODE_PRICE_OFF, mt5.TRADE_RETCODE_CONNECTION]:
                                current_retry += 1
                                time.sleep(0.5 * current_retry) # Incremental backoff
                            else:
                                response["error"] = f"{res.comment if res else 'Unknown error'} ({res.retcode if res else 'N/A'})"
                                break
                        if response["status"] != "ok" and "error" not in response:
                             response["error"] = "Max retries exceeded for close."

                elif method == "modify_position":
                    ticket = args[0]
                    new_sl = args[1]
                    new_tp = args[2]

                    # Get position details to know symbol, type, price, etc.
                    positions = mt5.positions_get(ticket=ticket)
                    if positions is None or len(positions) == 0:
                        response["error"] = f"Position {ticket} not found for modification."
                    else:
                        pos = positions[0]
                        request = {
                            "action": mt5.TRADE_ACTION_SLTP,
                            "position": pos.ticket,
                            "symbol": pos.symbol,
                            "sl": float(new_sl) if new_sl is not None else pos.sl,
                            "tp": float(new_tp) if new_tp is not None else pos.tp,
                        }
                        
                        # Try to send modification
                        res = mt5.order_send(request)
                        if res and res.retcode == mt5.TRADE_RETCODE_DONE:
                            response["data"] = res._asdict()
                            response["status"] = "ok"
                        else:
                            response["error"] = f"{res.comment if res else 'Unknown error'} ({res.retcode if res else 'N/A'})"

                elif method == "symbol_info_tick":
                    symbol = args[0]
                    tick = mt5.symbol_info_tick(symbol)
                    if tick:
                        response["data"] = tick._asdict()
                        response["status"] = "ok"
                    else:
                        response["error"] = "Tick not found"

                elif method == "symbols_get":
                    symbols = mt5.symbols_get()
                    if symbols is not None:
                        # Extract names to avoid heavy IPC, filtering out invisible might be good, 
                        # but returning all is safer, let's return visible ones.
                        response["data"] = [s.name for s in symbols if s.visible]
                        response["status"] = "ok"
                    else:
                        response["error"] = str(mt5.last_error())

                elif method == "symbols_get_with_path":
                    symbols = mt5.symbols_get()
                    if symbols is not None:
                        # Return dict {name: path}
                        response["data"] = {s.name: getattr(s, 'path', '') for s in symbols if s.visible}
                        response["status"] = "ok"
                    else:
                        response["error"] = str(mt5.last_error())

                elif method == "get_calendar_events":
                    # args: start_time (timestamp), end_time (timestamp)
                    start_ts = args[0]
                    end_ts = args[1]
                    
                    if hasattr(mt5, "calendar_get"):
                        events = mt5.calendar_get(datetime.fromtimestamp(start_ts), datetime.fromtimestamp(end_ts))
                        if events is not None:
                             # Tuple of named tuples -> list of dicts
                             response["data"] = [e._asdict() for e in events]
                             response["status"] = "ok"
                        else:
                             response["error"] = str(mt5.last_error())
                    else:
                        response["error"] = "calendar_get not supported in this MT5 version"
                        
                elif method == "ping":
                    response["status"] = "ok"
                    response["data"] = "pong"

                
                elif method == "_simulate_hang": # For Testing
                    time.sleep(args[0])
                    response["status"] = "ok"

                else:
                    response["error"] = f"Unknown method: {method}"

            except Exception as e:
                response["error"] = f"Exception: {str(e)}"
                response["traceback"] = traceback.format_exc()

            response["duration"] = time.perf_counter() - start_time
            result_queue.put(response)

        except KeyboardInterrupt:
            break
        except Exception as e:
            # Fatal queue error?
            break
            
    mt5.shutdown()

if __name__ == "__main__":
    # This block ensures that if someone tries to run this script directly,
    # it doesn't do anything harmful or expected unless called via multiprocessing logic
    # But strictly for Windows 'spawn', the multiprocessing module imports the module
    # so top-level code runs. We put the worker loop inside a function to avoid side effects.
    pass
