// ========================================
// THE LAST LINE - Main JavaScript
// Exponential (Moore's Law) Projection Model
// ========================================

// Global variables
let data = null;
let scoreChart = null;
let projectionChart = null;
let countdownInterval = null;
let targetDate = null;
let currentFit = 'polynomial'; // Default fit for countdown: mooresLaw, polynomial, exponential, linear, etc.
let allFits = null; // Store all calculated fits
let referenceDate = null; // Reference date for calculations
const CLUSTER_MIN_POINTS = 6; // Minimum points to attempt clustering
const CLUSTER_KMEANS_ITERS = 10; // Simple 1D k-means iterations
const FIT_SAMPLE_DAYS = 7; // Denser sampling for smooth non-linear curves
const PROJECTION_END_YEAR = 2028;
const PROJECTION_END_MONTH = 4; // May (0-indexed, so 4 = May)
const TRENDLINE_STOP_AT = 115; // Stop drawing when lines hit the top of the chart
const SCATTER_TOP_PER_DATE = 5; // Reduce clutter: only show top N models per date

function average(values) {
    if (!values || values.length === 0) return 0;
    const sum = values.reduce((acc, v) => acc + v, 0);
    return sum / values.length;
}

function clusterMean(values) {
    if (!values || values.length === 0) return 0;
    if (values.length < CLUSTER_MIN_POINTS) {
        return average(values);
    }
    
    let c1 = Math.min(...values);
    let c2 = Math.max(...values);
    let clusterA = [];
    let clusterB = [];
    
    for (let i = 0; i < CLUSTER_KMEANS_ITERS; i++) {
        clusterA = [];
        clusterB = [];
        
        values.forEach(value => {
            if (Math.abs(value - c1) <= Math.abs(value - c2)) {
                clusterA.push(value);
            } else {
                clusterB.push(value);
            }
        });
        
        if (clusterA.length === 0 || clusterB.length === 0) {
            return average(values);
        }
        
        const nextC1 = average(clusterA);
        const nextC2 = average(clusterB);
        
        if (Math.abs(nextC1 - c1) < 1e-6 && Math.abs(nextC2 - c2) < 1e-6) {
            c1 = nextC1;
            c2 = nextC2;
            break;
        }
        
        c1 = nextC1;
        c2 = nextC2;
    }
    
    const highCluster = c1 >= c2 ? clusterA : clusterB;
    return average(highCluster);
}

function buildDateMaps() {
    const dateMap = new Map();
    const clusterMap = new Map();
    const datesWithModels = new Set();
    
    data.scores.forEach(scoreEntry => {
        const dateStr = scoreEntry.date;
        const entryDate = new Date(dateStr);
        datesWithModels.add(dateStr);
        
        if (!dateMap.has(dateStr)) {
            dateMap.set(dateStr, { bestScore: scoreEntry.bestScore, date: entryDate });
        } else {
            const existing = dateMap.get(dateStr);
            if (scoreEntry.bestScore > existing.bestScore) {
                existing.bestScore = scoreEntry.bestScore;
            }
        }
        
        const scores = scoreEntry.models.map(model => model.score);
        const meanScore = clusterMean(scores);
        clusterMap.set(dateStr, { date: entryDate, meanScore });
    });
    
    if (data.historicalBestScores) {
        data.historicalBestScores.forEach(milestone => {
            const dateStr = milestone.date;
            const entryDate = new Date(dateStr);
            if (!dateMap.has(dateStr)) {
                dateMap.set(dateStr, { bestScore: milestone.score, date: entryDate });
            } else {
                const existing = dateMap.get(dateStr);
                if (milestone.score > existing.bestScore) {
                    existing.bestScore = milestone.score;
                }
            }
            
            if (!datesWithModels.has(dateStr) && !clusterMap.has(dateStr)) {
                clusterMap.set(dateStr, { date: entryDate, meanScore: milestone.score });
            }
        });
    }
    
    return { dateMap, clusterMap };
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    initializeCharts();
    initializeCountdown();
    updateStats();
});

// Load data from JSON file
async function loadData() {
    try {
        const response = await fetch('data.json');
        data = await response.json();
        console.log('Data loaded:', data);
    } catch (error) {
        console.error('Error loading data:', error);
        // Use fallback data if fetch fails
        data = getFallbackData();
    }
}

