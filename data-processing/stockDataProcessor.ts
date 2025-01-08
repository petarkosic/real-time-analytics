import { mean, standardDeviation } from 'simple-statistics';

interface StockTick {
	symbol: string;
	price: number;
	volume: number;
	timestamp: string;
}

interface ProcessedStockData {
	symbol: string;
	analytics: {
		avgPrice: number;
		priceVolatility: number;
		volumeTrend: number;
		medianPrice: number;
		priceStandardDeviation: number;
		timespan: {
			start: string;
			end: string;
			duration: number;
		};
		momentumIndicator: number;
		volumeWeightedAveragePrice: number;
	};
	ticks: StockTick[];
}

export class StockDataProcessor {
	private symbolBuffers: {
		[symbol: string]: {
			ticks: StockTick[];
			startTime: number;
		};
	} = {};

	private readonly WINDOW_SIZE = 10 * 1000; // 10 seconds window

	processMessage(tick: StockTick): ProcessedStockData | null {
		const now = Date.now();

		if (!this.symbolBuffers[tick.symbol]) {
			this.symbolBuffers[tick.symbol] = {
				ticks: [tick],
				startTime: now,
			};
		}

		this.symbolBuffers[tick.symbol].ticks = this.symbolBuffers[
			tick.symbol
		].ticks.filter(
			(tick) => new Date(tick.timestamp).getTime() >= now - this.WINDOW_SIZE
		);
		this.symbolBuffers[tick.symbol].ticks.push(tick);

		const processedData = this.calculateAnalytics(tick.symbol, now);

		return processedData;
	}

	private calculateAnalytics(
		symbol: string,
		now: number
	): ProcessedStockData | null {
		const buffer = this.symbolBuffers[symbol];

		if (!buffer || buffer.ticks.length === 0) {
			return null;
		}

		const prices = buffer.ticks.map((tick) => tick.price);
		const volumes = buffer.ticks.map((tick) => tick.volume);

		const sortedTicks = [...buffer.ticks].sort(
			(a, b) =>
				new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
		);

		return {
			symbol,
			analytics: {
				avgPrice: this.safeCalculateMean(prices),
				medianPrice: this.calculateMedian(prices),
				priceStandardDeviation: this.safeCalculateStdDev(prices),
				priceVolatility: this.calculateVolatility(prices),
				volumeTrend: this.calculateVolumeTrend(volumes),
				timespan: {
					start: sortedTicks[0].timestamp,
					end: sortedTicks[sortedTicks.length - 1].timestamp,
					duration: now - buffer.startTime,
				},
				momentumIndicator: this.calculateMomentumIndicator(prices),
				volumeWeightedAveragePrice: this.calculateVWAP(buffer.ticks),
			},
			ticks: buffer.ticks,
		};
	}

	private safeCalculateMean(values: number[]): number {
		return values.length > 0 ? mean(values) : 0;
	}

	private safeCalculateStdDev(values: number[]): number {
		return values.length > 1 ? standardDeviation(values) : 0;
	}

	private calculateMedian(values: number[]): number {
		if (values.length === 0) return 0;
		const sorted = [...values].sort((a, b) => a - b);
		const middle = Math.floor(sorted.length / 2);

		return sorted.length % 2 === 0
			? (sorted[middle - 1] + sorted[middle]) / 2
			: sorted[middle];
	}

	private calculateVolatility(prices: number[]): number {
		if (prices.length < 2) return 0;
		const stdDev = this.safeCalculateStdDev(prices);
		const mean = this.safeCalculateMean(prices);
		return mean !== 0 ? (stdDev / mean) * 100 : 0;
	}

	private calculateVolumeTrend(volumes: number[]): number {
		if (volumes.length < 2) return 0;
		const n = volumes.length;
		const sumX = (n * (n + 1)) / 2;
		const sumY = volumes.reduce((a, b) => a + b, 0);
		const sumXY = volumes.reduce((sum, vol, i) => sum + vol * (i + 1), 0);
		const sumXSquare = (n * (n + 1) * (2 * n + 1)) / 6;

		return (n * sumXY - sumX * sumY) / (n * sumXSquare - sumX * sumX);
	}

	private calculateMomentumIndicator(prices: number[]): number {
		if (prices.length < 2) return 0;

		const latestPrice = prices[prices.length - 1];
		const earliestPrice = prices[0];

		return earliestPrice !== 0
			? ((latestPrice - earliestPrice) / earliestPrice) * 100
			: 0;
	}

	private calculateVWAP(ticks: StockTick[]): number {
		if (ticks.length === 0) return 0;
		const totalValue = ticks.reduce(
			(sum, tick) => sum + tick.price * tick.volume,
			0
		);
		const totalVolume = ticks.reduce((sum, tick) => sum + tick.volume, 0);

		return totalVolume !== 0 ? totalValue / totalVolume : 0;
	}
}

const processor = new StockDataProcessor();

export function processStockData(tick: StockTick): ProcessedStockData | null {
	return processor.processMessage(tick);
}
