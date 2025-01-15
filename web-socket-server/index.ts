import express from 'express';
import http from 'http';
import cors from 'cors';
import { Pool } from 'pg';
import { Server } from 'socket.io';

const app = express();

app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: '*',
	},
});

const pool = new Pool({
	user: process.env.POSTGRES_USER,
	host: process.env.POSTGRES_HOST,
	database: process.env.POSTGRES_DB,
	password: process.env.POSTGRES_PASSWORD,
	port: Number(process.env.POSTGRES_PORT),
});

io.on('connection', (socket) => {
	console.log('A user connected');

	socket.on('subscribe', async (symbols) => {
		const client = await pool.connect();

		for (const symbol of symbols) {
			const query = `
            SELECT symbol, price, volume, timestamp
            FROM raw_stock_data
            WHERE symbol = $1
            ORDER BY timestamp DESC
            LIMIT 100
            `;

			const data = await client.query(query, [symbol]);

			socket.emit('stock', data.rows);
		}
	});

	socket.on('disconnect', () => {
		console.log('A user disconnected');
	});
});

server.listen(5000, () => {
	console.log('Server is running on port 5000');
});
