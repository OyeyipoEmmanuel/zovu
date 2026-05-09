"""
Async Redis client with logical database separation.
db=0: application cache
db=1: token blacklist + rate limits
db=2: Celery broker + results
db=3: sessions + device fingerprints
"""
from redis.asyncio import Redis
from src.config import settings


class RedisClient:
    """Async Redis pool manager with 4 logical databases."""
    
    def __init__(self):
        self._redis_pools = {}
    
    async def get_pool(self, db: int = 0) -> Redis:
        """Get or create Redis pool for given logical database."""
        if db not in self._redis_pools:
            self._redis_pools[db] = await Redis.from_url(
                settings.REDIS_URL,
                db=db,
                decode_responses=False,  # Keep binary for security ops
                max_connections=20,
            )
        return self._redis_pools[db]
    
    async def close_all(self):
        """Close all Redis connections."""
        for pool in self._redis_pools.values():
            await pool.close()


redis_client = RedisClient()


async def get_redis_db(db: int = 0) -> Redis:
    """Dependency to get Redis pool for specific database."""
    return await redis_client.get_pool(db)


async def get_redis_cache() -> Redis:
    """Get cache Redis pool (db=0)."""
    return await redis_client.get_pool(0)


async def get_redis_blacklist() -> Redis:
    """Get blacklist/rate-limit Redis pool (db=1)."""
    return await redis_client.get_pool(1)


async def get_redis_sessions() -> Redis:
    """Get sessions/device fingerprint Redis pool (db=3)."""
    return await redis_client.get_pool(3)


async def close_redis():
    """Close all Redis connections (used in shutdown)."""
    await redis_client.close_all()
