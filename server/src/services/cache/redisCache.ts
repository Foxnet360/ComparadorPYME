import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3
});

export const cacheKeys = {
    embedding: (text: string) => `emb:${Buffer.from(text).toString('base64').substring(0, 32)}`,
    coverageMapping: (rawName: string, insurer?: string) => `map:${insurer || 'global'}:${Buffer.from(rawName).toString('base64').substring(0, 32)}`,
    clauseStructured: (insurer: string, product?: string) => `clause:${insurer}:${product || 'default'}`,
    searchResults: (query: string) => `search:${Buffer.from(query).toString('base64').substring(0, 32)}`,
    deductibleParsed: (text: string) => `deductible:${Buffer.from(text).toString('base64').substring(0, 32)}`
};

export const cacheTTL = {
    embedding: 60 * 60 * 24 * 7, // 7 days
    coverageMapping: 60 * 60 * 24 * 30, // 30 days
    clauseStructured: 60 * 60 * 24, // 1 day
    searchResults: 60 * 60, // 1 hour
    deductibleParsed: 60 * 60 * 24 * 30 // 30 days
};

export async function getCachedEmbedding(text: string): Promise<number[] | null> {
    try {
        const cached = await redis.get(cacheKeys.embedding(text));
        if (cached) {
            return JSON.parse(cached);
        }
        return null;
    } catch (error) {
        console.error('Redis get error:', error);
        return null;
    }
}

export async function setCachedEmbedding(text: string, embedding: number[]): Promise<void> {
    try {
        await redis.setex(
            cacheKeys.embedding(text),
            cacheTTL.embedding,
            JSON.stringify(embedding)
        );
    } catch (error) {
        console.error('Redis set error:', error);
    }
}

export async function getCachedCoverageMapping(rawName: string, insurer?: string): Promise<any | null> {
    try {
        const cached = await redis.get(cacheKeys.coverageMapping(rawName, insurer));
        if (cached) {
            return JSON.parse(cached);
        }
        return null;
    } catch (error) {
        console.error('Redis get error:', error);
        return null;
    }
}

export async function setCachedCoverageMapping(rawName: string, mapping: any, insurer?: string): Promise<void> {
    try {
        await redis.setex(
            cacheKeys.coverageMapping(rawName, insurer),
            cacheTTL.coverageMapping,
            JSON.stringify(mapping)
        );
    } catch (error) {
        console.error('Redis set error:', error);
    }
}

export async function getCachedDeductible(text: string): Promise<any | null> {
    try {
        const cached = await redis.get(cacheKeys.deductibleParsed(text));
        if (cached) {
            return JSON.parse(cached);
        }
        return null;
    } catch (error) {
        console.error('Redis get error:', error);
        return null;
    }
}

export async function setCachedDeductible(text: string, parsed: any): Promise<void> {
    try {
        await redis.setex(
            cacheKeys.deductibleParsed(text),
            cacheTTL.deductibleParsed,
            JSON.stringify(parsed)
        );
    } catch (error) {
        console.error('Redis set error:', error);
    }
}

export default redis;
