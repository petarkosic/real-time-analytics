import { config } from 'dotenv';
config();
import amqp from 'amqplib';
import * as winston from 'winston';

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

async function connectRabbitMQ(): Promise<{
	channel: amqp.Channel;
	connection: amqp.Connection;
}> {
	try {
		const connection = await amqp.connect(rabbitMQConnOptions);
		const channel = await connection.createChannel();

		await channel.assertQueue('stock_price_queue', { durable: true });

		return { connection, channel };
	} catch (error) {
		logger.error('Error connecting to RabbitMQ:', error);

		setTimeout(connectRabbitMQ, 5000);

		throw error;
	}
}

function generateSyntheticData(): {
	symbol: string;
	price: number;
	volume: number;
	timestamp: string;
} {
	const symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'];
	const symbol = symbols[Math.floor(Math.random() * symbols.length)];
	const price = Math.round(Math.random() * (200 - 100) + 100);
	const volume = Math.floor(Math.random() * (10000 - 1000) + 1000);
	const timestamp = new Date()
		.toISOString()
		.replace('T', 'T')
		.replace('Z', 'Z');

	return {
		symbol,
		price: price / 100,
		volume,
		timestamp,
	};
}

async function startGenerating() {
	const { channel } = await connectRabbitMQ();

	while (true) {
		try {
			const data = generateSyntheticData();

			const message = JSON.stringify(data);

			await channel.sendToQueue('stock_price_queue', Buffer.from(message), {
				persistent: true,
			});
		} catch (error) {
			logger.error('Error sending message to queue:', error);
		}

		await new Promise((resolve) => setTimeout(resolve, 0));
	}
}

startGenerating().catch((error) => {
	logger.error('Error generating data:', error);
});