// Fallback data in case JSON fetch fails
function getFallbackData() {
    return {
        lastUpdated: "2024-12-21",
        historicalBestScores: [
            { date: "2022-11-30", score: 0, model: "ChatGPT (GPT-3.5)" },
            { date: "2024-12-01", score: 18.6, model: "Gemini 2.0 Flash Thinking Exp" }
        ],
        scores: [{
            date: "2024-12-21",
            models: [
                { name: "Gemini 2.0 Flash Thinking Exp", score: 18.6, provider: "Google" },
                { name: "o1", score: 9.1, provider: "OpenAI" },
                { name: "Gemini 2.0 Flash", score: 6.2, provider: "Google" },
                { name: "Claude 3.5 Sonnet", score: 4.3, provider: "Anthropic" },
                { name: "GPT-4o", score: 3.3, provider: "OpenAI" }
            ],
            bestScore: 18.6
        }],
        projection: {
            method: "exponential",
            doublingTimeDays: 365,
            startDate: "2024-12-01",
            startScore: 18.6,
            targetScore: 100
        }
    };
}

// Build historical points and calculate all fits (called once on init)
function buildFits() {
    const { dateMap, clusterMap } = buildDateMaps();
    const sortedDates = Array.from(dateMap.entries())
        .sort((a, b) => a[1].date - b[1].date);
    
    referenceDate = sortedDates[0][1].date;
    const historicalPoints = Array.from(clusterMap.values()).map(point => {
        const daysSinceRef = (point.date - referenceDate) / (1000 * 60 * 60 * 24);
        return { x: daysSinceRef, y: point.meanScore };
    });
    
    const doublingTimeDays = data.projection.doublingTimeDays || 365;
    
    allFits = {
        linear: linearFit(historicalPoints),
        exponential: exponentialFit(historicalPoints),
        mooresLaw: mooresLawFit(historicalPoints, doublingTimeDays),
        logarithmic: logarithmicFit(historicalPoints),
        polynomial: polynomialFit(historicalPoints),
        logistic: logisticFit(historicalPoints, 100),
        powerLaw: powerLawFit(historicalPoints),
        ridge: ridgeFit(historicalPoints)
    };
    
    return { historicalPoints, sortedDates };
}

// Calculate projected date using the selected fit (currentFit global)
function calculateProjectedDate() {
    const latestData = data.scores[data.scores.length - 1];
    const currentBest = latestData.bestScore;
    
    // Build fits if not already built
    if (!allFits) {
        buildFits();
    }
    
    const fit = allFits[currentFit];
    if (!fit) {
        console.error('Unknown fit:', currentFit);
        return { targetDate: new Date(), daysToTarget: 0, currentBest };
    }
    
    const latestDate = new Date(latestData.date);
    const latestDays = (latestDate - referenceDate) / (1000 * 60 * 60 * 24);
    
    // Find days to 100%
    let daysToTarget = null;
    const maxDays = 5000;
    for (let day = latestDays; day < latestDays + maxDays; day += 1) {
        const score = fit.predict(day);
        if (score >= 100) {
            daysToTarget = day - latestDays;
            break;
        }
    }
    
    const target = new Date(latestDate);
    if (daysToTarget !== null) {
        target.setDate(target.getDate() + Math.ceil(daysToTarget));
    } else {
        target.setFullYear(target.getFullYear() + 5);
        daysToTarget = 365 * 5;
    }
    
    return {
        targetDate: target,
        daysToTarget: Math.ceil(daysToTarget),
        currentBest: currentBest,
        fitName: currentFit
    };
}

// Switch the countdown to a different fit model
function setCountdownFit(fitName) {
    if (!FIT_CONFIGS[fitName]) {
        console.error('Unknown fit:', fitName);
        return;
    }
    
    currentFit = fitName;
    
    // Recalculate and update countdown
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    initializeCountdown();
    
    console.log(`Countdown now using: ${FIT_CONFIGS[fitName].label}`);
}

