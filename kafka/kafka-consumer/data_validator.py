from typing import Dict, Optional

class DataValidator:
    REQUIRED_FIELDS = ['T', 'p', 'v', 'S']
    VALID_SIDES = ['Buy', 'Sell']

    @classmethod
    def validate_trade_record(cls, record: Dict) -> bool:
        if not cls._has_required_fields(record): return False

        if not cls._validate_field_types(record): return False

        if not cls._validate_side(record): return False

        return True

    @classmethod
    def _has_required_fields(cls, record: Dict) -> bool:
        return all(field in record for field in cls.REQUIRED_FIELDS)

    @classmethod
    def _validate_field_types(cls, record: Dict) -> bool:
        try:
            float(record['p'])
            float(record['v'])
            int(record['T'])

            return True
        
        except (ValueError, TypeError): return False

    @classmethod
    def _validate_side(cls, record: Dict) -> bool:
        return record.get('S') in cls.VALID_SIDES