# RFID Asset Tracking - Next.js Frontend

A modern Next.js application for real-time RFID asset onboarding and movement tracking.

## Features

- **Asset Onboarding**: Bind RFID tags to loan IDs with automatic scanning
- **Movement Tracking**: Real-time tracking of gold packets across readers
- **WebSocket Integration**: Live updates from backend RFID systems
- **Responsive Design**: Clean, modern UI with Tailwind CSS styling

## Getting Started

### Prerequisites

- Node.js 16+ and npm/yarn
- Backend running on `localhost:8000`

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
.
├── app/
│   ├── layout.tsx          # Root layout
│   ├── globals.css         # Global styles
│   ├── page.tsx            # Home page
│   ├── onboarding/
│   │   └── page.tsx        # Onboarding page
│   └── tracking/
│       └── page.tsx        # Tracking page
├── lib/
│   └── websocket.ts        # WebSocket utility
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

## API Endpoints

The frontend proxies these endpoints to the backend:

- `POST /bind` - Bind RFID tag to loan ID
- `POST /track` - Record asset movement
- `GET /trackings` - Get all tracking records
- `WS /ws` - WebSocket for real-time updates

## Configuration

Backend URL can be configured in `next.config.js` if needed.

## Conversion Notes

This project was converted from vanilla HTML to Next.js with the following improvements:

- **Component-based architecture** for better maintainability
- **Client-side rendering** for interactive features
- **WebSocket utility** for centralized real-time communication
- **TypeScript** for type safety
- **Modern CSS** with better styling and responsiveness
- **File-based routing** following Next.js conventions