// Calculate score at a given date using exponential growth
function calculateScoreAtDate(startDate, startScore, targetDate, doublingTimeDays) {
    const daysDiff = (targetDate - startDate) / (1000 * 60 * 60 * 24);
    const score = startScore * Math.pow(2, daysDiff / doublingTimeDays);
    return Math.min(100, score); // Cap at 100%
}

// Initialize countdown timer
function initializeCountdown() {
    const projection = calculateProjectedDate();
    targetDate = projection.targetDate;
    
    // Display target date
    const targetDateEl = document.getElementById('targetDate');
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const dayName = days[targetDate.getDay()];
    const monthName = months[targetDate.getMonth()];
    const day = targetDate.getDate();
    const year = targetDate.getFullYear();
    
    targetDateEl.textContent = `${dayName}, ${monthName} ${day}, ${year}`;
    
    // Start countdown
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

// Update countdown display
function updateCountdown() {
    const now = new Date();
    const diff = targetDate - now;
    
    if (diff <= 0) {
        document.getElementById('days').textContent = '000';
        document.getElementById('hours').textContent = '00';
        document.getElementById('minutes').textContent = '00';
        document.getElementById('seconds').textContent = '00';
        clearInterval(countdownInterval);
        return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    document.getElementById('days').textContent = String(days).padStart(3, '0');
    document.getElementById('hours').textContent = String(hours).padStart(2, '0');
    document.getElementById('minutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('seconds').textContent = String(seconds).padStart(2, '0');
}

// Update stats display
function updateStats() {
    const latestData = data.scores[data.scores.length - 1];
    const bestModel = latestData.models.reduce((prev, current) => 
        (prev.score > current.score) ? prev : current
    );
    
    document.getElementById('currentBest').textContent = `${bestModel.score.toFixed(1)}%`;
    document.getElementById('bestModel').textContent = bestModel.name;
    document.getElementById('remaining').textContent = `${(100 - bestModel.score).toFixed(1)}%`;
    document.getElementById('lastUpdated').textContent = data.lastUpdated;
}

// Get color based on provider
function getProviderColor(provider) {
    const colors = {
        'Google': '#4285F4',
        'OpenAI': '#00A67E',
        'Anthropic': '#D4A574',
        'Meta': '#0668E1',
        'Mistral': '#FF7000',
        'xAI': '#1DA1F2',
        'Alibaba': '#FF6A00',
        'DeepSeek': '#5B6EE1',
        'Microsoft': '#00BCF2'
    };
    return colors[provider] || '#00ff00';
}

// Initialize Chart.js charts
function initializeCharts() {
    initializeScoreChart();
    initializeProjectionChart();
}

// Initialize the horizontal bar chart for model scores
function initializeScoreChart() {
    const ctx = document.getElementById('scoreChart').getContext('2d');
    const canvas = document.getElementById('scoreChart');
    const latestData = data.scores[data.scores.length - 1];
    
    // Sort models by score descending
    const sortedModels = [...latestData.models].sort((a, b) => b.score - a.score);
    
    const labels = sortedModels.map(m => m.name);
    const scores = sortedModels.map(m => m.score);
    const colors = sortedModels.map(m => getProviderColor(m.provider));
    
    scoreChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Score (%)',
                data: scores,
                backgroundColor: colors.map(c => c + '80'),
                borderColor: colors,
                borderWidth: 2
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#0d1117',
                    titleColor: '#00ffff',
                    bodyColor: '#00ff00',
                    borderColor: '#00ff00',
                    borderWidth: 1,
                    titleFont: {
                        family: 'VT323',
                        size: 16
                    },
                    bodyFont: {
                        family: 'VT323',
                        size: 14
                    },
                    footerFont: {
                        family: 'VT323',
                        size: 12
                    },
                    footerColor: '#00ccff',
                    callbacks: {
                        label: function(context) {
                            const model = sortedModels[context.dataIndex];
                            return `${model.score}% (${model.provider})`;
                        },
                        footer: function(context) {
                            const model = sortedModels[context[0].dataIndex];
                            if (model.source) {
                                return '🔗 Click to open source';
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: '#00ff0020',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#00aa00',
                        font: {
                            family: 'VT323',
                            size: 14
                        },
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#00ff00',
                        font: {
                            family: 'VT323',
                            size: 14
                        },
                        autoSkip: false
                    }
                }
            },
            onClick: function(event, elements) {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const model = sortedModels[index];
                    if (model.source) {
                        window.open(model.source, '_blank');
                    }
                }
            },
            onHover: function(event, elements) {
                canvas.style.cursor = elements.length > 0 && sortedModels[elements[0].index].source ? 'pointer' : 'default';
            }
        }
    });
}

