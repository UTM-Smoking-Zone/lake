from typing import Dict, Optional, List
import time
from datetime import datetime, timedelta
from collections import deque

class DataQualityMetrics:
    """Track data quality metrics over time"""
    def __init__(self, window_size=1000):
        self.window_size = window_size
        self.total_records = 0
        self.failed_completeness = 0
        self.failed_validity = 0
        self.failed_consistency = 0
        self.failed_timeliness = 0
        self.failed_accuracy = 0
        self.recent_prices = deque(maxlen=100)  # For anomaly detection
        self.last_timestamps = {}  # Per symbol

    def record_failure(self, failure_type: str):
        """Record a data quality failure"""
        if failure_type == 'completeness':
            self.failed_completeness += 1
        elif failure_type == 'validity':
            self.failed_validity += 1
        elif failure_type == 'consistency':
            self.failed_consistency += 1
        elif failure_type == 'timeliness':
            self.failed_timeliness += 1
        elif failure_type == 'accuracy':
            self.failed_accuracy += 1

    def record_success(self, record: Dict):
        """Record successful validation and update metrics"""
        self.total_records += 1

        # Track prices for anomaly detection
        if 'price' in record:
            self.recent_prices.append(float(record['price']))

        # Track timestamps per symbol for timeliness checks
        if 'symbol' in record and 'timestamp' in record:
            self.last_timestamps[record['symbol']] = record['timestamp']

    def get_quality_score(self) -> float:
        """Calculate overall data quality score (0-100)"""
        if self.total_records == 0:
            return 100.0

        total_failures = (
            self.failed_completeness +
            self.failed_validity +
            self.failed_consistency +
            self.failed_timeliness +
            self.failed_accuracy
        )

        success_rate = (self.total_records - total_failures) / self.total_records
        return round(success_rate * 100, 2)

    def get_report(self) -> Dict:
        """Get detailed quality report"""
        return {
            'total_records': self.total_records,
            'quality_score': self.get_quality_score(),
            'failures': {
                'completeness': self.failed_completeness,
                'validity': self.failed_validity,
                'consistency': self.failed_consistency,
                'timeliness': self.failed_timeliness,
                'accuracy': self.failed_accuracy
            },
            'failure_rate': round((self.failed_completeness + self.failed_validity +
                                 self.failed_consistency + self.failed_timeliness +
                                 self.failed_accuracy) / max(self.total_records, 1) * 100, 2)
        }

