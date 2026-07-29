# Caching in NestJS

NestJS provides a built-in caching module that abstracts over different cache stores (in-memory, Redis, Memcached) with a consistent API. It supports cache-aside, TTL-based expiration, and automatic cache key generation.

## Setting Up Cache

```typescript
import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      host: 'localhost',
      port: 6379,
      ttl: 60, // seconds
      max: 100, // maximum number of items
    }),
  ],
})
export class AppModule {}
```

The `ttl` option sets the default time-to-live for cache entries. Individual entries can override this. The `max` option limits the cache size to prevent memory leaks — when exceeded, the least recently used entries are evicted.

## Using the Cache

```typescript
@Injectable()
export class ProductService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getProduct(id: string): Promise<Product> {
    const cacheKey = `product:${id}`;
    
    // Try cache first
    const cached = await this.cacheManager.get<Product>(cacheKey);
    if (cached) {
      return cached;
    }

    // Cache miss — fetch from database
    const product = await this.db.findOne(id);

    // Store in cache with custom TTL
    await this.cacheManager.set(cacheKey, product, 300); // 5 minutes
    return product;
  }
}
```

This is the cache-aside pattern. Data is loaded lazily on cache miss and stored for subsequent requests. The cache key follows a `entity:id` convention to avoid collisions.

## Auto-Caching with Interceptors

```typescript
import { CacheInterceptor } from '@nestjs/common';

@Controller('products')
@UseInterceptors(CacheInterceptor)
export class ProductController {
  @Get(':id')
  getProduct(@Param('id') id: string) {
    return this.productService.getProduct(id);
  }
}
```

The `CacheInterceptor` automatically caches GET responses. The cache key is derived from the route and query parameters. When a POST, PUT, or DELETE request modifies data, you can invalidate related cache entries using `@CacheKey` and `@CacheTTL` decorators for fine-grained control.

## Cache Invalidation

Stale data is the biggest problem with caching. NestJS doesn't have automatic cache invalidation — you must manage it manually:

```typescript
@Injectable()
export class ProductService {
  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const product = await this.db.update(id, data);
    
    // Invalidate specific cache entry
    await this.cacheManager.del(`product:${id}`);
    
    // Invalidate list caches (pattern-based)
    // Note: cache-manager doesn't support pattern deletion natively
    // Use Redis SCAN for pattern-based invalidation
    if (this.cacheManager.store instanceof RedisCache) {
      const keys = await this.cacheManager.store.keys('product:*');
      await Promise.all(keys.map(k => this.cacheManager.del(k)));
    }
    
    return product;
  }
}
```

For Redis-backed caches, pattern deletion is essential. Without it, updating a product leaves list endpoints (like `GET /products?category=electronics`) serving stale data. The solution is either: store list results with a short TTL (30 seconds), invalidate selectively when you know which lists contain the product, or use a write-through cache where the cache is updated on write, not invalidated.

## Performance

With Redis caching, a typical NestJS API serving 1000 requests/second with a 70% cache hit rate reduces database load by 70%. Each cache hit takes 1-3ms (Redis network round-trip) vs 10-50ms for a database query. The cache-aside pattern is simple and effective — I've used it in production for e-commerce, social media feeds, and real-time dashboards. The only tricky part is invalidation: aggressive TTLs (5 minutes) keep data fresh enough for most use cases and avoid the complexity of event-driven invalidation.