// Projection fit configurations
const FIT_CONFIGS = {
    linear: {
        label: '📏 Linear',
        color: '#ff6600',
        dash: [5, 5]
    },
    exponential: {
        label: '📈 Exponential',
        color: '#ff0000',
        dash: [15, 5]
    },
    mooresLaw: {
        label: '🖥️ Moore\'s Law',
        color: '#00ff88',
        dash: [12, 4]
    },
    logarithmic: {
        label: '📉 Logarithmic',
        color: '#9900ff',
        dash: [10, 10]
    },
    polynomial: {
        label: '📊 Polynomial',
        color: '#00ccff',
        dash: [20, 5]
    },
    logistic: {
        label: '🔔 Logistic (S-curve)',
        color: '#ffcc00',
        dash: [8, 8]
    },
    powerLaw: {
        label: '⚡ Power Law',
        color: '#ff00ff',
        dash: [3, 3]
    },
    ridge: {
        label: '🏔️ Ridge',
        color: '#ff8888',
        dash: [6, 6]
    },
};

// Initialize the projection line chart with historical data and exponential projection
function initializeProjectionChart() {
    const ctx = document.getElementById('projectionChart').getContext('2d');
    const projection = calculateProjectedDate();
    
    // Generate data points for the projection
    const dataPoints = generateProjectionData(projection);
    const referenceDate = dataPoints.referenceDate;
    const dateFromDays = (days) => {
        const date = new Date(referenceDate);
        date.setDate(date.getDate() + Math.round(days));
        return formatDateShort(date);
    };
    
    // Create datasets for historical model scores at their actual dates
    const historicalModelDatasets = createHistoricalModelDatasets(dataPoints);
    
    // Create projection datasets for each fit type
    const projectionDatasets = Object.keys(FIT_CONFIGS).map(key => {
        const config = FIT_CONFIGS[key];
        const prediction = dataPoints.predictions[key];
        const dateStr = prediction ? formatDateShort(prediction.date) : 'Never';
        
        return {
            label: `${config.label} → ${dateStr}`,
            data: dataPoints.projections[key],
            borderColor: config.color,
            backgroundColor: config.color + '20',
            borderWidth: 3,
            borderDash: config.dash,
            pointBackgroundColor: config.color,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 1,
            pointRadius: 0,
            pointHoverRadius: 0,
            pointHitRadius: 6,
            fill: false,
            tension: 0,
            spanGaps: false,
            order: 0
        };
    });
    
    projectionChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                // Best score progression line - THICK GREEN LINE
                {
                    label: '🟢 ACTUAL BEST SCORE',
                    data: dataPoints.bestScorePoints,
                    borderColor: '#00ff00',
                    backgroundColor: 'rgba(0, 255, 0, 0.2)',
                    borderWidth: 5,
                    pointBackgroundColor: '#00ff00',
                    pointBorderColor: '#000000',
                    pointBorderWidth: 3,
                    pointRadius: 8,
                    pointHoverRadius: 12,
                    fill: true,
                    tension: 0.2,
                    spanGaps: true,
                    order: 10
                },
                // Individual model scatter points
                ...historicalModelDatasets,
                // All projection fits
                ...projectionDatasets
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'nearest'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#00ff00',
                        font: {
                            family: 'VT323',
                            size: 14
                        },
                        usePointStyle: true,
                        padding: 10,
                        filter: function(item) {
                            // Show main datasets and all projection fits
                            return item.text.includes('ACTUAL') || 
                                   item.text.includes('📏') ||
                                   item.text.includes('📈') ||
                                   item.text.includes('🖥️') ||
                                   item.text.includes('📉') ||
                                   item.text.includes('📊') ||
                                   item.text.includes('🔔') ||
                                   item.text.includes('⚡') ||
                                   item.text.includes('🏔️');
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#0d1117',
                    titleColor: '#00ffff',
                    bodyColor: '#00ff00',
                    borderColor: '#00ff00',
                    borderWidth: 1,
                    titleFont: {
                        family: 'VT323',
                        size: 18
                    },
                    bodyFont: {
                        family: 'VT323',
                        size: 16
                    },
                    padding: 12,
                    callbacks: {
                        title: function(context) {
                            const days = context[0].parsed.x;
                            return dateFromDays(days);
                        },
                        label: function(context) {
                            if (context.parsed.y === null || context.parsed.y === undefined) return null;
                            const datasetLabel = context.dataset.label;
                            const raw = context.raw;
                            if (raw && raw.model) {
                                const provider = raw.provider ? ` (${raw.provider})` : '';
                                return `${raw.model}${provider}: ${context.parsed.y.toFixed(1)}%`;
                            }
                            if (datasetLabel.includes('PROJECTION')) {
                                return `Projected: ${context.parsed.y.toFixed(1)}%`;
                            }
                            return `${datasetLabel}: ${context.parsed.y.toFixed(1)}%`;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        targetLine: {
                            type: 'line',
                            yMin: 100,
                            yMax: 100,
                            borderColor: '#ff0000',
                            borderWidth: 3,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: '🎯 100% - HUMANITY\'S LAST EXAM PASSED',
                                position: 'center',
                                backgroundColor: '#ff0000',
                                color: '#ffffff',
                                font: {
                                    family: 'VT323',
                                    size: 16,
                                    weight: 'bold'
                                },
                                padding: 8
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    max: dataPoints.maxDays,
                    grid: {
                        color: '#00ff0020',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#00ff00',
                        font: {
                            family: 'VT323',
                            size: 14
                        },
                        maxRotation: 45,
                        minRotation: 45,
                        callback: function(value) {
                            return dateFromDays(value);
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    max: 115,
                    grid: {
                        color: '#00ff0020',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#00ff00',
                        font: {
                            family: 'VT323',
                            size: 16
                        },
                        callback: function(value) {
                            return value + '%';
                        },
                        stepSize: 10
                    }
                }
            }
        }
    });
}

// Create datasets for historical model scores at their actual dates
// Only shows each model at its EARLIEST appearance (no duplicates)
function createHistoricalModelDatasets(dataPoints) {
    const datasets = [];
    const referenceDate = dataPoints.referenceDate;
    const endDate = dataPoints.endDate;
    const points = [];
    const pointColors = [];
    
    // Track which model+score combinations we've already added
    const seenModelScores = new Set();
    
    // Sort score entries by date (earliest first)
    const sortedScores = [...data.scores].sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    // Add model points - only first appearance of each model+score
    sortedScores.forEach((scoreEntry) => {
        const entryDate = new Date(scoreEntry.date);
        if (entryDate > endDate) return;
        const daysSinceRef = (entryDate - referenceDate) / (1000 * 60 * 60 * 24);
        
        // Sort models by score descending
        const sortedModels = [...scoreEntry.models].sort((a, b) => b.score - a.score);
        
        sortedModels.forEach((model) => {
            // Create unique key for model+score combination
            const key = `${model.name}|${model.score}`;
            
            // Only add if we haven't seen this model+score before
            if (!seenModelScores.has(key)) {
                seenModelScores.add(key);
                points.push({ x: daysSinceRef, y: model.score, model: model.name, provider: model.provider });
                pointColors.push(getProviderColor(model.provider));
            }
        });
    });
    
    // Add historical best scores if there are dates with no model list
    const datesWithModels = new Set(data.scores.map(entry => entry.date));
    if (data.historicalBestScores) {
        data.historicalBestScores.forEach((milestone) => {
            if (datesWithModels.has(milestone.date)) return;
            const entryDate = new Date(milestone.date);
            if (entryDate > endDate) return;
            
            // Create unique key for model+score combination
            const key = `${milestone.model}|${milestone.score}`;
            
            // Only add if we haven't seen this model+score before
            if (!seenModelScores.has(key)) {
                seenModelScores.add(key);
                const daysSinceRef = (entryDate - referenceDate) / (1000 * 60 * 60 * 24);
                points.push({ x: daysSinceRef, y: milestone.score, model: milestone.model, provider: milestone.provider });
                pointColors.push(getProviderColor(milestone.provider));
            }
        });
    }
    
    datasets.push({
        label: 'Top Models',
        data: points,
        borderColor: '#00ff00',
        backgroundColor: pointColors,
        pointBackgroundColor: pointColors,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: false,
        showLine: false,
        order: 2
    });
    
    return datasets;
}

// Create datasets for each model to show as scatter points (legacy)
function createModelDatasets(dataPoints) {
    const latestData = data.scores[data.scores.length - 1];
    const models = latestData.models;
    const referenceDate = dataPoints.referenceDate;
    
    // Find the x position for the current date
    const latestDate = new Date(latestData.date);
    const daysSinceRef = (latestDate - referenceDate) / (1000 * 60 * 60 * 24);
    
    // Create a dataset for each model
    return models.map((model, index) => {
        const color = getProviderColor(model.provider);
        
        return {
            label: model.name,
            data: [{ x: daysSinceRef, y: model.score }],
            borderColor: color,
            backgroundColor: color,
            borderWidth: 2,
            pointBackgroundColor: color,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 8,
            pointHoverRadius: 10,
            fill: false,
            showLine: false, // Only show points, no line
            order: 1
        };
    });
}

// ========================================
// REGRESSION FIT FUNCTIONS
// ========================================

// Linear regression: y = mx + b
function linearFit(points) {
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    points.forEach(p => {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumX2 += p.x * p.x;
    });
    
    const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const b = (sumY - m * sumX) / n;
    
    return { m, b, predict: (x) => m * x + b };
}

// Exponential regression: y = a * e^(bx)
function exponentialFit(points) {
    // Transform to linear: ln(y) = ln(a) + bx
    const logPoints = points.filter(p => p.y > 0).map(p => ({ x: p.x, y: Math.log(p.y) }));
    const linear = linearFit(logPoints);
    const a = Math.exp(linear.b);
    const b = linear.m;
    
    return { a, b, predict: (x) => a * Math.exp(b * x) };
}

// Logarithmic regression: y = a * ln(x + offset) + b
// Uses offset to handle x=0 properly and ensures it passes through latest point
function logarithmicFit(points) {
    // Filter out points with x=0 for fitting
    const validPoints = points.filter(p => p.x > 0);
    
    if (validPoints.length < 2) {
        // Not enough valid points, return a simple projection from last point
        const lastPoint = points[points.length - 1];
        return {
            a: 5,
            b: lastPoint.y,
            offset: lastPoint.x,
            predict: (x) => lastPoint.y + 5 * Math.log((x + 1) / (lastPoint.x + 1) + 1)
        };
    }
    
    // Transform x to ln(x) for points where x > 0
    const logPoints = validPoints.map(p => ({ x: Math.log(p.x), y: p.y }));
    const linear = linearFit(logPoints);
    
    return { 
        a: linear.m, 
        b: linear.b,
        predict: (x) => {
            if (x <= 0) return points[0].y; // Return first point's value for x <= 0
            return linear.m * Math.log(x) + linear.b;
        }
    };
}

// Polynomial (quadratic) regression: y = ax^2 + bx + c
function polynomialFit(points) {
    const n = points.length;
    let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
    let sumY = 0, sumXY = 0, sumX2Y = 0;
    
    points.forEach(p => {
        const x2 = p.x * p.x;
        sumX += p.x;
        sumX2 += x2;
        sumX3 += x2 * p.x;
        sumX4 += x2 * x2;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumX2Y += x2 * p.y;
    });
    
    // Solve using Cramer's rule (simplified)
    const matrix = [
        [n, sumX, sumX2],
        [sumX, sumX2, sumX3],
        [sumX2, sumX3, sumX4]
    ];
    const vector = [sumY, sumXY, sumX2Y];
    
    // Simple Gaussian elimination
    const det = (m) => m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) 
                      - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) 
                      + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    
    const D = det(matrix);
    if (Math.abs(D) < 1e-10) return { a: 0, b: 0, c: 0, predict: (x) => 0 };
    
    const Dc = det([[vector[0], matrix[0][1], matrix[0][2]],
                    [vector[1], matrix[1][1], matrix[1][2]],
                    [vector[2], matrix[2][1], matrix[2][2]]]);
    const Db = det([[matrix[0][0], vector[0], matrix[0][2]],
                    [matrix[1][0], vector[1], matrix[1][2]],
                    [matrix[2][0], vector[2], matrix[2][2]]]);
    const Da = det([[matrix[0][0], matrix[0][1], vector[0]],
                    [matrix[1][0], matrix[1][1], vector[1]],
                    [matrix[2][0], matrix[2][1], vector[2]]]);
    
    const c = Dc / D;
    const b = Db / D;
    const a = Da / D;
    
    return { a, b, c, predict: (x) => a * x * x + b * x + c };
}

