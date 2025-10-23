import threading
import time
from typing import List, Dict, Callable

from config import BatchConfig

class BatchManager:
    def __init__(self, config: BatchConfig, write_callback: Callable):
        self.batch_size = config.batch_size
        self.batch_timeout = config.batch_timeout
        self.write_callback = write_callback
        
        self.buffer = []
        self.buffer_lock = threading.Lock()
        self.last_save_time = time.time()
        
        # Start background thread for timeout-based saves
        self.timeout_thread = threading.Thread(target=self._timeout_saver, daemon=True)
        self.timeout_thread.start()
    
    def add_record(self, record: Dict) -> None:
        with self.buffer_lock:
            self.buffer.append(record)
            
            if len(self.buffer) >= self.batch_size:
                self._flush_buffer("batch_size")
    
    def _flush_buffer(self, reason: str) -> None:
        if not self.buffer:
            return
            
        print(f"Triggering save: {reason} ({len(self.buffer)} records)")
        records_to_save = self.buffer.copy()
        self.buffer.clear()
        self.last_save_time = time.time()
        
        # Write in separate thread to avoid blocking main loop
        write_thread = threading.Thread(
            target=self.write_callback,
            args=(records_to_save,)
        )
        write_thread.start()
    
    def _timeout_saver(self):
        while True:
            time.sleep(60)
            
            with self.buffer_lock:
                current_time = time.time()
                if (self.buffer and 
                    current_time - self.last_save_time > self.batch_timeout):
                    self._flush_buffer("timeout")
    
    def close(self):
        with self.buffer_lock:
            if self.buffer:
                self._flush_buffer("shutdown")