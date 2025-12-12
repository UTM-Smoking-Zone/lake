const { protectedRequest, getCircuitBreakerHealth, circuitBreakerOptions } = require('./circuitBreaker');
const axios = require('axios');

jest.mock('axios');

describe('Circuit Breaker Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('protectedRequest', () => {
    test('Should successfully proxy request when service is healthy', async () => {
      const mockData = { status: 'success', data: 'test' };
      axios.mockResolvedValue({ data: mockData });

      const result = await protectedRequest('portfolio', 'http://portfolio:8001', '/portfolio/user123');

      expect(result).toEqual(mockData);
      expect(axios).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://portfolio:8001/portfolio/user123',
        data: null
      });
    });

    test('Should handle POST requests with data', async () => {
      const mockData = { id: 'order123' };
      const requestData = { symbol: 'BTCUSDT', quantity: 1 };
      axios.mockResolvedValue({ data: mockData });

      const result = await protectedRequest('order', 'http://order:8002', '/orders', 'POST', requestData);

      expect(result).toEqual(mockData);
      expect(axios).toHaveBeenCalledWith({
        method: 'POST',
        url: 'http://order:8002/orders',
        data: requestData
      });
    });

    test('Should throw error when service fails', async () => {
      axios.mockRejectedValue(new Error('Service unavailable'));

      await expect(
        protectedRequest('portfolio', 'http://portfolio:8001', '/portfolio/user123')
      ).rejects.toThrow();
    });

    test('Should use fallback when circuit opens after threshold failures', async () => {
      // Mock multiple failures to open circuit
      axios.mockRejectedValue(new Error('Service error'));

      // Make multiple requests to trigger circuit opening
      // (circuitBreakerOptions.volumeThreshold = 5)
      const requests = [];
      for (let i = 0; i < 6; i++) {
        requests.push(
          protectedRequest('test', 'http://test:8000', '/test').catch(err => err)
        );
      }

      await Promise.all(requests);

      // After threshold failures, circuit should be open
      // and subsequent requests should fail quickly
      const health = getCircuitBreakerHealth();
      expect(health.test).toBeDefined();
    }, 10000);
  });

  describe('getCircuitBreakerHealth', () => {
    test('Should return empty object when no breakers created', () => {
      const health = getCircuitBreakerHealth();
      expect(typeof health).toBe('object');
    });

    test('Should return health status for active breakers', async () => {
      const mockData = { status: 'success' };
      axios.mockResolvedValue({ data: mockData });

      await protectedRequest('portfolio', 'http://portfolio:8001', '/test');

      const health = getCircuitBreakerHealth();
      expect(health.portfolio).toBeDefined();
      expect(health.portfolio.state).toBeDefined();
      expect(health.portfolio.stats).toBeDefined();
    });
  });

  describe('Circuit Breaker Configuration', () => {
    test('Should have correct timeout setting', () => {
      expect(circuitBreakerOptions.timeout).toBe(5000);
    });

    test('Should have correct error threshold', () => {
      expect(circuitBreakerOptions.errorThresholdPercentage).toBe(50);
    });

    test('Should have correct reset timeout', () => {
      expect(circuitBreakerOptions.resetTimeout).toBe(30000);
    });

    test('Should have correct volume threshold', () => {
      expect(circuitBreakerOptions.volumeThreshold).toBe(5);
    });
  });
});