// Logistic (S-curve) fit: y = L / (1 + e^(-k(x-x0)))
function logisticFit(points, L = 100) {
    // Simplified approach: find k and x0 using transformed linear regression
    // Transform: ln(L/y - 1) = -k*x + k*x0
    const transformedPoints = points
        .filter(p => p.y > 0 && p.y < L)
        .map(p => ({ x: p.x, y: Math.log(L / p.y - 1) }));
    
    if (transformedPoints.length < 2) {
        return { L, k: 0.005, x0: 500, predict: (x) => L / (1 + Math.exp(-0.005 * (x - 500))) };
    }
    
    const linear = linearFit(transformedPoints);
    const k = -linear.m;
    const x0 = linear.b / k;
    
    return { L, k, x0, predict: (x) => L / (1 + Math.exp(-k * (x - x0))) };
}

// Power law fit: y = a * x^b
function powerLawFit(points) {
    // Transform: ln(y) = ln(a) + b*ln(x)
    const logPoints = points
        .filter(p => p.x > 0 && p.y > 0)
        .map(p => ({ x: Math.log(p.x), y: Math.log(p.y) }));
    
    const linear = linearFit(logPoints);
    const a = Math.exp(linear.b);
    const b = linear.m;
    
    return { a, b, predict: (x) => a * Math.pow(x, b) };
}

