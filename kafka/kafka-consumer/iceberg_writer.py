from pyiceberg.catalog import load_catalog
from pyiceberg.schema import Schema
from pyiceberg.types import NestedField, StringType, TimestampType
from pyiceberg.partitioning import PartitionSpec, PartitionField
from pyiceberg.transforms import IdentityTransform
from pyiceberg.exceptions import CommitFailedException

from config import IcebergConfig

import pyarrow as pa
import time
import random


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

        print("Iceberg catalog create succesfully.")

        return catalog
    
    def _create_table(self):
        schema = Schema(
            NestedField(1, "symbol", StringType()),
            NestedField(5, "side", StringType()),
            NestedField(7, "source", StringType()),
            NestedField(6, "trade_id", StringType()),
            NestedField(2, "timestamp", TimestampType()),
            NestedField(8, "processing_time", TimestampType()),
            NestedField(9, "date_partition", DateType()),
            NestedField(3, "price", DoubleType()),
            NestedField(4, "volume", DoubleType()),
        )

        partition_spec = PartitionSpec([
            PartitionField(
                source_id=9,
                field_id=1000,
                transform=IdentityTransform(),
                name="date_partition"
            )
        ])

        try:
            table = self.catalog.load_table("bronze.crypto_trades")
            print("Loaded existing Iceberg table")
        except Exception:
            
            if ("bronze",) not in self.catalog.list_namespaces():
                self.catalog.create_namespace("bronze")
            
            table = self.catalog.create_table(
                "bronze.crypto_trades",
                schema=schema,
                partition_spec=partition_spec
            )
            print("Created new Iceberg table")
            
        return table
    
    def write_batch(self, records, max_retries=3):
        if not records:
            return
            
        for attempt in range(max_retries):
            try:
                self.table.refresh()
                records.sort(key=lambda x: (x['timestamp'], x['symbol'], x['side']))
                
                arrow_table = self._create_arrow_table(records)
                self.table.append(arrow_table)
                
                print(f"Successfully saved {len(records)} records to Iceberg")
                return
                
            except CommitFailedException as e:
                if "branch main has changed" in str(e) and attempt < max_retries - 1:
                    wait_time = (2**attempt) + random.uniform(0, 1)
                    print(f"Commit conflict, retrying in {wait_time:.1f}s")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"Failed to save after {max_retries} attempts")
                    break
                    
            except Exception as e:
                print(f"Error saving to Iceberg: {e}")
                break
    
    def _create_arrow_table(self, records):
        return pa.Table.from_pydict({
            'symbol': pa.array([row['symbol'] for row in records], 
                             type=pa.dictionary(pa.int8(), pa.string())),
            'side': pa.array([row['side'] for row in records],
                           type=pa.dictionary(pa.int8(), pa.string())),
            'source': pa.array([row['source'] for row in records],
                             type=pa.dictionary(pa.int8(), pa.string())),
            'trade_id': pa.array([row['trade_id'] for row in records]),
            'timestamp': pa.array([row['timestamp'] for row in records]),
            'processing_time': pa.array([row['processing_time'] for row in records]),
            'date_partition': pa.array([row['date_partition'] for row in records]),
            'price': pa.array([row['price'] for row in records], type=pa.float64()),
            'volume': pa.array([row['volume'] for row in records], type=pa.float64()),
        })