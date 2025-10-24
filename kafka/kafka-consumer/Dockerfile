FROM python:3.9-slim

# Установить системные зависимости для PostgreSQL
RUN apt-get update && \
    apt-get install -y libpq-dev gcc && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Установить Python зависимости с PostgreSQL поддержкой
RUN pip install --no-cache-dir \
    numpy==1.24.4 \
    pyarrow==12.0.1 \
    confluent-kafka==2.3.0 \
    pyiceberg[sql-postgres,s3fs]==0.7.1 \
    psycopg2-binary==2.9.9 \
    sqlalchemy==2.0.32

WORKDIR /app
COPY *.py .

CMD ["python3", "consumer.py"]