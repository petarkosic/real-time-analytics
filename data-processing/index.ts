import * as amqp from 'amqplib';
import * as winston from 'winston';
import { processStockData } from './stockDataProcessor';
import { Pool } from 'pg';

const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(winston.format.json()),
	transports: [new winston.transports.Console()],
});

const pool = new Pool({
	user: process.env.POSTGRES_USER,
	host: process.env.POSTGRES_HOST,
	database: process.env.POSTGRES_DB,
	password: process.env.POSTGRES_PASSWORD,
	port: Number(process.env.POSTGRES_PORT),
});

const rabbitMQConnOptions = {
	protocol: process.env.RABBITMQ_PROTOCOL,
	hostname: process.env.RABBITMQ_HOSTNAME,
	port: Number(process.env.RABBITMQ_PORT),
	username: process.env.RABBITMQ_USER,
	password: process.env.RABBITMQ_PASS,
};

const QUEUE_NAME = 'stock_price_queue';

async function connectAndConsume() {
	try {
		const connection = await amqp.connect(rabbitMQConnOptions);
		const channel = await connection.createChannel();

		await channel.assertQueue(QUEUE_NAME, { durable: true });

		channel.consume(QUEUE_NAME, async (msg) => {
			const client = await pool.connect();

			if (msg) {
				try {
					const content = JSON.parse(msg.content.toString());
					const processedData = processStockData(content);

					if (processedData) {
						await client.query('BEGIN');

						await client.query(
							`INSERT INTO raw_stock_data (symbol, price, volume, timestamp) VALUES ($1, $2, $3, $4)`,
							[content.symbol, content.price, content.volume, content.timestamp]
						);

						await client.query(
							'INSERT INTO processed_analytics (symbol, avg_price, median_price, price_std_dev, price_volatility, volume_trend, timespan, momentum_indicator, volume_weighted_average_price, processing_timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
							[
								processedData.symbol,
								processedData.analytics.avgPrice,
								processedData.analytics.medianPrice,
								processedData.analytics.priceStandardDeviation,
								processedData.analytics.priceVolatility,
								processedData.analytics.volumeTrend,
								processedData.analytics.timespan,
								processedData.analytics.momentumIndicator,
								processedData.analytics.volumeWeightedAveragePrice,
								processedData.analytics.timespan.end,
							]
						);

						await client.query('COMMIT');

						channel.ack(msg);
					}
				} catch (error) {
					logger.error('Error processing message', error);
					await client.query('ROLLBACK');
					channel.nack(msg, false, false);
				} finally {
					client.release();
				}
			}
		});

		logger.info('Data processing service started');
	} catch (error) {
		logger.error('Failed to connect to RabbitMQ', error);
		setTimeout(connectAndConsume, 5000);
	}
}

connectAndConsume();
