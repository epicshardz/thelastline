# THE LAST LINE 🖥️

A retro-styled website tracking AI progress on **Humanity's Last Exam** (HLE) - a benchmark designed to measure advanced AI capabilities.

![Retro Terminal Theme](https://img.shields.io/badge/theme-retro%20terminal-00ff00?style=flat-square)
![GitHub Pages](https://img.shields.io/badge/hosted-GitHub%20Pages-blue?style=flat-square)

## 🎯 Features

- **📊 Real-time Rankings** - Horizontal bar chart showing all AI model scores
- **📈 Projection Line** - Multiple regression models to predict when AI will reach 100%
- **⏱️ Countdown Timer** - Live countdown to the projected 100% achievement date
- **🖥️ Retro CRT Theme** - Green phosphor terminal aesthetic with scanlines

## 🚀 Quick Start

### View the Site
Visit: `https://epicshardz.github.io/thelastline`

### Local Development
1. Clone the repository
2. Open `index.html` in your browser
3. (Due to CORS, you may need a local server)

```bash
# Option 1: Python
python -m http.server 8000

# Option 2: Node.js
npx serve

# Option 3: VS Code Live Server extension
```

## 📁 Project Structure

```
thelastline/
├── index.html      # Main page
├── styles.css      # Retro CRT styling
├── script.js       # Charts & countdown logic
├── data.json       # Historical score data
└── README.md       # This file
```

## 🔧 Setup GitHub Pages

1. **Create a GitHub repository** named `thelastline`

2. **Push this code** to the repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/epicshardz/thelastline.git
   git push -u origin main
   ```

3. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: `main` / `root`
   - Save

4. **Your site will be live at**: `https://epicshardz.github.io/thelastline`

## 📊 Data Source

Data is sourced from [Artificial Analysis - Humanity's Last Exam](https://artificialanalysis.ai/evaluations/humanitys-last-exam).

## 🔄 Updating Data

To update the scores, manually edit `data.json` and push to the repository:

```bash
git add data.json
git commit -m "Update HLE scores"
git push
```

GitHub Pages will automatically redeploy with the new data.

## 🎨 Theme Customization

The retro theme uses CSS variables that can be easily modified:

```css
:root {
    --primary-green: #00ff00;   /* Main text color */
    --accent-cyan: #00ffff;     /* Headers */
    --accent-amber: #ffaa00;    /* Countdown date */
    --bg-color: #0a0a0a;        /* Background */
}
```

## 📝 License

MIT License - Feel free to fork and customize!

## 🙏 Credits

- Data: [Artificial Analysis](https://artificialanalysis.ai/)
- Fonts: [VT323](https://fonts.google.com/specimen/VT323), [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono)
- Charts: [Chart.js](https://www.chartjs.org/)

---

**THE LAST LINE** - *Monitoring Humanity's Final Exam* 🖥️
