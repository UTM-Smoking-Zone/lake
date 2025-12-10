from pyiceberg.catalog import load_catalog
from pyiceberg.schema import Schema
from pyiceberg.types import (
    NestedField, StringType, TimestampType, DoubleType, DateType
)
from pyiceberg.partitioning import PartitionSpec, PartitionField
from pyiceberg.transforms import DayTransform
from pyiceberg.exceptions import CommitFailedException, NoSuchTableError
from config import IcebergConfig
import pyarrow as pa
import time
import random
from datetime import datetime

class IcebergWriter:
    def __init__(self, config: IcebergConfig):
        self.catalog = self._create_catalog(config)
        self.table = self._create_table()

    def _create_catalog(self, config: IcebergConfig):
        catalog = load_catalog("default", **{
            "type": "sql",
            "uri": config.catalog_uri,
            "warehouse": config.warehouse,
            "s3.endpoint": config.s3_endpoint,
            "s3.access-key-id": config.s3_access_key,
            "s3.secret-access-key": config.s3_secret_key,
            "s3.path-style-access": "true",
        })
        print("Iceberg catalog created successfully")
        return catalog
    
    def _create_table(self):
        try:
            table = self.catalog.load_table("bronze.crypto_trades")
            print("✅ Loaded existing Iceberg table")
            return table
        except (NoSuchTableError, FileNotFoundError, Exception) as e:
            print(f"⚠️ Table doesn't exist, creating new: {type(e).__name__}")
        
        schema = Schema(
            NestedField(1, "symbol", StringType()),
            NestedField(2, "timestamp", TimestampType()),  # WITHOUT timezone
            NestedField(3, "price", DoubleType()),
            NestedField(4, "volume", DoubleType()),
            NestedField(5, "side", StringType()),
            NestedField(6, "trade_id", StringType()),
            NestedField(7, "source", StringType()),
            NestedField(8, "processing_time", TimestampType()),  # WITHOUT timezone
            NestedField(9, "date_partition", DateType()),
        )

        partition_spec = PartitionSpec(
            PartitionField(
                source_id=2, field_id=1000,
                transform=DayTransform(), name="date_partition"
            )
        )

        try:
            if ("bronze",) not in self.catalog.list_namespaces():
                self.catalog.create_namespace("bronze")
        except: pass
        
        try:
            table = self.catalog.create_table(
                "bronze.crypto_trades", schema=schema, partition_spec=partition_spec
            )
            print("✅ Created new Iceberg table")
            return table
        except:
            table = self.catalog.load_table("bronze.crypto_trades")
            print("✅ Loaded table after create conflict")
            return table
    
    def write_batch(self, records, max_retries=3):
        if not records:
            return
        for attempt in range(max_retries):
            try:
                # Reload table to get latest metadata
                self.table = self.catalog.load_table("bronze.crypto_trades")
                records.sort(key=lambda x: (x['timestamp'], x['symbol'], x['side']))
                arrow_table = self._create_arrow_table(records)

                # PyIceberg 0.5.0+ uses different API for appending data
                # Use overwrite with append mode via update operation
                from pyiceberg.io.pyarrow import write_file
                from pyiceberg.table import TableProperties

                # Append data using the new API
                self.table.append(arrow_table)

                print(f"✅ Successfully saved {len(records)} records to Iceberg")
                return
            except AttributeError as e:
                # Fallback: try using write operation directly
                try:
                    import tempfile
                    import os

                    # Create arrow table
                    arrow_table = self._create_arrow_table(records)

                    # Write to temporary parquet file
                    with tempfile.NamedTemporaryFile(suffix='.parquet', delete=False) as tmp:
                        import pyarrow.parquet as pq
                        pq.write_table(arrow_table, tmp.name)
                        tmp_path = tmp.name

                    # Read and append using fast append
                    self.table = self.catalog.load_table("bronze.crypto_trades")
                    df_arrow = pq.read_table(tmp_path)

                    # Use overwrite for now (as append may not be available)
                    from pyiceberg.expressions import AlwaysTrue
                    self.table.overwrite(df_arrow)

                    os.unlink(tmp_path)
                    print(f"✅ Successfully saved {len(records)} records to Iceberg (via overwrite)")
                    return
                except Exception as fallback_err:
                    print(f"❌ Append failed: {e}, Overwrite failed: {fallback_err}")
                    break
            except CommitFailedException as e:
                if "branch main has changed" in str(e) and attempt < max_retries - 1:
                    wait_time = (2**attempt) + random.uniform(0, 1)
                    print(f"⚠️ Commit conflict, retrying in {wait_time:.1f}s")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"❌ Failed to save after {max_retries} attempts")
                    break
            except Exception as e:
                print(f"❌ Error saving to Iceberg: {e}")
                import traceback
                traceback.print_exc()
                break
    
    def _create_arrow_table(self, records):
        # Convert timezone-aware timestamps to naive (remove timezone)
        timestamps = []
        processing_times = []
        
        for row in records:
            ts = row['timestamp']
            if hasattr(ts, 'replace'):
                ts = ts.replace(tzinfo=None)  # Remove timezone
            timestamps.append(ts)
            
            pt = row['processing_time']
            if hasattr(pt, 'replace'):
                pt = pt.replace(tzinfo=None)  # Remove timezone
            processing_times.append(pt)
        
        return pa.Table.from_pydict({
            'symbol': pa.array([row['symbol'] for row in records], type=pa.string()),
            'timestamp': pa.array(timestamps, type=pa.timestamp('us')),  # microseconds, NO timezone
            'price': pa.array([row['price'] for row in records], type=pa.float64()),
            'volume': pa.array([row['volume'] for row in records], type=pa.float64()),
            'side': pa.array([row['side'] for row in records], type=pa.string()),
            'trade_id': pa.array([row['trade_id'] for row in records]),
            'source': pa.array([row['source'] for row in records], type=pa.string()),
            'processing_time': pa.array(processing_times, type=pa.timestamp('us')),  # NO timezone
            'date_partition': pa.array([row['date_partition'] for row in records]),
        })