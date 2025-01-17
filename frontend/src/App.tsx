import { useEffect, useState } from 'react';
import './App.css';
import { io } from 'socket.io-client';
import 'chart.js/auto';
import { Line } from 'react-chartjs-2';

type StockData = {
	symbol: string;
	price: number;
	volume: number;
	timestamp: string;
};

function App() {
	const [stockData, setStockData] = useState<Record<string, StockData[]>>({
		AAPL: [],
		GOOGL: [],
		MSFT: [],
		AMZN: [],
		TSLA: [],
	});

	const borderColors: Record<string, string> = {
		AAPL: 'rgba(255, 99, 132, 1)',
		GOOGL: 'rgba(54, 162, 235, 1)',
		MSFT: 'rgba(255, 206, 86, 1)',
		AMZN: 'rgba(75, 192, 192, 1)',
		TSLA: 'rgba(153, 102, 255, 1)',
	};

	const MAX_DATA_POINTS = 100;

	useEffect(() => {
		const socket = io('http://localhost:5000');

		socket.on('connect', () => {
			console.log('Connected to server');
			socket.emit('subscribe', ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA']);
		});

		socket.on('stock', (data) => {
			setStockData((prev) => {
				const newStockData = { ...prev };

				data.forEach((item: StockData) => {
					if (!newStockData[item.symbol]) {
						newStockData[item.symbol] = [];
					}

					newStockData[item.symbol].push(item);

					if (newStockData[item.symbol].length > MAX_DATA_POINTS) {
						newStockData[item.symbol] = newStockData[item.symbol].slice(
							-MAX_DATA_POINTS
						);
					}
				});

				return newStockData;
			});
		});

		return () => {
			socket.disconnect();
		};
	}, []);

	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
			}}
		>
			<Line
				data={{
					labels: stockData.AAPL.map((data) => data.timestamp),
					datasets: Object.entries(stockData).map(([symbol, data]) => ({
						label: symbol,
						data: data.map((item) => item.price),
						borderColor: borderColors[symbol],
						fill: false,
					})),
				}}
			/>
		</div>
	);
}

export default App;
