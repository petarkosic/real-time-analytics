import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { Pool } from 'pg';

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

	socket.on('stock', async (data) => {
		const { interval, symbol } = data;

		const bucketSize = getBucketSize(interval);
		if (!bucketSize) {
			console.error('Invalid interval');
			return;
		}

		const client = await pool.connect();

		try {
			client.query('BEGIN');

			const query = `
	        SELECT symbol, time_bucket_gapfill($1, timestamp) AS bucket,
	               locf(AVG(price)) AS avg_price,
	               locf(MAX(price)) AS max_price,
	               locf(MIN(price)) AS min_price
	        FROM raw_stock_data
	        WHERE symbol = $2 AND
			timestamp >= NOW() - INTERVAL '${getMaxInterval(interval)}' AND
			timestamp < NOW()
	        GROUP BY bucket, symbol
	        ORDER BY bucket;
	      `;

			const result = await client.query(query, [bucketSize, symbol]);

			const aggregatedData = result.rows.map((row) => ({
				symbol,
				bucket: row.bucket,
				price: row.avg_price,
				avgPrice: row.avg_price,
				maxPrice: row.max_price,
				minPrice: row.min_price,
			}));

			socket.emit('stock_data', { [symbol]: aggregatedData });

			client.query('COMMIT');
		} catch (error) {
			client.query('ROLLBACK');
			console.error('Error executing query', error);
		} finally {
			client.release();
		}
	});

	socket.on('disconnect', () => {
		console.log('A user disconnected');
	});
});

function getBucketSize(interval: string): string | null {
	switch (interval) {
		case '1m':
			return '1 minute';
		case '5m':
			return '5 minutes';
		case '30m':
			return '30 minutes';
		case '1h':
			return '1 hour';
		default:
			return null;
	}
}

function getMaxInterval(interval: string): string {
	switch (interval) {
		case '1m':
			return '2 hours';
		case '5m':
			return '6 hours';
		case '30m':
			return '24 hours';
		case '1h':
			return '48 hours';
		default:
			return '24 hours';
	}
}

server.listen(5000, () => {
	console.log('Server is running on port 5000');
});
