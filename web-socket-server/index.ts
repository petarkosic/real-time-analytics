import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import amqp from 'amqplib';

const app = express();

app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: '*',
	},
});

const rabbitMQConnOptions = {
	protocol: process.env.RABBITMQ_PROTOCOL,
	hostname: process.env.RABBITMQ_HOSTNAME,
	port: Number(process.env.RABBITMQ_PORT),
	username: process.env.RABBITMQ_USER,
	password: process.env.RABBITMQ_PASS,
};

async function setupRabbitMQConsumer() {
	try {
		const connection = await amqp.connect(rabbitMQConnOptions);
		const channel = await connection.createChannel();
		await channel.assertQueue('stock_price_queue', { durable: true });

		io.on('connection', (socket) => {
			console.log('A user connected');

			socket.on('subscribe', async (symbols) => {
				channel.consume('stock_price_queue', async (msg) => {
					if (msg) {
						const stockData = JSON.parse(msg.content.toString());

						if (symbols.includes(stockData.symbol)) {
							socket.emit('stock', [stockData]);
						}

						channel.ack(msg);
					}
				});
			});

			socket.on('disconnect', () => {
				console.log('A user disconnected');
			});
		});
	} catch (error) {
		console.error('Error connecting to RabbitMQ', error);
	}
}

server.listen(5000, async () => {
	console.log('Server is running on port 5000');
	await setupRabbitMQConsumer();
});
