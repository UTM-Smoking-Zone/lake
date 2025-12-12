const CircuitBreaker = require('opossum');
const axios = require('axios');

/**
 * Circuit Breaker configuration options
 */
const circuitBreakerOptions = {
  timeout: 5000, // If function takes longer than 5s, trigger a failure
  errorThresholdPercentage: 50, // When 50% of requests fail, open circuit
  resetTimeout: 30000, // After 30s, try again (half-open state)
  rollingCountTimeout: 10000, // 10s rolling window for counting failures
  rollingCountBuckets: 10, // Number of buckets in rolling window
  name: 'serviceCircuitBreaker',
  volumeThreshold: 5, // Minimum number of requests before opening circuit
};

/**
 * Fallback function when circuit is open
 */
const fallbackFunction = (serviceName, error) => {
  console.error(`Circuit breaker fallback for ${serviceName}:`, error.message);
  return {
    error: 'Service temporarily unavailable',
    service: serviceName,
    status: 'circuit_open',
    message: 'The service is experiencing issues. Please try again later.'
  };
};

/**
 * Create a circuit breaker for a service call
 * @param {string} serviceName - Name of the service
 * @param {Function} asyncFunction - The async function to protect
 * @returns {CircuitBreaker} Circuit breaker instance
 */
function createServiceBreaker(serviceName, asyncFunction) {
  const breaker = new CircuitBreaker(asyncFunction, {
    ...circuitBreakerOptions,
    name: `${serviceName}CircuitBreaker`
  });

  // Fallback when circuit is open
  breaker.fallback((error) => fallbackFunction(serviceName, error));

  // Event listeners for monitoring
  breaker.on('open', () => {
    console.warn(`⚠️  Circuit breaker OPEN for ${serviceName} - service unavailable`);
  });

  breaker.on('halfOpen', () => {
    console.log(`🔄 Circuit breaker HALF-OPEN for ${serviceName} - testing service`);
  });

  breaker.on('close', () => {
    console.log(`✅ Circuit breaker CLOSED for ${serviceName} - service recovered`);
  });

  breaker.on('failure', (error) => {
    console.error(`❌ Circuit breaker failure for ${serviceName}:`, error.message);
  });

  breaker.on('success', () => {
    // Only log on state change to avoid spam
    if (breaker.opened || breaker.halfOpen) {
      console.log(`✅ Circuit breaker success for ${serviceName}`);
    }
  });

  return breaker;
}

/**
 * Circuit breakers for each microservice
 */
const serviceBreakers = {};

/**
 * Get or create circuit breaker for a service
 * @param {string} serviceName - Name of the service
 * @param {string} serviceUrl - Base URL of the service
 * @returns {CircuitBreaker} Circuit breaker instance
 */
function getServiceBreaker(serviceName, serviceUrl) {
  if (!serviceBreakers[serviceName]) {
    const asyncFunction = async (path, method = 'GET', data = null) => {
      const url = `${serviceUrl}${path}`;
      const response = await axios({ method, url, data });
      return response.data;
    };

    serviceBreakers[serviceName] = createServiceBreaker(serviceName, asyncFunction);
  }

  return serviceBreakers[serviceName];
}

/**
 * Protected proxy request using circuit breaker
 * @param {string} serviceName - Name of the service
 * @param {string} serviceUrl - Base URL of the service
 * @param {string} path - Request path
 * @param {string} method - HTTP method
 * @param {Object} data - Request data
 * @returns {Promise<Object>} Response data
 */
async function protectedRequest(serviceName, serviceUrl, path, method = 'GET', data = null) {
  const breaker = getServiceBreaker(serviceName, serviceUrl);

  try {
    const result = await breaker.fire(path, method, data);
    return result;
  } catch (error) {
    // If circuit is open, the fallback will be called automatically
    // If it's a regular error, throw it
    if (error.message && error.message.includes('circuit_open')) {
      throw new Error(`Service ${serviceName} is currently unavailable`);
    }
    throw new Error(`Service ${serviceName} error: ${error.message}`);
  }
}

/**
 * Get health status of all circuit breakers
 * @returns {Object} Health status of all services
 */
function getCircuitBreakerHealth() {
  const health = {};

  for (const [serviceName, breaker] of Object.entries(serviceBreakers)) {
    health[serviceName] = {
      state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
      stats: breaker.stats,
      enabled: breaker.enabled
    };
  }

  return health;
}

module.exports = {
  protectedRequest,
  getServiceBreaker,
  getCircuitBreakerHealth,
  circuitBreakerOptions
};
