from typing import Dict, Optional

class DataValidator:
    # Новый формат после трансформации producer
    REQUIRED_FIELDS = ['symbol', 'timestamp', 'price', 'volume', 'side', 'trade_id', 'source']
    VALID_SIDES = ['buy', 'sell']  # lowercase после трансформации

    @classmethod
    def validate_trade_record(cls, record: Dict) -> bool:
        if not cls._has_required_fields(record):
            return False

        if not cls._validate_field_types(record):
            return False

        if not cls._validate_side(record):
            return False

        return True

    @classmethod
    def _has_required_fields(cls, record: Dict) -> bool:
        return all(field in record for field in cls.REQUIRED_FIELDS)

    @classmethod
    def _validate_field_types(cls, record: Dict) -> bool:
        try:
            # Validate numeric fields
            float(record['price'])
            float(record['volume'])
            
            # Validate string fields
            str(record['symbol'])
            str(record['timestamp'])
            str(record['trade_id'])
            str(record['source'])
            
            return True
        
        except (ValueError, TypeError, KeyError):
            return False

    @classmethod
    def _validate_side(cls, record: Dict) -> bool:
        return record.get('side') in cls.VALID_SIDES
