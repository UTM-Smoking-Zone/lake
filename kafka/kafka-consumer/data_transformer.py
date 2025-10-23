from datetime import datetime
from typing import Dict


class DataTransformer:
    @staticmethod
    def transform_trade_record(record: Dict, topic: str) -> Dict:
        symbol = DataTransformer._extract_symbol(topic)

        trade_timestamp = DataTransformer._convert_timestamp(record.get("T", 0))

        return {
            "symbol": symbol,
            "side": record.get("S", "UNKNOWN"),
            "source": "bybit",
            "trade_id": str(record.get("i", "")),
            "timestamp": trade_timestamp,
            "processing_time": datetime.now().replace(microsecond=0),
            "date_partition": trade_timestamp.date(),
            "price": float(record.get("p", 0)),
            "volume": float(record.get("v", 0)),
        }
    
    @staticmethod
    def _extract_symbol(topic: str) -> str: return topic.split("-")[0].upper() if "-" in topic else "BTCUSDT"

    @staticmethod
    def _convert_timestamp(timestamp_ms: int) -> datetime:
        return datetime.fromtimestamp(timestamp_ms / 1000)