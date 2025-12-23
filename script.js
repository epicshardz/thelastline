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
let currentFit = 'mooresLaw'; // Default fit for countdown: mooresLaw, polynomial, exponential, linear, etc.
let allFits = null; // Store all calculated fits
let referenceDate = null; // Reference date for calculations

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
    const dateMap = new Map();
    
    if (data.historicalBestScores) {
        data.historicalBestScores.forEach(milestone => {
            const dateStr = milestone.date;
            if (!dateMap.has(dateStr)) {
                dateMap.set(dateStr, { bestScore: milestone.score, date: new Date(dateStr) });
            }
        });
    }
    
    data.scores.forEach(scoreEntry => {
        const dateStr = scoreEntry.date;
        if (!dateMap.has(dateStr)) {
            dateMap.set(dateStr, { bestScore: scoreEntry.bestScore, date: new Date(dateStr) });
        } else {
            const existing = dateMap.get(dateStr);
            if (scoreEntry.bestScore > existing.bestScore) {
                existing.bestScore = scoreEntry.bestScore;
            }
        }
    });
    
    const sortedDates = Array.from(dateMap.entries())
        .sort((a, b) => a[1].date - b[1].date);
    
    referenceDate = sortedDates[0][1].date;
    const historicalPoints = sortedDates.map(([dateStr, info]) => {
        const daysSinceRef = (info.date - referenceDate) / (1000 * 60 * 60 * 24);
        return { x: daysSinceRef, y: info.bestScore };
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
        ridge: ridgeFit(historicalPoints),
        localLinear: localLinearFit(historicalPoints)
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
                    callbacks: {
                        label: function(context) {
                            const model = sortedModels[context.dataIndex];
                            return `${model.score}% (${model.provider})`;
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
                        }
                    }
                }
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
    localLinear: {
        label: '📍 Local Linear',
        color: '#88ff88',
        dash: [4, 4]
    }
};

