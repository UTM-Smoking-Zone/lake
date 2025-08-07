FROM python:3.11-slim

RUN apt-get update && apt-get install -y openjdk-17-jre-headless && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install confluent-kafka==2.3.0 websocket-client==1.6.4 pyspark==3.5.0

ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PYSPARK_PYTHON=python3
ENV PYSPARK_DRIVER_PYTHON=python3

COPY producer.py consumer.py ./

CMD ["python3", "producer.py"]