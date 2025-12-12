/**
 * Kafka Event Producer for Microservices
 * Handles event-driven communication between services
 */

const { Kafka } = require('kafkajs');

class KafkaEventProducer {
  constructor(brokers = ['kafka:9092']) {
    this.kafka = new Kafka({
      clientId: `${process.env.SERVICE_NAME || 'microservice'}-producer`,
      brokers: brokers,
      retry: {
        retries: 5,
        initialRetryTime: 300,
        factor: 2,
      },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });

    this.connected = false;
  }

  async connect() {
    try {
      await this.producer.connect();
      this.connected = true;
      console.log(`✅ Kafka producer connected (${process.env.SERVICE_NAME})`);
    } catch (error) {
      console.error(`❌ Failed to connect Kafka producer: ${error.message}`);
      throw error;
    }
  }

  async publishEvent(topic, event) {
    if (!this.connected) {
      console.warn('⚠️ Kafka producer not connected, attempting to connect...');
      await this.connect();
    }

    try {
      const message = {
        key: event.aggregateId || event.userId || event.id,
        value: JSON.stringify({
          ...event,
          timestamp: event.timestamp || new Date().toISOString(),
          service: process.env.SERVICE_NAME || 'unknown',
        }),
        headers: {
          'event-type': event.type,
          'correlation-id': event.correlationId || crypto.randomUUID(),
        },
      };

      await this.producer.send({
        topic,
        messages: [message],
      });

      console.log(`📤 Published event to ${topic}:`, event.type);
      return true;
    } catch (error) {
      console.error(`❌ Failed to publish event: ${error.message}`);
      return false;
    }
  }

  async disconnect() {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
      console.log('✅ Kafka producer disconnected');
    }
  }
}

// Event types constants
const EventTypes = {
  // User Service Events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_LOGIN: 'user.login',
  USER_DELETED: 'user.deleted',

  // Portfolio Service Events
  PORTFOLIO_CREATED: 'portfolio.created',
  PORTFOLIO_UPDATED: 'portfolio.updated',
  BALANCE_UPDATED: 'balance.updated',
  BALANCE_LOCKED: 'balance.locked',
  BALANCE_UNLOCKED: 'balance.unlocked',

  // Order Service Events
  ORDER_CREATED: 'order.created',
  ORDER_SUBMITTED: 'order.submitted',
  ORDER_FILLED: 'order.filled',
  ORDER_PARTIALLY_FILLED: 'order.partially_filled',
  ORDER_CANCELED: 'order.canceled',
  ORDER_REJECTED: 'order.rejected',
  ORDER_EXPIRED: 'order.expired',

  // Transaction Service Events
  TRANSACTION_CREATED: 'transaction.created',
  TRANSACTION_COMPLETED: 'transaction.completed',
  TRANSACTION_FAILED: 'transaction.failed',
  TRANSACTION_REVERSED: 'transaction.reversed',
};

// Topic names
const Topics = {
  USER_EVENTS: 'user-events',
  PORTFOLIO_EVENTS: 'portfolio-events',
  ORDER_EVENTS: 'order-events',
  TRANSACTION_EVENTS: 'transaction-events',
  BALANCE_EVENTS: 'balance-events',
};

module.exports = {
  KafkaEventProducer,
  EventTypes,
  Topics,
};
