-- Create schemas for different purposes
CREATE SCHEMA IF NOT EXISTS iceberg_catalog;
CREATE SCHEMA IF NOT EXISTS airflow;
CREATE SCHEMA IF NOT EXISTS trading;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA iceberg_catalog TO admin;
GRANT ALL PRIVILEGES ON SCHEMA airflow TO admin;
GRANT ALL PRIVILEGES ON SCHEMA trading TO admin;

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log successful initialization
SELECT 'Database initialized successfully' AS status;