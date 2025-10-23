# test_runner.py
import time
from consumer import CryptoConsumer

def main():
    print("Starting modular consumer test...")
    consumer = CryptoConsumer()
    
    try:
        consumer.start(["btcusdt-bybit"])
    except KeyboardInterrupt:
        print("Test stopped by user")
    except Exception as e:
        print(f"Test error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()