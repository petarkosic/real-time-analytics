import { useEffect, useRef, useState } from 'react';
import './App.css';
import { io } from 'socket.io-client';
import 'chart.js/auto';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

type StockData = {
	symbol: string;
	bucket: string;
	price: number;
	avgPrice: number;
	maxPrice: number;
	minPrice: number;
};

function App() {
	const [stockData, setStockData] = useState<Record<string, StockData[]>>({});

	const [symbol, setSymbol] = useState('AAPL');

	const [selectedTimeframe, setSelectedTimeframe] = useState('1m');

	const socket = useRef(
		io('http://localhost:5000', {
			autoConnect: false,
			reconnection: true,
		})
	);

	const borderColors: Record<string, string> = {
		AAPL: 'rgba(255, 99, 132, 1)',
		AMZN: 'rgba(75, 192, 192, 1)',
		GOOGL: 'rgba(54, 162, 235, 1)',
		MSFT: 'rgba(255, 206, 86, 1)',
		TSLA: 'rgba(153, 102, 255, 1)',
	};

	const periodicFetchRef = useRef<NodeJS.Timeout | null>(null);

	const startPeriodicFetching = () => {
		if (periodicFetchRef.current) {
			clearInterval(periodicFetchRef.current);
		}

		periodicFetchRef.current = setInterval(() => {
			if (socket.current.connected) {
				socket.current.emit('stock', {
					interval: selectedTimeframe,
					symbol,
				});
			}
		}, 200);
	};

	const stopPeriodicFetching = () => {
		if (periodicFetchRef.current) {
			clearInterval(periodicFetchRef.current);

			periodicFetchRef.current = null;
		}
	};

	useEffect(() => {
		const newSocketRef = socket.current;

		if (!newSocketRef.connected) {
			newSocketRef.connect();
		}

		newSocketRef.emit('stock', { interval: selectedTimeframe, symbol });

		newSocketRef.on('stock_data', (data) => {
			setStockData((prev) => {
				const newState = { ...prev };

				Object.entries(data).forEach(([symbol, newItems]) => {
					newState[symbol] = newItems as StockData[];
				});

				return newState;
			});
		});

		startPeriodicFetching();

		return () => {
			stopPeriodicFetching();

			if (process.env.NODE_ENV === 'production') {
				newSocketRef.off('stock_data');
				newSocketRef.disconnect();
			}
		};
	}, [selectedTimeframe, symbol]);

	const handleTimeframeChange = (
		event: React.ChangeEvent<HTMLSelectElement>
	) => {
		setSelectedTimeframe(event.target.value);

		stopPeriodicFetching();

		socket.current.emit('stock', {
			interval: event.target.value,
			symbol,
		});

		startPeriodicFetching();
	};

	return (
		<div
			style={{
				width: '100%',
				height: '100vh',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
			}}
		>
			<select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
				{Object.keys(borderColors).map((sym) => (
					<option key={sym} value={sym}>
						{sym}
					</option>
				))}
			</select>
			<select value={selectedTimeframe} onChange={handleTimeframeChange}>
				<option value='1m'>1 Minute</option>
				<option value='5m'>5 Minutes</option>
				<option value='30m'>30 Minutes</option>
				<option value='1h'>1 Hour</option>
			</select>
			<div style={{ width: '80%', height: '80%' }}>
				<Line
					data={{
						labels: stockData?.[symbol]?.map((data) => data.bucket),
						datasets: [
							{
								label: symbol,
								data: stockData?.[symbol]?.map((item) => item.price),
								borderColor: borderColors[symbol],
								fill: false,
							},
						],
					}}
					options={{
						scales: {
							x: {
								type: 'time',
								time: {
									unit: getChartTimeUnit(selectedTimeframe),
									displayFormats: getChartDisplayFormats(selectedTimeframe),
								},
							},
						},
						animation: false,
						elements: {
							point: {
								radius: 0,
							},
						},
						responsive: true,
						maintainAspectRatio: false,
					}}
					updateMode='none'
				/>
			</div>
		</div>
	);
}

export default App;

function getChartTimeUnit(interval: string) {
	switch (interval) {
		case '1m':
		case '5m':
		case '30m':
			return 'minute';
		case '1h':
			return 'hour';
		default:
			return 'minute';
	}
}

function getChartDisplayFormats(interval: string) {
	switch (interval) {
		case '1m':
			return { minute: 'HH:mm' };
		case '5m':
			return { minute: 'HH:mm' };
		case '30m':
			return { minute: 'HH:mm' };
		case '1h':
			return { hour: 'HH:mm' };
		default:
			return { minute: 'HH:mm' };
	}
}
