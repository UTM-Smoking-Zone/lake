FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY platform/back/ingestion-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy kafka-consumer modules
COPY kafka/kafka-consumer/*.py ./kafka-consumer/

# Copy ingestion service code
COPY platform/back/ingestion-service/*.py ./

CMD ["python3", "-u", "main.py"]