// Moore's Law fit: y = startScore * 2^(x / doublingTime)
// Uses fixed doubling time, but fits startScore to all points (mean fit in log2 space)
function mooresLawFit(points, doublingTimeDays = 365) {
    const valid = points.filter(p => p.y > 0);
    if (valid.length === 0) {
        return {
            startScore: 0,
            startDay: 0,
            doublingTimeDays,
            predict: () => 0
        };
    }
    
    const log2 = (value) => Math.log(value) / Math.log(2);
    const meanLogIntercept = valid.reduce((sum, p) => {
        return sum + (log2(p.y) - (p.x / doublingTimeDays));
    }, 0) / valid.length;
    
    const startScore = Math.pow(2, meanLogIntercept);
    
    return {
        startScore,
        startDay: 0,
        doublingTimeDays,
        predict: (x) => startScore * Math.pow(2, x / doublingTimeDays)
    };
}

// Ridge regression: Linear with L2 regularization (more conservative)
function ridgeFit(points, lambda = 0.1) {
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    points.forEach(p => {
        sumX += p.x;
        sumY += p.y;
        sumXY += p.x * p.y;
        sumX2 += p.x * p.x;
    });
    
    // Ridge regression: add lambda to denominator for regularization
    const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX + lambda * n);
    const b = (sumY - m * sumX) / n;
    
    return { m, b, lambda, predict: (x) => m * x + b };
}

