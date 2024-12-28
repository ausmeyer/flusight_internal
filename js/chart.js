class ForecastChart {
    constructor(element) {
        this.element = element;
        this.margin = {top: 40, right: 80, bottom: 40, left: 60};
        this.lastTruth = null;
        this.lastForecasts = null;
        
        // Base facet dimensions
        this.facetWidth = 500;
        this.facetHeight = 300;
        this.facetPadding = 40;
        
        // Initial setup
        this.updateLayout();
        
        // Add window resize listener with debouncing
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.updateLayout();
                if (this.lastTruth && this.lastForecasts) {
                    this.update(this.lastTruth, this.lastForecasts);
                }
            }, 250); // Wait for 250ms after last resize event
        });

        // Set up color scale using Tableau10
        this.colorScale = d3.scaleOrdinal(d3.schemeTableau10);

        // Add tooltip div
        if (!document.getElementById('chart-tooltip')) {
            this.tooltip = d3.select("body").append("div")
                .attr("id", "chart-tooltip")
                .attr("class", "tooltip")
                .style("opacity", 0)
                .style("position", "absolute")
                .style("background-color", "white")
                .style("border", "1px solid #ddd")
                .style("border-radius", "3px")
                .style("padding", "10px")
                .style("pointer-events", "none");
        } else {
            this.tooltip = d3.select("#chart-tooltip");
        }
    }

    updateLayout() {
        // Get current window width
        const totalWidth = this.element.clientWidth;
        
        // Calculate how many facets can fit in a row
        const availableWidth = totalWidth - this.margin.left - this.margin.right;
        this.facetsPerRow = Math.max(1, Math.floor(availableWidth / this.facetWidth));
        
        // Clear any existing SVG
        d3.select(this.element).selectAll("*").remove();
        
        // Create new SVG
        this.svg = d3.select(this.element)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    }

    update(truth, forecasts) {
        // Store the current data for resize events
        this.lastTruth = truth;
        this.lastForecasts = forecasts;

        console.log('Chart update debug:');
        console.log('Initial truth records:', truth.length);
        console.log('Initial forecast records:', forecasts.length);

        try {
            // Clear existing elements
            this.svg.selectAll("*").remove();

            // Get unique locations and sort them specially
            let locations = [...new Set([
                ...truth.map(d => d.location_name),
                ...forecasts.map(d => d.location_name)
            ])].sort((a, b) => {
                if (a === 'US') return -1;
                if (b === 'US') return 1;
                if (a === 'Puerto Rico') return 1;
                if (b === 'Puerto Rico') return -1;
                return a.localeCompare(b);
            });

            // Create shared x scale for date alignment
            const dateExtent = d3.extent([
                ...truth.map(d => new Date(d.date)),
                ...forecasts.map(d => new Date(d.date))
            ]);
            
            // Add padding to x range
            const xMin = new Date(dateExtent[0]);
            xMin.setDate(xMin.getDate() - 14);
            const xMax = new Date(dateExtent[1]);
            xMax.setDate(xMax.getDate() + 14);

            console.log('Date range:', {
                min: xMin.toISOString(),
                max: xMax.toISOString()
            });

            // Create facets
            locations.forEach((location, i) => {
                const row = Math.floor(i / this.facetsPerRow);
                const col = i % this.facetsPerRow;
                
                const facetX = col * this.facetWidth;
                const facetY = row * (this.facetHeight + this.facetPadding);

                // Create group for this facet
                const facet = this.svg.append('g')
                    .attr('transform', `translate(${facetX},${facetY})`);

                // Filter data for this location
                const locationTruth = truth
                    .filter(d => d.location_name === location)
                    .map(d => ({
                        date: new Date(d.date),
                        value: d.value
                    }))
                    .filter(d => d.value !== null && !isNaN(d.value));

                const locationForecasts = forecasts
                    .filter(d => d.location_name === location)
                    .map(d => ({
                        date: new Date(d.date),
                        value: parseFloat(d.value),
                        model: d.model,
                        horizon: d.horizon
                    }))
                    .filter(d => !isNaN(d.value));

                console.log(`${location} data:`, {
                    truthCount: locationTruth.length,
                    forecastCount: locationForecasts.length,
                    models: [...new Set(locationForecasts.map(d => d.model))]
                });

                // Calculate y extent for this location
                const yExtent = d3.extent([
                    ...locationTruth.map(d => d.value),
                    ...locationForecasts.map(d => d.value)
                ]);
                const yMax = yExtent[1] * 1.1; // Add 10% padding

                // Create scales for this facet
                const x = d3.scaleTime()
                    .domain([xMin, xMax])
                    .range([0, this.facetWidth - this.margin.right]);

                const y = d3.scaleLinear()
                    .domain([0, yMax])
                    .range([this.facetHeight - this.margin.bottom, 0]);

				// Determine tick interval based on date range
				const dateRange = xMax - xMin;
				const monthsDiff = dateRange / (1000 * 60 * 60 * 24 * 30); // Approximate months difference
				
				// Add axes with conditional tick interval
				facet.append('g')
					.attr('class', 'x-axis')
					.attr('transform', `translate(0,${this.facetHeight - this.margin.bottom})`)
					.call(d3.axisBottom(x)
						.ticks(monthsDiff > 6 ? d3.timeMonth.every(2) : d3.timeWeek.every(4))
						.tickFormat(d3.timeFormat('%b %d')));
				
				// Rotate labels if showing retrospective data
				if (monthsDiff > 6) {
					facet.selectAll('.x-axis text')
						.style('text-anchor', 'end')
						.attr('dx', '-.8em')
						.attr('dy', '.15em')
						.attr('transform', 'rotate(-45)');
				}

                facet.append('g')
                    .attr('class', 'y-axis')
                    .call(d3.axisLeft(y)
                        .ticks(5)
                        .tickFormat(d => Math.round(d)));

                // Add title
                facet.append('text')
                    .attr('x', (this.facetWidth - this.margin.right) / 2)
                    .attr('y', -5)
                    .attr('text-anchor', 'middle')
                    .style('font-size', '14px')
                    .style('font-weight', 'bold')
                    .text(location);

                // Create line generator
                const line = d3.line()
                    .x(d => x(d.date))
                    .y(d => y(Math.round(d.value)))
                    .defined(d => !isNaN(d.value));

                // Add hover line
                const hoverLine = facet.append('line')
                    .attr('class', 'hover-line')
                    .attr('y1', 0)
                    .attr('y2', this.facetHeight - this.margin.bottom)
                    .style('stroke', '#999')
                    .style('stroke-width', '1px')
                    .style('opacity', 0);

                // Add invisible overlay for mouse tracking
                const overlay = facet.append('rect')
                    .attr('class', 'overlay')
                    .attr('width', this.facetWidth - this.margin.right)
                    .attr('height', this.facetHeight - this.margin.bottom)
                    .style('fill', 'none')
                    .style('pointer-events', 'all');

                // Add truth line
                if (locationTruth.length > 0) {
                    facet.append('path')
                        .datum(locationTruth)
                        .attr('class', 'truth-line')
                        .attr('fill', 'none')
                        .attr('stroke', '#2c3e50')
                        .attr('stroke-width', 1.5)
                        .attr('d', line);
                }

                // Add forecast points and lines by model
                if (locationForecasts.length > 0) {
                    const modelGroups = d3.group(locationForecasts, d => d.model);
                    modelGroups.forEach((data, model) => {
                        // Sort by horizon to ensure points are connected in order
                        data.sort((a, b) => a.horizon - b.horizon);
                        
                        console.log(`${location} - ${model} forecast data:`, {
                            points: data.length,
                            horizons: data.map(d => d.horizon),
                            dates: data.map(d => d.date),
                            values: data.map(d => d.value)
                        });

                        // Draw line connecting all horizons
                        facet.append('path')
                            .datum(data)
                            .attr('class', 'forecast-line')
                            .attr('fill', 'none')
                            .attr('stroke', this.colorScale(model))
                            .attr('stroke-width', 1)
                            .attr('d', line);

                        // Add points at each horizon
                        facet.selectAll(`.point-${model.replace(/\s+/g, '-')}`)
                            .data(data)
                            .enter()
                            .append('circle')
                            .attr('class', `forecast-point point-${model.replace(/\s+/g, '-')}`)
                            .attr('cx', d => x(d.date))
                            .attr('cy', d => y(Math.round(d.value)))
                            .attr('r', 3)
                            .attr('fill', this.colorScale(model));
                    });
                }

				// Mouse move handler
				overlay.on('mousemove', (event) => {
					const mouseX = d3.pointer(event)[0];
					const date = x.invert(mouseX);
				
					// Update hover line position
					hoverLine
						.attr('x1', mouseX)
						.attr('x2', mouseX)
						.style('opacity', 1);
				
					// Find closest data points
					const truthPoint = this.findClosestPoint(locationTruth, date);
					const forecastPoints = this.findClosestForecastPoints(locationForecasts, date);
				
					// Only proceed if we have points to show
					if ((truthPoint || forecastPoints.length > 0)) {
						// Build tooltip content
						let tooltipContent = `<strong>${location}</strong><br/>`;
						
						// If we have forecast points, use the date from the first forecast point
						if (forecastPoints.length > 0) {
							const displayDate = forecastPoints[0].date.toLocaleDateString('en-US', {
								year: 'numeric',
								month: 'short',
								day: 'numeric'
							});
							tooltipContent += `Date: ${displayDate}<br/>`;
						}
				
						// Add observed value if it exists and is close to the forecast date
						if (truthPoint) {
							const truthDate = new Date(truthPoint.date);
							const forecastDate = forecastPoints.length > 0 ? new Date(forecastPoints[0].date) : null;
							
							// Only show truth point if it's within 3 days of the forecast date
							if (forecastDate && Math.abs(truthDate - forecastDate) <= 3 * 24 * 60 * 60 * 1000) {
								tooltipContent += `Observed: ${Math.round(truthPoint.value)}<br/>`;
							}
						}
				
						// Add forecast values
						forecastPoints.forEach(point => {
							tooltipContent += `${point.model}: ${Math.round(point.value)}<br/>`;
						});
				
						// Position and show tooltip
						this.tooltip
							.html(tooltipContent)
							.style('left', (event.pageX + 10) + 'px')
							.style('top', (event.pageY - 10) + 'px')
							.style('opacity', 1);
					} else {
						// Hide tooltip if no points are nearby
						this.tooltip.style('opacity', 0);
					}
				});

                // Mouse leave handler
                overlay.on('mouseleave', () => {
                    hoverLine.style('opacity', 0);
                    this.tooltip.style('opacity', 0);
                });
            });

            // Calculate total height needed
            const numRows = Math.ceil(locations.length / this.facetsPerRow);
            const totalHeight = (numRows * (this.facetHeight + this.facetPadding)) + 
                              this.margin.top + this.margin.bottom;

            // Update SVG height
            d3.select(this.element)
                .select('svg')
                .attr('height', totalHeight);

            // Add legend
            const legend = this.svg.append('g')
                .attr('class', 'legend')
                .attr('transform', `translate(${this.facetsPerRow * this.facetWidth}, 0)`);

            // Add truth to legend
            legend.append('line')
                .attr('x1', 0)
                .attr('x2', 20)
                .attr('y1', 0)
                .attr('y2', 0)
                .attr('stroke', '#2c3e50')
                .attr('stroke-width', 2);

            legend.append('text')
                .attr('x', 25)
                .attr('y', 0)
                .attr('dy', '0.32em')
                .text('Observed')
                .style('font-size', '12px');

            // Add forecasts to legend
            const uniqueModels = [...new Set(forecasts.map(d => d.model))].sort();
            uniqueModels.forEach((model, i) => {
                const y = (i + 1) * 20;
                legend.append('line')
                    .attr('x1', 0)
                    .attr('x2', 20)
                    .attr('y1', y)
                    .attr('y2', y)
                    .attr('stroke', this.colorScale(model))
                    .attr('stroke-width', 2);

                legend.append('text')
                    .attr('x', 25)
                    .attr('y', y)
                    .attr('dy', '0.32em')
                    .text(model)
                    .style('font-size', '12px');
            });

        } catch (error) {
            console.error('Error updating chart:', error);
            console.error('Error details:', error.message);
            console.error('Stack:', error.stack);
        }
    }

    // Helper function to find closest point in time series
    findClosestPoint(data, date) {
        if (!data || data.length === 0) return null;
        
        return data.reduce((prev, curr) => {
            const prevDiff = Math.abs(new Date(prev.date) - date);
            const currDiff = Math.abs(new Date(curr.date) - date);
            return prevDiff < currDiff ? prev : curr;
        });
    }

    // Helper function to find closest forecast points
    findClosestForecastPoints(forecasts, date) {
        if (!forecasts || forecasts.length === 0) return [];

        // Group forecasts by model
        const modelGroups = d3.group(forecasts, d => d.model);
        
        // Find closest point for each model
        const closestPoints = [];
        modelGroups.forEach((points, model) => {
            const closest = this.findClosestPoint(points, date);
            if (closest) {
                closestPoints.push(closest);
            }
        });

        return closestPoints;
    }
}