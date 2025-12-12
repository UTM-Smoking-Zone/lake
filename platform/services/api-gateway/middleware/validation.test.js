const { validate, schemas } = require('./validation');

describe('Validation Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('schemas.register', () => {
    test('Should accept valid registration data', () => {
      req.body = {
        email: 'test@example.com',
        password: 'SecureP@ss123',
        name: 'Test User'
      };

      const middleware = validate(schemas.register);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('Should reject invalid email', () => {
      req.body = {
        email: 'invalid-email',
        password: 'SecureP@ss123'
      };

      const middleware = validate(schemas.register);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('Should reject weak password', () => {
      req.body = {
        email: 'test@example.com',
        password: 'weak'
      };

      const middleware = validate(schemas.register);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    test('Should reject password without special characters', () => {
      req.body = {
        email: 'test@example.com',
        password: 'NoSpecial123'
      };

      const middleware = validate(schemas.register);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('schemas.login', () => {
    test('Should accept valid login data', () => {
      req.body = {
        email: 'test@example.com',
        password: 'anypassword'
      };

      const middleware = validate(schemas.login);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('Should reject missing email', () => {
      req.body = {
        password: 'password123'
      };

      const middleware = validate(schemas.login);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('schemas.createOrder', () => {
    test('Should accept valid order data', () => {
      req.body = {
        portfolio_id: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTCUSDT',
        type: 'limit',
        side: 'buy',
        quantity: 0.5,
        price: 50000,
        exchange_code: 'BINANCE'
      };

      const middleware = validate(schemas.createOrder);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('Should reject invalid UUID for portfolio_id', () => {
      req.body = {
        portfolio_id: 'invalid-uuid',
        symbol: 'BTCUSDT',
        type: 'market',
        side: 'buy',
        quantity: 0.5
      };

      const middleware = validate(schemas.createOrder);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('Should reject invalid symbol format', () => {
      req.body = {
        portfolio_id: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTC',  // Should be BTCUSDT
        type: 'market',
        side: 'buy',
        quantity: 0.5
      };

      const middleware = validate(schemas.createOrder);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('Should reject negative quantity', () => {
      req.body = {
        portfolio_id: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTCUSDT',
        type: 'market',
        side: 'buy',
        quantity: -0.5
      };

      const middleware = validate(schemas.createOrder);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('Should reject quantity exceeding maximum', () => {
      req.body = {
        portfolio_id: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTCUSDT',
        type: 'market',
        side: 'buy',
        quantity: 1500  // Max is 1000
      };

      const middleware = validate(schemas.createOrder);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('Should require price for limit orders', () => {
      req.body = {
        portfolio_id: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTCUSDT',
        type: 'limit',
        side: 'buy',
        quantity: 0.5
        // Missing price
      };

      const middleware = validate(schemas.createOrder);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('Should not require price for market orders', () => {
      req.body = {
        portfolio_id: '550e8400-e29b-41d4-a716-446655440000',
        symbol: 'BTCUSDT',
        type: 'market',
        side: 'buy',
        quantity: 0.5
      };

      const middleware = validate(schemas.createOrder);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('Should accept valid exchange codes', () => {
      const exchanges = ['BINANCE', 'BYBIT', 'COINBASE'];

      exchanges.forEach(exchange => {
        req.body = {
          portfolio_id: '550e8400-e29b-41d4-a716-446655440000',
          symbol: 'BTCUSDT',
          type: 'market',
          side: 'buy',
          quantity: 0.5,
          exchange_code: exchange
        };

        next.mockClear();
        const middleware = validate(schemas.createOrder);
        middleware(req, res, next);

        expect(next).toHaveBeenCalled();
      });
    });
  });

  describe('schemas.userId', () => {
    test('Should accept valid UUID', () => {
      req.params = {
        userId: '550e8400-e29b-41d4-a716-446655440000'
      };

      const middleware = validate(schemas.userId, 'params');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('Should reject invalid UUID', () => {
      req.params = {
        userId: 'not-a-uuid'
      };

      const middleware = validate(schemas.userId, 'params');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('schemas.analyticsQuery', () => {
    test('Should accept valid analytics query', () => {
      req.query = {
        symbol: 'BTCUSDT',
        indicators: 'sma,rsi,macd'
      };

      const middleware = validate(schemas.analyticsQuery, 'query');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('Should reject invalid indicators format', () => {
      req.query = {
        symbol: 'BTCUSDT',
        indicators: 'SMA,RSI'  // Should be lowercase
      };

      const middleware = validate(schemas.analyticsQuery, 'query');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('schemas.mlPredictionQuery', () => {
    test('Should accept valid ML prediction query', () => {
      req.query = {
        symbol: 'BTCUSDT',
        horizon: 60
      };

      const middleware = validate(schemas.mlPredictionQuery, 'query');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('Should use default horizon if not provided', () => {
      req.query = {
        symbol: 'BTCUSDT'
      };

      const middleware = validate(schemas.mlPredictionQuery, 'query');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.query.horizon).toBe(60);  // Default value
    });

    test('Should reject horizon exceeding maximum', () => {
      req.query = {
        symbol: 'BTCUSDT',
        horizon: 2000  // Max is 1440
      };

      const middleware = validate(schemas.mlPredictionQuery, 'query');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('Should reject horizon below minimum', () => {
      req.query = {
        symbol: 'BTCUSDT',
        horizon: 0
      };

      const middleware = validate(schemas.mlPredictionQuery, 'query');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validate middleware factory', () => {
    test('Should strip unknown fields', () => {
      req.body = {
        email: 'test@example.com',
        password: 'SecureP@ss123',
        unknownField: 'should be removed'
      };

      const middleware = validate(schemas.login);
      middleware(req, res, next);

      expect(req.body.unknownField).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    test('Should return all validation errors', () => {
      req.body = {
        // Missing all required fields
      };

      const middleware = validate(schemas.login);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.any(Array)
        })
      );
    });
  });
});