// Local Linear (KNN-like): Uses weighted average of recent points
function localLinearFit(points, k = 3) {
    // Sort points by x and use only recent points for local trend
    const sorted = [...points].sort((a, b) => a.x - b.x);
    const recent = sorted.slice(-k); // Last k points
    
    // Fit linear to recent points
    const linear = linearFit(recent);
    
    return { 
        m: linear.m, 
        b: linear.b, 
        k,
        predict: (x) => linear.m * x + linear.b 
    };
}

// Calculate days until score reaches 100 for a given fit
function daysTo100(fit, startDay, startScore) {
    const maxDays = 5000; // ~14 years max
    for (let day = startDay; day < startDay + maxDays; day += 1) {
        const score = fit.predict(day);
        if (score >= 100) {
            return day - startDay;
        }
    }
    return null; // Won't reach 100 in timeframe
}

// Generate projection data points with historical context
function generateProjectionData(projection) {
    const { dateMap, clusterMap } = buildDateMaps();
    const sortedDates = Array.from(dateMap.entries())
        .sort((a, b) => a[1].date - b[1].date);
    
    // Build best-score points
    const bestScorePoints = [];
    const endDate = new Date(PROJECTION_END_YEAR, PROJECTION_END_MONTH, 31); // May 31, 2028
    
    // Reference date for calculating days
    const referenceDate = sortedDates[0][1].date;
    
    sortedDates.forEach(([dateStr, info]) => {
        if (info.date > endDate) return;
        // Convert date to days since reference
        const daysSinceRef = (info.date - referenceDate) / (1000 * 60 * 60 * 24);
        bestScorePoints.push({ x: daysSinceRef, y: info.bestScore });
    });
    
    // Calculate all fits using per-date cluster means
    const doublingTimeDays = data.projection.doublingTimeDays || 365;
    const historicalPoints = Array.from(clusterMap.values())
        .filter(point => point.date <= endDate)
        .map(point => {
        const daysSinceRef = (point.date - referenceDate) / (1000 * 60 * 60 * 24);
        return { x: daysSinceRef, y: point.meanScore };
    });
    const fits = {
        linear: linearFit(historicalPoints),
        exponential: exponentialFit(historicalPoints),
        mooresLaw: mooresLawFit(historicalPoints, doublingTimeDays),
        logarithmic: logarithmicFit(historicalPoints),
        polynomial: polynomialFit(historicalPoints),
        logistic: logisticFit(historicalPoints, 100),
        powerLaw: powerLawFit(historicalPoints),
        ridge: ridgeFit(historicalPoints)
    };
    
    // Get the latest data point
    const latestData = data.scores[data.scores.length - 1];
    const latestDate = new Date(latestData.date);
    const latestDays = (latestDate - referenceDate) / (1000 * 60 * 60 * 24);
    
    // Build a dense timeline for smooth projection curves (limited to end of 2028)
    const maxDay = Math.max(0, (endDate - referenceDate) / (1000 * 60 * 60 * 24));
    const fitDays = [];
    for (let day = 0; day <= maxDay; day += FIT_SAMPLE_DAYS) {
        fitDays.push(day);
    }
    if (fitDays[fitDays.length - 1] !== maxDay) {
        fitDays.push(maxDay);
    }
    
    // Initialize projections across full timeline
    const projections = {};
    Object.keys(fits).forEach(key => {
        const series = [];
        for (const days of fitDays) {
            const raw = fits[key].predict(days);
            if (!Number.isFinite(raw)) {
                continue;
            }
            if (raw >= TRENDLINE_STOP_AT) {
                break;
            }
            if (raw < 0) {
                continue;
            }
            series.push({
                x: days,
                y: raw
            });
        }
        projections[key] = series;
    });
    
    // Calculate predicted dates to 100%
    const predictions = {};
    Object.keys(fits).forEach(key => {
        const days = daysTo100(fits[key], latestDays, latestData.bestScore);
        if (days !== null) {
            const predictedDate = new Date(latestDate);
            predictedDate.setDate(predictedDate.getDate() + days);
            predictions[key] = { days, date: predictedDate };
        } else {
            predictions[key] = null;
        }
    });
    
    return { 
        referenceDate,
        endDate,
        maxDays: maxDay,
        bestScorePoints, 
        projections,
        predictions,
        fits,
        hleStartIndex: 0 
    };
}

// Format date for display (short version with day for uniqueness)
function formatDateShort(date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = date.getDate();
    return `${months[date.getMonth()]} ${day}, ${date.getFullYear()}`;
}

// Format date for display (full version)
function formatDate(date) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Refresh data (can be called periodically or manually)
async function refreshData() {
    await loadData();
    if (scoreChart) {
        scoreChart.destroy();
    }
    if (projectionChart) {
        projectionChart.destroy();
    }
    initializeCharts();
    updateStats();
    
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    initializeCountdown();
}

// Export functions for external use
window.refreshData = refreshData;
window.setCountdownFit = setCountdownFit;
window.FIT_CONFIGS = FIT_CONFIGS;
