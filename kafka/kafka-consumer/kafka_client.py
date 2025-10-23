from confluent_kafka import Consumer
from typing import List, Optional, Dict

from config import KafkaConfig

import json


class KafkaClient:
    def __init__(self, config: KafkaConfig):
        self.consumer = Consumer(config.to_dict())

    def subscribe(self, topics: List[str]) -> None:
        self.consumer.subscribe(topics=topics)
        print(f"Subscribed to topics: {topics}")

    def poll_message(self, timeout: float = 1.0) -> Optional[Dict]:
        message = self.consumer.poll(timeout)

        if message is None: return None

        if message.error(): print(f"Consumer error: {message.error()}")

        return {
            'key': self._deserialize_message_key(message.key()),
            'value': self._deserialize_message_value(message.value()),
            'topic': message.topic(),
        }

    def close(self) -> None:
        self.consumer.close()
        print("Kafka consumer closed")

    @staticmethod
    def _deserialize_message_key(key: bytes) -> str:
        return key.decode('utf-8') if key else None

    @staticmethod
    def _deserialize_message_value(value: bytes) -> dict:
        return json.loads(value.decode('utf-8')) if value else {}
