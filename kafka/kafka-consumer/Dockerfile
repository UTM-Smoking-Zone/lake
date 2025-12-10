FROM python:3.9-slim

# Установить системные зависимости для PostgreSQL
RUN apt-get update && \
    apt-get install -y libpq-dev gcc && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копировать requirements.txt и установить зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir \
    numpy==1.24.4 \
    pyiceberg[sql-postgres,s3fs]==0.7.1 \
    psycopg2-binary==2.9.9 \
    sqlalchemy==2.0.32 && \
    pip install --no-cache-dir -r requirements.txt

# Копировать исходные файлы
COPY *.py ./

CMD ["python3", "consumer.py"]