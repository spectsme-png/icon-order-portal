# ICON Print Agent (office PC)

Browsers cannot silent-print to a named Windows printer. This tiny local app does.

## Setup (once on Aynai PC)

```bat
cd print-agent
npm install
npm start
```

Leave the window open. It listens on `http://127.0.0.1:9100`.

## In the portal

1. Open Office → **Printers**
2. Pick **Label printer** (Zebra ZD421) and **Card printer** (Evolis Zenius)
3. Save
4. **Print labels** / **Print card** send straight to those printers (no dialog)

If the agent is offline, the portal falls back to the normal browser print dialog.