// Initialize the projection line chart with historical data and exponential projection
function initializeProjectionChart() {
    const ctx = document.getElementById('projectionChart').getContext('2d');
    const projection = calculateProjectedDate();
    
    // Generate data points for the projection
    const dataPoints = generateProjectionData(projection);
    
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
            pointRadius: 4,
            pointHoverRadius: 8,
            fill: false,
            tension: 0.3,
            spanGaps: true,
            order: 0
        };
    });
    
    projectionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dataPoints.labels,
            datasets: [
                // Best score progression line - THICK GREEN LINE
                {
                    label: '🟢 ACTUAL BEST SCORE',
                    data: dataPoints.bestScores,
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
                                   item.text.includes('🏔️') ||
                                   item.text.includes('📍');
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
                            return context[0].label;
                        },
                        label: function(context) {
                            if (context.raw === null || context.raw === undefined) return null;
                            const datasetLabel = context.dataset.label;
                            if (datasetLabel.includes('PROJECTION')) {
                                return `Projected: ${context.raw.toFixed(1)}%`;
                            }
                            return `${datasetLabel}: ${context.raw.toFixed(1)}%`;
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
                        minRotation: 45
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
    const plottedModels = new Set(); // Track models already plotted
    
    // Sort score entries by date (earliest first)
    const sortedScores = [...data.scores].sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    // Go through each score entry chronologically
    sortedScores.forEach((scoreEntry) => {
        const entryDate = new Date(scoreEntry.date);
        const entryDateLabel = formatDateShort(entryDate);
        const labelIndex = dataPoints.labels.indexOf(entryDateLabel);
        
        if (labelIndex === -1) return;
        
        // For the top 5 models at each date, create scatter points (if not already plotted)
        const topModels = [...scoreEntry.models].sort((a, b) => b.score - a.score).slice(0, 5);
        
        topModels.forEach((model, modelIndex) => {
            // Skip if this model was already plotted at an earlier date
            if (plottedModels.has(model.name)) return;
            
            plottedModels.add(model.name);
            const color = getProviderColor(model.provider);
            
            // Create data array with null everywhere except at this date
            const modelData = dataPoints.labels.map((label, i) => {
                if (i === labelIndex) {
                    return model.score;
                }
                return null;
            });
            
            datasets.push({
                label: model.name,
                data: modelData,
                borderColor: color,
                backgroundColor: color + 'CC',
                borderWidth: 2,
                pointBackgroundColor: color,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 1,
                pointRadius: 5,
                pointHoverRadius: 8,
                fill: false,
                showLine: false,
                order: 3 + modelIndex
            });
        });
    });
    
    return datasets;
}

// Create datasets for each model to show as scatter points (legacy)
function createModelDatasets(dataPoints) {
    const latestData = data.scores[data.scores.length - 1];
    const models = latestData.models;
    
    // Find the index where the current date is in the labels
    const latestDate = new Date(latestData.date);
    const latestDateLabel = formatDateShort(latestDate);
    const currentDateIndex = dataPoints.labels.indexOf(latestDateLabel);
    
    // Create a dataset for each model
    return models.map((model, index) => {
        // Create an array with nulls except at the current date
        const modelData = dataPoints.labels.map((label, i) => {
            if (i === currentDateIndex) {
                return model.score;
            }
            return null;
        });
        
        const color = getProviderColor(model.provider);
        
        return {
            label: model.name,
            data: modelData,
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

// Moore's Law fit: y = startScore * 2^((x - startDay) / doublingTime)
// Uses fixed 365-day doubling time, starting from latest data point
function mooresLawFit(points, doublingTimeDays = 365) {
    // Use the LAST point (latest data) as baseline for Moore's Law projection
    const lastPoint = points[points.length - 1];
    const startScore = lastPoint.y;
    const startDay = lastPoint.x;
    
    return { 
        startScore, 
        startDay,
        doublingTimeDays,
        predict: (x) => startScore * Math.pow(2, (x - startDay) / doublingTimeDays) 
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
    // Collect all unique dates with their data
    const dateMap = new Map();
    
    // Add historical best scores
    if (data.historicalBestScores) {
        data.historicalBestScores.forEach(milestone => {
            const dateStr = milestone.date;
            if (!dateMap.has(dateStr)) {
                dateMap.set(dateStr, { bestScore: milestone.score, date: new Date(dateStr) });
            }
        });
    }
    
    // Add scores from scores array (may override or add new)
    data.scores.forEach(scoreEntry => {
        const dateStr = scoreEntry.date;
        if (!dateMap.has(dateStr)) {
            dateMap.set(dateStr, { bestScore: scoreEntry.bestScore, date: new Date(dateStr) });
        } else {
            const existing = dateMap.get(dateStr);
            if (scoreEntry.bestScore > existing.bestScore) {
                existing.bestScore = scoreEntry.bestScore;
            }
        }
    });
    
    // Sort dates chronologically
    const sortedDates = Array.from(dateMap.entries())
        .sort((a, b) => a[1].date - b[1].date);
    
    // Build labels and bestScores arrays
    const labels = [];
    const bestScores = [];
    
    // Reference date for calculating days
    const referenceDate = sortedDates[0][1].date;
    const historicalPoints = [];
    
    sortedDates.forEach(([dateStr, info]) => {
        labels.push(formatDateShort(info.date));
        bestScores.push(info.bestScore);
        
        // Convert date to days since reference
        const daysSinceRef = (info.date - referenceDate) / (1000 * 60 * 60 * 24);
        historicalPoints.push({ x: daysSinceRef, y: info.bestScore });
    });
    
    // Calculate all fits
    const doublingTimeDays = data.projection.doublingTimeDays || 365;
    const fits = {
        linear: linearFit(historicalPoints),
        exponential: exponentialFit(historicalPoints),
        mooresLaw: mooresLawFit(historicalPoints, doublingTimeDays),
        logarithmic: logarithmicFit(historicalPoints),
        polynomial: polynomialFit(historicalPoints),
        logistic: logisticFit(historicalPoints, 100),
        powerLaw: powerLawFit(historicalPoints),
        ridge: ridgeFit(historicalPoints),
        localLinear: localLinearFit(historicalPoints)
    };
    
    // Get the latest data point
    const latestData = data.scores[data.scores.length - 1];
    const latestDate = new Date(latestData.date);
    const latestDays = (latestDate - referenceDate) / (1000 * 60 * 60 * 24);
    
    // Initialize projection arrays
    const projections = {
        linear: labels.map(() => null),
        exponential: labels.map(() => null),
        mooresLaw: labels.map(() => null),
        logarithmic: labels.map(() => null),
        polynomial: labels.map(() => null),
        logistic: labels.map(() => null),
        powerLaw: labels.map(() => null),
        ridge: labels.map(() => null),
        localLinear: labels.map(() => null)
    };
    
    // Set starting point for ALL projections to the actual current best score
    // This ensures all projection lines start from the same point
    const latestIndex = labels.indexOf(formatDateShort(latestDate));
    const currentBestScore = latestData.bestScore;
    
    if (latestIndex !== -1) {
        Object.keys(projections).forEach(key => {
            projections[key][latestIndex] = currentBestScore;
        });
    }
    
    // Generate future projection points
    const maxYears = 5;
    let currentDate = new Date(latestDate);
    const endDate = new Date(latestDate);
    endDate.setFullYear(endDate.getFullYear() + maxYears);
    
    let isFirstFuturePoint = true;
    
    while (currentDate < endDate) {
        currentDate = new Date(currentDate);
        currentDate.setMonth(currentDate.getMonth() + 3); // Quarterly points
        
        const daysSinceRef = (currentDate - referenceDate) / (1000 * 60 * 60 * 24);
        const dateLabel = formatDateShort(currentDate);
        
        labels.push(dateLabel);
        bestScores.push(null);
        
        // Calculate each projection, applying offset to ensure continuity from current score
        Object.keys(fits).forEach(key => {
            const rawScore = fits[key].predict(daysSinceRef);
            const rawScoreAtLatest = fits[key].predict(latestDays);
            
            // Apply offset so projection starts from actual current score
            const offset = currentBestScore - rawScoreAtLatest;
            let score = rawScore + offset;
            
            score = Math.max(0, Math.min(115, score)); // Clamp to 0-115 (allow overshoot)
            projections[key].push(score);
        });
        
        isFirstFuturePoint = false;
    }
    
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
        labels, 
        bestScores, 
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
