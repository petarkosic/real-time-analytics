import * as amqp from 'amqplib';
import * as winston from 'winston';
import { processStockData } from './stockDataProcessor';

const logger = winston.createLogger({
	level: 'info',
	format: winston.format.combine(winston.format.json()),
	transports: [new winston.transports.Console()],
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
			if (msg) {
				try {
					const content = JSON.parse(msg.content.toString());
					const processedData = processStockData(content);

					if (processedData) {
						logger.info(
							'Processed stock data',
							JSON.stringify(processedData, null, 2)
						);

						// TODO: Add storage or further processing logic
					}

					channel.ack(msg);
				} catch (error) {
					logger.error('Error processing message', error);
					channel.nack(msg, false, false);
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
