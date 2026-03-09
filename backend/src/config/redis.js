const Redis = require('ioredis');
const logger = require('../utils/logger');

let client;

function getRedis() {
  if (!client) {
    throw new Error('Redis not initialized. Call connectRedis() first.');
  }
  return client;
}

async function connectRedis() {
  client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  client.on('error', (err) => logger.error('Redis error:', err.message));
  client.on('reconnecting', () => logger.warn('Redis reconnecting...'));

  await client.connect();
  return client;
}

module.exports = { connectRedis, getRedis };
