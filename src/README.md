# Hydroponics System Dashboard

A real-time monitoring dashboard for hydroponics systems with water quality tracking, alerts, and data export capabilities.

## Features

- **Real-time Monitoring**: Track EC, pH, Temperature (°F), O2, and Water Level
- **Alert System**: Customizable threshold alerts with visual and audio notifications
- **Interactive Charts**: Visualize trends over 24-hour periods with live updates
- **Maintenance Mode**: Toggle maintenance mode to pause alerts
- **Data Export**: Export historical data to CSV
- **Controls Page**: Set parameter boundaries and monitoring thresholds
- **User Manual**: Comprehensive documentation included
- **Live Clock**: Real-time clock display in dashboard header

## System Architecture

- **Hardware**: Raspberry Pi with LoRa communication
- **Network**: The Things Network → AWS IoT Core
- **Database**: AWS DynamoDB
- **API**: AWS API Gateway with API key authentication
- **Frontend**: React + TypeScript + Tailwind CSS
- **Data Frequency**: Readings every 5 minutes with bidirectional communication

## Getting Started

### Prerequisites

- Node.js 16+ installed
- AWS account (for production deployment)
- API Gateway URL and API key (for production)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/hydroponics-dashboard.git
cd hydroponics-dashboard
```

2. Install dependencies:
```bash
npm install
```

3. Configure AWS settings (for production):
   - Edit `/config/aws-config.ts`
   - Add your API Gateway URL and API key
   - Set `USE_MOCK_DATA: false` to use real data

4. Run the development server:
```bash
npm run dev
```

5. Open your browser to the URL shown in the terminal

### Mock Data Mode

By default, the dashboard runs in mock data mode for testing. 

**To set mock data values**, edit `/config/mock-data-config.ts`:

```typescript
export const MOCK_DATA_CONFIG = {
  ec: 1.45,        // Electrical Conductivity in mS/cm
  ph: 6.8,         // pH level
  temperature: 68, // Temperature in °F
  o2: 8.2,         // Dissolved Oxygen in mg/L
  waterLevel: 85,  // Water Level in cm
  waterFlowOk: 1,  // Water flow status (1 = OK, 0 = Problem)
};
```

**Changes require a browser refresh to take effect.** The dashboard will display exactly the values you set - no auto-generation or variation.

## Authentication

Default password: `greenhouse`

## Configuration

### Thresholds & Setpoints

Use the **Controls** page to:
- Set alert thresholds for each parameter
- Configure EC and pH setpoints
- Send configuration to Raspberry Pi (in production mode)

### Mock Data

The dashboard displays exactly the values you set in `/config/mock-data-config.ts`.
Edit the values, save the file, and refresh your browser to see changes.
All settings are tracked in version control (Git).

## Project Structure

```
/
├── components/          # React components & UI library
├── config/              # AWS and mock data configuration
├── hooks/               # Custom React hooks
├── services/            # API and data services
├── styles/              # Global styles and CSS
└── types/               # TypeScript type definitions
```

## Technologies Used

- React 18
- TypeScript
- Tailwind CSS v4
- Recharts (for data visualization)
- Lucide React (icons)
- AWS IoT Core, API Gateway & DynamoDB
- date-fns (date utilities)

## License

MIT License - feel free to use this project for your own hydroponics systems!

## Support

For questions or issues, please open an issue on GitHub.