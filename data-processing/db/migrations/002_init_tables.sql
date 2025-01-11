CREATE DATABASE stock_data;

\c stock_data;

CREATE EXTENSION IF NOT EXISTS timescaledb;

BEGIN;
CREATE TABLE IF NOT EXISTS raw_stock_data (
    id BIGSERIAL NOT NULL,
    symbol TEXT NOT NULL,
    price FLOAT NOT NULL,
    volume INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (id, symbol, timestamp)
);

-- Create hypertable partitioned by timestamp
SELECT create_hypertable('raw_stock_data', 'timestamp', if_not_exists => TRUE);

-- Add index on symbol for efficient querying
CREATE INDEX idx_raw_stock_data_symbol ON raw_stock_data (symbol);
CREATE INDEX idx_raw_stock_data_timestamp ON raw_stock_data (timestamp);

CREATE TABLE IF NOT EXISTS processed_analytics (
    id BIGSERIAL NOT NULL,
    symbol TEXT NOT NULL,
    avg_price FLOAT,
    median_price FLOAT,
    price_std_dev FLOAT,
    price_volatility FLOAT,
    volume_trend FLOAT,
    timespan JSONB,
    momentum_indicator FLOAT,
    volume_weighted_average_price FLOAT,
    ticks JSONB,
    processing_timestamp TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (id, symbol, processing_timestamp)
);

-- Create hypertable partitioned by processing_timestamp
SELECT create_hypertable('processed_analytics', 'processing_timestamp', if_not_exists => TRUE);

-- Add indexes for efficient querying
CREATE INDEX idx_processed_analytics_symbol ON processed_analytics (symbol);
CREATE INDEX idx_processed_analytics_processing_timestamp ON processed_analytics (processing_timestamp);
COMMIT;