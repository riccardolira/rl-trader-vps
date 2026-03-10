import time
from functools import wraps

class MemoryTTLCache:
    """A very lightweight in-memory cache with Time-To-Live expiration."""
    def __init__(self):
        self.store = {}

    def get(self, key, ttl):
        if key in self.store:
            val, timestamp = self.store[key]
            if time.time() - timestamp < ttl:
                return val
            else:
                del self.store[key]
        return None

    def set(self, key, value):
        self.store[key] = (value, time.time())

# Global cache instance for the decorator
_global_cache = MemoryTTLCache()

def async_ttl_cache(ttl_seconds: int = 3):
    """
    Decorator to cache the results of an async function for a specified number of seconds.
    This prevents database spamming when the frontend dashboard reloads frequently.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create a deterministic string key based on arguments
            key_parts = [func.__name__]
            
            # Skip 'self' or 'cls' if it's a method
            args_to_hash = args[1:] if args and hasattr(args[0], '__class__') else args
            key_parts.extend(str(a) for a in args_to_hash)
            key_parts.extend(f"{k}={v}" for k, v in kwargs.items())
            
            key = "|".join(key_parts)
            
            # Check cache
            cached_val = _global_cache.get(key, ttl_seconds)
            if cached_val is not None:
                return cached_val
            
            # Not in cache, or expired. Execute function:
            result = await func(*args, **kwargs)
            
            # Save to cache
            _global_cache.set(key, result)
            return result
        return wrapper
    return decorator
