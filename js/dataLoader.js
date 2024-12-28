class DataLoader {
    constructor() {
        this.basePathForecasts = 'data/forecasts';
        this.basePathTruth = 'data/truth';
        this.latestForecastDate = null;
    }

    parseGroundTruth(csvText) {
        console.log('Parsing ground truth CSV');
        try {
            const lines = csvText.split('\n').filter(line => line.trim());
            console.log('Ground truth lines:', lines.length);
            
            const headers = lines[0].split(',');
            const dateIndex = headers.indexOf('date');
            const locationIndex = headers.indexOf('location_name');
            const hospIndex = headers.indexOf('total_hosp');
            
            console.log('Found indices:', {dateIndex, locationIndex, hospIndex});

            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                data.push({
                    date: values[dateIndex],
                    location_name: values[locationIndex],
                    value: values[hospIndex] === 'NA' ? null : parseFloat(values[hospIndex])
                });
            }
            
            console.log(`Parsed ${data.length} ground truth records`);
            if (data.length > 0) console.log('Sample ground truth:', data[0]);
            return data;
        } catch (error) {
            console.error('Error parsing ground truth:', error);
            return [];
        }
    }

    parseArimaFormat(csvText) {
        console.log('Parsing ARIMA format');
        try {
            const lines = csvText.split('\n').filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim());
            
            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length !== headers.length) continue;

                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });

                try {
                    const record = {
                        location_name: row.location_name === 'National' ? 'US' : row.location_name,
                        horizon: parseInt(row.horizon),
                        value: parseFloat(row.value),
                        date: row.date
                    };

                    // Only include horizons 1-4
                    if (!isNaN(record.value) && 
                        !isNaN(record.horizon) && 
                        record.horizon >= 1 && 
                        record.horizon <= 4 && 
                        record.date && 
                        record.date.includes('-')) {
                        data.push(record);
                    }
                } catch (e) {
                    console.warn('Error parsing row:', values, e);
                }
            }
            
            // Debug output to verify horizons
            const horizonCounts = data.reduce((acc, curr) => {
                acc[curr.horizon] = (acc[curr.horizon] || 0) + 1;
                return acc;
            }, {});
            console.log(`Parsed ${data.length} ARIMA records. Horizons:`, horizonCounts);
            
            return data;
        } catch (error) {
            console.error('Error parsing ARIMA format:', error);
            return [];
        }
    }

    parseLGBFormat(csvText) {
        console.log('Parsing LGB format');
        try {
            const lines = csvText.split('\n').filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.trim());
            
            console.log('LGB headers:', headers);

            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length !== headers.length) continue;

                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });

                try {
                    const record = {
                        location_name: row.location_name === 'National' ? 'US' : row.location_name,
                        horizon: parseInt(row.horizon),
                        value: parseFloat(row.value),
                        date: row.date
                    };

                    // Only include horizons 1-4
                    if (!isNaN(record.value) && 
                        !isNaN(record.horizon) && 
                        record.horizon >= 1 && 
                        record.horizon <= 4 && 
                        record.date && 
                        record.date.includes('-')) {
                        data.push(record);
                    }
                } catch (e) {
                    console.warn('Error parsing row:', values, e);
                }
            }
            
            // Debug output to verify horizons
            const horizonCounts = data.reduce((acc, curr) => {
                acc[curr.horizon] = (acc[curr.horizon] || 0) + 1;
                return acc;
            }, {});
            console.log(`Parsed ${data.length} LGB records. Horizons:`, horizonCounts);
            
            return data;
        } catch (error) {
            console.error('Error parsing LGB format:', error);
            return [];
        }
    }

    parseShihaoFormat(csvText) {
        console.log('Parsing Shihao team format');
        try {
            const lines = csvText.split('\n').filter(line => line.trim());
            const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
            
            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.replace(/"/g, ''));
                const horizon = parseInt(values[2]) + 1; // adding 1 to horizon
                
                // Only include horizons 1-4
                if (horizon >= 1 && horizon <= 4) {
                    data.push({
                        date: values[4], // using target_end_date
                        location_name: values[1],
                        horizon: horizon,
                        value: parseFloat(values[7])
                    });
                }
            }
            
            // Debug output to verify horizons
            const horizonCounts = data.reduce((acc, curr) => {
                acc[curr.horizon] = (acc[curr.horizon] || 0) + 1;
                return acc;
            }, {});
            console.log(`Parsed ${data.length} Shihao team records. Horizons:`, horizonCounts);
            
            if (data.length > 0) console.log('Sample Shihao:', data[0]);
            return data;
        } catch (error) {
            console.error('Error parsing Shihao format:', error);
            return [];
        }
    }

    async loadLGBIndividual(baseDir, modelPrefix, submissionDate) {
        const allForecasts = [];
        
        // For each horizon (1-4)
        for (let h = 1; h <= 4; h++) {
            // For each replicate (1-3)
            for (let r = 1; r <= 3; r++) {
                const filename = `${modelPrefix}_h${h}_${r}_${submissionDate}.csv`;
                const fullPath = `${this.basePathForecasts}/${baseDir}/${filename}`;
                
                try {
                    const response = await fetch(fullPath);
                    if (!response.ok) {
                        console.warn(`Failed to load ${filename} (${response.status})`);
                        continue;
                    }

                    const text = await response.text();
                    const forecasts = this.parseLGBFormat(text);
                    console.log(`Loaded ${forecasts.length} forecasts from ${filename}`);
                    allForecasts.push(...forecasts);
                } catch (error) {
                    console.warn(`Error loading ${filename}:`, error);
                }
            }
        }

        console.log('Before grouping:', {
            totalForecasts: allForecasts.length,
            sampleHorizons: [...new Set(allForecasts.map(f => f.horizon))].sort()
        });

        // Group by location, date (from data), and horizon
        const grouped = allForecasts.reduce((acc, curr) => {
            const key = `${curr.location_name}|${curr.date}|${curr.horizon}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(curr.value);
            return acc;
        }, {});

        // Calculate averages
        const averagedForecasts = [];
        for (const [key, values] of Object.entries(grouped)) {
            const [location_name, date, horizon] = key.split('|');
            averagedForecasts.push({
                location_name,
                date,
                horizon: parseInt(horizon),
                value: values.reduce((a, b) => a + b, 0) / values.length
            });
        }

        console.log('After averaging:', {
            totalForecasts: averagedForecasts.length,
            sampleHorizons: [...new Set(averagedForecasts.map(f => f.horizon))].sort()
        });

        return averagedForecasts;
    }

    async loadLGBConsolidated(baseDir, modelPrefix, submissionDate) {
        const allForecasts = [];
        
        // For each replicate (1-5)
        for (let r = 1; r <= 5; r++) {
            const filename = `${modelPrefix}_${r}_${submissionDate}.csv`;
            const fullPath = `${this.basePathForecasts}/${baseDir}/${filename}`;
            
            try {
                const response = await fetch(fullPath);
                if (!response.ok) {
                    console.warn(`Failed to load ${filename} (${response.status})`);
                    continue;
                }

                const text = await response.text();
                const forecasts = this.parseLGBFormat(text);
                console.log(`Loaded ${forecasts.length} forecasts from ${filename}`);
                allForecasts.push(...forecasts);
            } catch (error) {
                console.warn(`Error loading ${filename}:`, error);
            }
        }

        console.log('Before grouping:', {
            totalForecasts: allForecasts.length,
            sampleHorizons: [...new Set(allForecasts.map(f => f.horizon))].sort()
        });

        // Group by location, date, and horizon
        const grouped = allForecasts.reduce((acc, curr) => {
            const key = `${curr.location_name}|${curr.date}|${curr.horizon}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(curr.value);
            return acc;
        }, {});

        // Calculate averages
        const averagedForecasts = [];
        for (const [key, values] of Object.entries(grouped)) {
            const [location_name, date, horizon] = key.split('|');
            averagedForecasts.push({
                location_name,
                date,
                horizon: parseInt(horizon),
                value: values.reduce((a, b) => a + b, 0) / values.length
            });
        }

        console.log('After averaging:', {
            totalForecasts: averagedForecasts.length,
            sampleHorizons: [...new Set(averagedForecasts.map(f => f.horizon))].sort()
        });

        return averagedForecasts;
    }

    async loadGroundTruth(includeRetrospective = false) {
        try {
            const filename = 'imputed_and_stitched_hosp_2024-12-21.csv';
            const fullPath = `${this.basePathTruth}/${filename}`;
            console.log('Loading ground truth from:', fullPath);

            const response = await fetch(fullPath);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const text = await response.text();
            let data = this.parseGroundTruth(text);
            
            // Find the last date after 11/15/2023
            const dates = data
                .map(d => d.date)
                .filter(d => new Date(d) >= new Date('2023-11-15'))
                .sort()
                .reverse();
            
            if (dates.length === 0) {
                throw new Error('No dates found after 2023-11-15');
            }

            // Set the latest forecast date (last date + 7 days)
            const lastDate = new Date(dates[0]);
            const forecastDate = new Date(lastDate);
            forecastDate.setDate(forecastDate.getDate() + 7);
            this.latestForecastDate = forecastDate.toISOString().split('T')[0];
            
            console.log('Last truth date:', lastDate.toISOString().split('T')[0]);
            console.log('Latest forecast date:', this.latestForecastDate);
            
            // Filter based on date range
            const startDate = includeRetrospective ? '2023-07-01' : '2024-07-01';
            data = data.filter(d => {
                const recordDate = new Date(d.date);
                return recordDate >= new Date(startDate);
            });

            console.log(`Filtered ground truth to ${data.length} records starting from ${startDate}`);
            return data;
        } catch (error) {
            console.error('Error loading ground truth:', error);
            throw error;
        }
    }
    
    async loadForecasts(selectedDate) {
		const getModelDate = (selectedDate, isShihaoTeam) => {
			const date = new Date(selectedDate);
			if (isShihaoTeam) {
				// For Shihao team files, use the selected date as is
				return date.toISOString().split('T')[0];
			} else {
				// For LGB and ARIMA files, subtract 7 days from the selected date
				date.setDate(date.getDate() - 7);
				return date.toISOString().split('T')[0];
			}
		};
	
		const models = {
			'arima/arima': {
				format: 'arima',
				name: 'ARIMA',
				isShihaoTeam: false,
				prefix: 'arima'
			},
			'ensemble/Nsemble': { 
				format: 'lgb', 
				name: 'MIGHTE-Nsemble',
				isShihaoTeam: true,
				prefix: 'Nsemble'
			},
			'ensemble/Joint': { 
				format: 'lgb', 
				name: 'MIGHTE-Joint',
				isShihaoTeam: true,
				prefix: 'Joint'
			},
			'lgb_mod2023_consolidated': { 
				format: 'lgb_consolidated', 
				name: 'LGB-2023-C',
				isShihaoTeam: false,
				prefix: 'lgb_mod2023'
			},
			'lgb_mod2023_individual': { 
				format: 'lgb_individual', 
				name: 'LGB-2023-I',
				isShihaoTeam: false,
				prefix: 'lgb_mod2023'
			},
			'lgb_mod2024_consolidated': { 
				format: 'lgb_consolidated', 
				name: 'LGB-2024-C',
				isShihaoTeam: false,
				prefix: 'lgb_mod2024'
			},
			'lgb_mod2024_individual': { 
				format: 'lgb_individual', 
				name: 'LGB-2024-I',
				isShihaoTeam: false,
				prefix: 'lgb_mod2024'
			},
			'shihao_team/argo_raw': { 
				format: 'shihao', 
				name: 'ARGO',
				isShihaoTeam: true,
				prefix: 'argo_raw'
			},
			'shihao_team/argo2_raw': { 
				format: 'shihao', 
				name: 'ARGO2',
				isShihaoTeam: true,
				prefix: 'argo2_raw'
			}
		};
	
		let allForecasts = [];
		for (const [path, config] of Object.entries(models)) {
			try {
				const fileDate = getModelDate(selectedDate, config.isShihaoTeam);
				console.log(`Loading ${config.name} for selected date ${selectedDate}, using file date ${fileDate}`);
				
				let forecasts;
				if (config.format === 'lgb_individual') {
					forecasts = await this.loadLGBIndividual(path, config.prefix, fileDate);
				} else if (config.format === 'lgb_consolidated') {
					forecasts = await this.loadLGBConsolidated(path, config.prefix, fileDate);
				} else {
					const fullPath = `${this.basePathForecasts}/${path}_${fileDate}.csv`;
					console.log(`Loading ${config.name} from:`, fullPath);
	
					const response = await fetch(fullPath);
					if (!response.ok) {
						console.warn(`Failed to load ${config.name} (${response.status})`);
						continue;
					}
	
					const text = await response.text();
					
					switch (config.format) {
						case 'arima':
							forecasts = this.parseArimaFormat(text);
							break;
						case 'lgb':
							forecasts = this.parseLGBFormat(text);
							break;
						case 'shihao':
							forecasts = this.parseShihaoFormat(text);
							break;
					}
				}
				
				if (forecasts && forecasts.length > 0) {
					forecasts.forEach(d => d.model = config.name);
					allForecasts = allForecasts.concat(forecasts);
					console.log(`Successfully loaded ${config.name} (${forecasts.length} records)`);
				}
			} catch (error) {
				console.warn(`Error loading ${config.name}:`, error);
			}
		}
		
		console.log('Total forecasts loaded:', allForecasts.length);
		return allForecasts;
	}
}