class DataValidator:
    """
    Comprehensive data quality validator implementing 5 quality dimensions:
    1. Completeness - all required fields present
    2. Validity - correct data types and value ranges
    3. Consistency - logical relationships between fields
    4. Timeliness - data freshness and ordering
    5. Accuracy - anomaly detection and outlier identification
    """

    # Field definitions
    REQUIRED_FIELDS = ['symbol', 'timestamp', 'price', 'volume', 'side', 'trade_id', 'source']
    VALID_SIDES = ['buy', 'sell']
    VALID_SOURCES = ['bybit', 'binance', 'coinbase']

    # Business rules
    MIN_PRICE = 0.00001  # Minimum valid price (crypto can be very small)
    MAX_PRICE = 10000000  # Maximum reasonable price ($10M)
    MIN_VOLUME = 0.000001  # Minimum volume
    MAX_VOLUME = 1000000  # Maximum reasonable volume per trade
    MAX_AGE_SECONDS = 300  # Data should not be older than 5 minutes
    PRICE_DEVIATION_THRESHOLD = 0.50  # 50% price deviation is anomaly

    def __init__(self):
        self.metrics = DataQualityMetrics()
        self.last_log_time = time.time()

    def validate_trade_record(self, record: Dict) -> bool:
        """
        Comprehensive validation with data quality tracking
        Returns True if record passes all quality checks
        """
        # 1. Completeness check
        if not self._check_completeness(record):
            self.metrics.record_failure('completeness')
            return False

        # 2. Validity check (types and ranges)
        if not self._check_validity(record):
            self.metrics.record_failure('validity')
            return False

        # 3. Consistency check (logical relationships)
        if not self._check_consistency(record):
            self.metrics.record_failure('consistency')
            return False

        # 4. Timeliness check (data freshness)
        if not self._check_timeliness(record):
            self.metrics.record_failure('timeliness')
            return False

        # 5. Accuracy check (anomaly detection)
        if not self._check_accuracy(record):
            self.metrics.record_failure('accuracy')
            return False

        # Record successful validation
        self.metrics.record_success(record)

        # Log quality metrics periodically
        current_time = time.time()
        if current_time - self.last_log_time > 60:  # Every 60 seconds
            report = self.metrics.get_report()
            print(f"\n📊 Data Quality Report:")
            print(f"   Quality Score: {report['quality_score']}%")
            print(f"   Total Records: {report['total_records']}")
            print(f"   Failures: {report['failures']}")
            self.last_log_time = current_time

        return True

    def _check_completeness(self, record: Dict) -> bool:
        """Check if all required fields are present"""
        return all(field in record for field in self.REQUIRED_FIELDS)

    def _check_validity(self, record: Dict) -> bool:
        """Check data types and value ranges"""
        try:
            # Validate price
            price = float(record['price'])
            if not (self.MIN_PRICE <= price <= self.MAX_PRICE):
                return False

            # Validate volume
            volume = float(record['volume'])
            if not (self.MIN_VOLUME <= volume <= self.MAX_VOLUME):
                return False

            # Validate side
            if record.get('side') not in self.VALID_SIDES:
                return False

            # Validate source
            source = str(record['source']).lower()
            if source not in self.VALID_SOURCES:
                return False

            # Validate string fields are not empty
            if not record['symbol'] or not record['trade_id']:
                return False

            return True

        except (ValueError, TypeError, KeyError):
            return False

    def _check_consistency(self, record: Dict) -> bool:
        """Check logical relationships between fields"""
        try:
            # Symbol should match expected format (e.g., BTCUSDT)
            symbol = str(record['symbol']).upper()
            if not symbol.endswith('USDT') or len(symbol) < 5:
                return False

            # Trade ID should not be empty or zero
            trade_id = str(record['trade_id'])
            if not trade_id or trade_id == '0':
                return False

            return True

        except (ValueError, KeyError):
            return False

    def _check_timeliness(self, record: Dict) -> bool:
        """Check if data is fresh and properly ordered"""
        try:
            timestamp = record['timestamp']

            # Parse timestamp to datetime if it's a string
            if isinstance(timestamp, str):
                # Try parsing ISO format
                try:
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                except:
                    # Try parsing as Unix timestamp
                    dt = datetime.fromtimestamp(float(timestamp))
            elif isinstance(timestamp, (int, float)):
                dt = datetime.fromtimestamp(timestamp)
            elif isinstance(timestamp, datetime):
                dt = timestamp
            else:
                return False

            # Check if data is not too old
            now = datetime.now()
            age_seconds = (now - dt).total_seconds()

            if age_seconds > self.MAX_AGE_SECONDS:
                return False

            # Check if timestamp is not in the future
            if age_seconds < -10:  # Allow 10 seconds clock skew
                return False

            return True

        except (ValueError, TypeError, KeyError):
            return False

    def _check_accuracy(self, record: Dict) -> bool:
        """Check for anomalies and outliers"""
        try:
            price = float(record['price'])

            # If we have enough historical data, check for anomalies
            if len(self.metrics.recent_prices) >= 10:
                avg_price = sum(self.metrics.recent_prices) / len(self.metrics.recent_prices)

                # Check if price deviates too much from recent average
                if avg_price > 0:
                    deviation = abs(price - avg_price) / avg_price

                    if deviation > self.PRICE_DEVIATION_THRESHOLD:
                        # Price changed more than 50% suddenly - likely error
                        return False

            return True

        except (ValueError, TypeError, KeyError):
            return False

    def get_quality_metrics(self) -> Dict:
        """Get current data quality metrics"""
        return self.metrics.get_report()
