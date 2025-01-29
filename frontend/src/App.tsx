import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { io } from 'socket.io-client';
import 'chart.js/auto';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';
import crosshairPlugin from 'chartjs-plugin-crosshair';
import { BubbleDataPoint, Chart, Point } from 'chart.js/auto';

Chart.register(zoomPlugin, crosshairPlugin);

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

	const chartRef = useRef<Chart<
		'line',
		(number | [number, number] | Point | BubbleDataPoint | null)[],
		unknown
	> | null>(null);

	const handleResetZoom = () => {
		if (chartRef.current) {
			chartRef.current.resetZoom();
		}
	};

	const options: Record<string, unknown> = useMemo(() => {
		return {
			scales: {
				x: {
					type: 'time',
					time: {
						unit: getChartTimeUnit(selectedTimeframe),
						displayFormats: getChartDisplayFormats(selectedTimeframe),
					},
				},
			},
			plugins: {
				legend: {
					display: true,
					position: 'top',
					labels: {
						color: 'rgba(255, 255, 255, 1)',
					},
				},
				tooltip: {
					enabled: true,
					mode: 'index',
					intersect: false,
					callbacks: {
						label: (context: {
							dataset: { data: { [x: string]: string | number } };
							dataIndex: string | number;
						}) => {
							const data = context.dataset.data[context.dataIndex];
							return `Price: ${data}`;
						},
					},
				},
				crosshair: {
					line: {
						color: '#F66',
						width: 1,
						dashPattern: [5, 5],
					},
					sync: {
						enabled: false, // Set true for multiple charts
					},
					zoom: {
						enabled: false, // Disable zoom
					},
				},
				zoom: {
					zoom: {
						wheel: {
							enabled: true,
							speed: 0.05,
						},
						pinch: {
							enabled: true,
						},
						drag: {
							enabled: true,
						},
						pan: {
							enabled: true,
							mode: 'xy',
						},
						mode: 'xy',
					},
				},
			},
			animation: false,
			elements: {
				point: {
					radius: 4,
				},
			},
			responsive: true,
			maintainAspectRatio: false,
		};
	}, []);

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
			<button onClick={handleResetZoom}>Reset Zoom</button>
			<div style={{ width: '80%', height: '80%' }}>
				<Line
					ref={chartRef}
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
					options={options}
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
