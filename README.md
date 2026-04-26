# Dirt Wear Co. — Park Journey Tracker

An interactive map of all 433+ National Park Service sites across the United States. Built for the Dirt Wear Company website.

## Features

- **All 433 NPS Sites** — Loads directly from the official NPS API (national parks, monuments, historic sites, battlefields, memorials, seashores, parkways, and more)
- **Click to Mark Visited** — Click any dot on the map to mark it red as visited
- **Click a State** — Click any state on the map to open a side panel listing all NPS sites in that state, with the ability to mark them visited from the list
- **Add Custom Sites** — Add any site not in the NPS database with name, designation, state, and coordinates
- **Download the Map** — Exports the current map as an SVG file with a Dirt Wear watermark
- **Filter by Designation** — Filter dots by type (National Park, Monument, Historic Site, etc.)
- **Filter by State** — Dropdown to show only sites in a specific state
- **Search by Name** — Live search to find any site by name
- **Persistent Storage** — Visited sites and custom sites are saved to localStorage so they persist between visits
- **Visited List** — A card grid below the map shows all sites you've marked as visited

## Color Guide

| Color | Meaning |
|-------|---------|
| 🔴 Red/Clay | Visited site |
| 🔵 Blue | Not yet visited |
| 🟡 Yellow/Gold | Custom site you added |

## How to Deploy on GitHub Pages

1. Create a new GitHub repository (e.g. `dirtwear-park-map`)
2. Upload all three files:
   - `index.html`
   - `style.css`
   - `app.js`
3. Go to your repository **Settings** → **Pages**
4. Under **Source**, select **Deploy from a branch**
5. Choose **main** branch and **/ (root)** folder
6. Click **Save**
7. Your site will be live at: `https://yourusername.github.io/dirtwear-park-map`

## NPS API Key

This app uses the NPS public API with a demo key (`DEMO_KEY`). The demo key has rate limits. To get unlimited access:

1. Go to [https://www.nps.gov/subjects/developer/get-started.htm](https://www.nps.gov/subjects/developer/get-started.htm)
2. Register for a free API key
3. In `app.js`, replace `DEMO_KEY` with your key in these two lines:
   ```
   "https://developer.nps.gov/api/v1/parks?limit=100&start=0&api_key=DEMO_KEY"
   "https://developer.nps.gov/api/v1/parks?limit=100&start=${start}&api_key=DEMO_KEY"
   ```

## Embedding on Square Website

Square's free plan does not support custom HTML/JavaScript embeds. Options:
- **Upgrade to Square Online** (paid) which allows custom code blocks
- **Link to this GitHub Pages site** from your About page with a button
- **Use the downloaded SVG** as a static image on your Square site

## Files

```
dirtwear-park-map/
├── index.html   — Main page structure
├── style.css    — All styling and layout
├── app.js       — Map logic, NPS API, interactions
└── README.md    — This file
```

## Built With

- [D3.js](https://d3js.org/) — Map rendering and data visualization
- [TopoJSON](https://github.com/topojson/topojson) — US state boundaries
- [NPS API](https://www.nps.gov/subjects/developer/) — Official park data
- [Google Fonts](https://fonts.google.com/) — Playfair Display + DM Sans

---

*Dirt Wear Co. — Uintah Basin, Utah. Women-founded. Family-run. Handmade with Utah red clay.*
