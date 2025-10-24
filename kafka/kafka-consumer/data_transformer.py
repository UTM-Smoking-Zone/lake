from datetime import datetime
from typing import Dict

class DataTransformer:
    @staticmethod
    def transform_trade_record(record: Dict, topic: str) -> Dict:
        """
        Transform incoming trade record to internal format.
        Handles both old Bybit format (T, S, p, v) and new format (timestamp, side, price, volume)
        """
        # Handle new format (already transformed by producer)
        if "timestamp" in record and "side" in record:
            # Already in correct format, just ensure types
            timestamp = record.get("timestamp")
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            elif isinstance(timestamp, (int, float)):
                timestamp = datetime.fromtimestamp(timestamp / 1000)
            
            return {
                "symbol": record.get("symbol", "BTCUSDT"),
                "side": record.get("side", "unknown"),
                "source": record.get("source", "bybit"),
                "trade_id": str(record.get("trade_id", "")),
                "timestamp": timestamp,
                "processing_time": datetime.now(),
                "date_partition": timestamp.date(),
                "price": float(record.get("price", 0)),
                "volume": float(record.get("volume", 0)),
            }
        
        # Handle old Bybit raw format (fallback)
        else:
            symbol = DataTransformer._extract_symbol(topic)
            trade_timestamp = DataTransformer._convert_timestamp(record.get("T", 0))
            return {
                "symbol": symbol,
                "side": record.get("S", "UNKNOWN").lower(),
                "source": "bybit",
                "trade_id": str(record.get("i", "")),
                "timestamp": trade_timestamp,
                "processing_time": datetime.now(),
                "date_partition": trade_timestamp.date(),
                "price": float(record.get("p", 0)),
                "volume": float(record.get("v", 0)),
            }
    
    @staticmethod
    def _extract_symbol(topic: str) -> str:
        return topic.split("-")[0].upper() if "-" in topic else "BTCUSDT"
    
    @staticmethod
    def _convert_timestamp(timestamp_ms: int) -> datetime:
        return datetime.fromtimestamp(timestamp_ms / 1000) if timestamp_ms else datetime.now()
