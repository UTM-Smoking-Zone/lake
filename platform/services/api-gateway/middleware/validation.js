const Joi = require('joi');

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false, // Return all errors, not just first
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace request property with validated value
    req[property] = value;
    next();
  };
};

/**
 * Common validation schemas
 */
const schemas = {
  // User registration
  register: Joi.object({
    email: Joi.string().email().required()
      .messages({
        'string.email': 'Email must be a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string().min(8).max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
        'any.required': 'Password is required'
      }),
    name: Joi.string().min(2).max(100).optional()
  }),

  // User login
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  // Order creation
  createOrder: Joi.object({
    portfolio_id: Joi.string().uuid().required()
      .messages({
        'string.guid': 'portfolio_id must be a valid UUID',
        'any.required': 'portfolio_id is required'
      }),
    symbol: Joi.string().regex(/^[A-Z]{2,10}USDT$/).required()
      .messages({
        'string.pattern.base': 'symbol must be in format XXXUSDT (e.g., BTCUSDT)',
        'any.required': 'symbol is required'
      }),
    type: Joi.string().valid('market', 'limit', 'stop', 'stop_limit').required()
      .messages({
        'any.only': 'type must be one of: market, limit, stop, stop_limit'
      }),
    side: Joi.string().valid('buy', 'sell').required()
      .messages({
        'any.only': 'side must be either buy or sell'
      }),
    quantity: Joi.number().positive().max(1000).required()
      .messages({
        'number.positive': 'quantity must be positive',
        'number.max': 'quantity cannot exceed 1000',
        'any.required': 'quantity is required'
      }),
    price: Joi.number().positive().when('type', {
      is: Joi.string().valid('limit', 'stop_limit'),
      then: Joi.required(),
      otherwise: Joi.optional()
    }).messages({
      'number.positive': 'price must be positive',
      'any.required': 'price is required for limit orders'
    }),
    exchange_code: Joi.string().valid('BINANCE', 'BYBIT', 'COINBASE').default('BINANCE')
  }),

  // User ID parameter
  userId: Joi.object({
    userId: Joi.string().uuid().required()
      .messages({
        'string.guid': 'userId must be a valid UUID'
      })
  }),

  // Analytics query
  analyticsQuery: Joi.object({
    symbol: Joi.string().regex(/^[A-Z]{2,10}USDT$/).required(),
    indicators: Joi.string().regex(/^[a-z,]+$/).required()
      .messages({
        'string.pattern.base': 'indicators must be comma-separated lowercase values (e.g., sma,rsi,macd)'
      })
  }),

  // ML prediction query
  mlPredictionQuery: Joi.object({
    symbol: Joi.string().regex(/^[A-Z]{2,10}USDT$/).required(),
    horizon: Joi.number().integer().min(1).max(1440).default(60)
      .messages({
        'number.min': 'horizon must be at least 1 minute',
        'number.max': 'horizon cannot exceed 1440 minutes (24 hours)'
      })
  })
};

module.exports = {
  validate,
  schemas
};
