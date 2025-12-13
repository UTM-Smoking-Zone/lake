/**
 * Shared database connection pool configuration
 * Optimized for microservices architecture
 */
module.exports = {
  // Maximum number of clients in the pool
  max: 20,

  // Minimum number of clients in the pool
  min: 2,

  // How long a client is allowed to remain idle before being closed (30 seconds)
  idleTimeoutMillis: 30000,

  // Maximum time to wait for a connection (3 seconds)
  connectionTimeoutMillis: 3000,

  // Log SQL queries in development
  log: process.env.NODE_ENV === 'development' ? console.log : undefined,

  // Statement timeout - queries taking longer than 30s will be cancelled
  statement_timeout: 30000,

  // Keep connections alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
};
