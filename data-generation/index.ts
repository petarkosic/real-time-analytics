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
// Define base prices and volume ranges for each symbol
const basePrices: Record<string, number> = {
	AAPL: 150,
	GOOGL: 2500,
	MSFT: 300,
	AMZN: 1200,
	TSLA: 700,
};

const baseVolumes: Record<string, { min: number; max: number }> = {
	AAPL: { min: 10000, max: 50000 },
	GOOGL: { min: 1000, max: 5000 },
	MSFT: { min: 15000, max: 60000 },
	AMZN: { min: 8000, max: 40000 },
	TSLA: { min: 5000, max: 25000 },
};

function generateSyntheticData(): {
	symbol: string;
	price: number;
	volume: number;
	timestamp: string;
} {
	const symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'];
	const symbol = symbols[Math.floor(Math.random() * symbols.length)];

	// Generate price with ±10% fluctuation around the base price
	const basePrice = basePrices[symbol];
	const fluctuation = basePrice * 0.1;
	const price = basePrice + (Math.random() * 2 - 1) * fluctuation;

	// Generate volume within the specified range for the symbol
	const volumeRange = baseVolumes[symbol];
	const volume = Math.floor(
		Math.random() * (volumeRange.max - volumeRange.min + 1) + volumeRange.min
	);

	const timestamp = new Date().toISOString();

	return {
		symbol,
		price,
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
