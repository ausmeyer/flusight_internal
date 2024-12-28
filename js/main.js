class ForecastController {
    constructor() {
        this.chart = new ForecastChart(document.getElementById('us-chart'));
        this.dataLoader = new DataLoader();
        this.currentTruth = null;
        this.currentForecasts = null;
        this.selectedDate = null;
        this.selectedModels = new Set();
    }

    async initialize() {
        try {
            console.log('Starting data load...');
            
            // Initial load with default settings
            this.currentTruth = await this.dataLoader.loadGroundTruth(false);
            
            // Use the latest forecast date determined from ground truth
            if (!this.dataLoader.latestForecastDate) {
                throw new Error('Failed to determine latest forecast date from truth data');
            }
            
            console.log('Loading forecasts for date:', this.dataLoader.latestForecastDate);
            this.currentForecasts = await this.dataLoader.loadForecasts(this.dataLoader.latestForecastDate);

            // Set up controls
            this.setupControls();
            
            // Initial update
            this.updateVisualization();

        } catch (error) {
            console.error('Error in initialization:', error);
            document.getElementById('us-chart').innerHTML = 
                `<div style="color: red; padding: 20px;">
                    Error loading data: ${error.message}<br>
                    Please check the console for details.
                </div>`;
        }
    }

    setupControls() {
        // Set up date selector
        const dateSelector = document.getElementById('dateSelector');
        
        // Define the known dates we expect
        const knownDates = [
            '2024-12-28',  // Most recent date
            '2024-12-21',  // Previous week
            '2024-12-14',  // Two weeks ago
            '2024-12-07',  // Three weeks ago
            '2024-11-30'   // Four weeks ago
        ];
    
        // Sort dates in reverse chronological order
        const uniqueDates = [...new Set(knownDates)]
            .sort((a, b) => new Date(b) - new Date(a));
        
        console.log('Available forecast dates:', uniqueDates);
        
        // Populate date selector
        dateSelector.innerHTML = uniqueDates.map(date => {
            const [year, month, day] = date.split('-');
            const formattedDate = new Date(Date.UTC(year, month - 1, day))
                .toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC'
                });
            return `<option value="${date}">${formattedDate}</option>`;
        }).join('');
    
        this.selectedDate = uniqueDates[0];  // Most recent date    
            
        // Set up model checkboxes
        const modelCheckboxes = document.getElementById('modelCheckboxes');
        const uniqueModels = [...new Set(this.currentForecasts.map(d => d.model))].sort();
        
        modelCheckboxes.innerHTML = uniqueModels.map(model => 
            `<div class="model-checkbox">
                <input type="checkbox" id="${model}" value="${model}" checked>
                <label for="${model}">${model}</label>
            </div>`
        ).join('');

        this.selectedModels = new Set(uniqueModels);

        // Add event listeners
        dateSelector.addEventListener('change', async (e) => {
            this.selectedDate = e.target.value;
            console.log('Loading forecasts for date:', this.selectedDate);
            
            try {
                // Load new forecasts for the selected date
                this.currentForecasts = await this.dataLoader.loadForecasts(this.selectedDate);
                this.updateVisualization();
            } catch (error) {
                console.error('Error loading forecasts:', error);
            }
        });

        modelCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedModels.add(e.target.value);
                } else {
                    this.selectedModels.delete(e.target.value);
                }
                console.log('Selected models:', [...this.selectedModels]);
                this.updateVisualization();
            });
        });

        // Set up retrospective checkbox
        document.getElementById('retrospective').addEventListener('change', async (e) => {
            console.log('Retrospective changed:', e.target.checked);
            this.currentTruth = await this.dataLoader.loadGroundTruth(e.target.checked);
            this.updateVisualization();
        });
    }

    updateVisualization() {
        try {
            // Filter forecasts based on selected models
            const filteredForecasts = this.currentForecasts.filter(f => {
                return this.selectedModels.has(f.model);
            });
    
            console.log('Visualization update:', {
                selectedDate: this.selectedDate,
                selectedModels: [...this.selectedModels],
                totalForecasts: this.currentForecasts.length,
                filteredForecasts: filteredForecasts.length,
                horizonCounts: filteredForecasts.reduce((acc, f) => {
                    if (!acc[f.model]) acc[f.model] = {};
                    if (!acc[f.model][f.horizon]) acc[f.model][f.horizon] = 0;
                    acc[f.model][f.horizon]++;
                    return acc;
                }, {})
            });
    
            // Debug forecast data
            if (filteredForecasts.length > 0) {
                console.log('Sample filtered forecast:', filteredForecasts[0]);
                console.log('Models and horizons:', 
                    [...new Set(filteredForecasts.map(f => f.model))].map(model => ({
                        model,
                        horizons: [...new Set(filteredForecasts
                            .filter(f => f.model === model)
                            .map(f => f.horizon))]
                            .sort((a, b) => a - b)
                    })));
            }
    
            // Update chart
            this.chart.update(this.currentTruth, filteredForecasts);
    
        } catch (error) {
            console.error('Error in visualization update:', error);
        }
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    const controller = new ForecastController();
    controller.initialize();
});