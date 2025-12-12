from dataclasses import dataclass, asdict

@dataclass
class KafkaConfig:
    bootstrap_servers: str = "kafka:9092"
    group_id: str = "crypto-iceberg-consumer-v3-compressed" 
    auto_offset_reset: str = "latest"
    enable_auto_commit: bool = True
    auto_commit_interval_ms: int = 1000
    
    def to_dict(self):
        return {
            'bootstrap.servers': self.bootstrap_servers,
            'group.id': self.group_id,
            'auto.offset.reset': self.auto_offset_reset,
            'enable.auto.commit': self.enable_auto_commit,
            'auto.commit.interval.ms': self.auto_commit_interval_ms
        }

@dataclass
class IcebergConfig:
    catalog_uri: str = "postgresql://admin:admin123@postgres:5432/lakehouse"
    warehouse: str = "s3://warehouse/"
    s3_endpoint: str = "http://minio:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin123"

@dataclass
class BatchConfig:
    # Optimized for real-time processing with micro-batching
    batch_size: int = 100  # Reduced from 5000 for lower latency
    batch_timeout: int = 5  # Reduced from 600s (10 min) to 5s for real-time
    max_retries: int = 3