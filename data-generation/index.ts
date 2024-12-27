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

while (true) {
	const data = generateSyntheticData();

	const message = JSON.stringify(data);

	console.log(`Sent data: ${message}`);
}
