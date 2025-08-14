FROM python:3.11-slim

WORKDIR /app

# Install Java 17 (required for Spark) and other dependencies
# RUN apt-get update && apt-get install -y \
#     openjdk-17-jre-headless \
#     && rm -rf /var/lib/apt/lists/*



# Install Python dependencies for Spark + Kafka
RUN pip install --no-cache-dir \
    confluent-kafka==2.3.0 \
    websocket-client==1.6.4 \
    pyspark==3.5.0

# Set Java environment variables
# ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
ENV PATH=$PATH:$JAVA_HOME/bin
ENV PYSPARK_PYTHON=python3
ENV PYSPARK_DRIVER_PYTHON=python3

# Copy Python files
COPY producer.py .

CMD ["python3", "producer.py"]