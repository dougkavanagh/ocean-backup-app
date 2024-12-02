# Ocean Backup

A desktop utility application for backing up Ocean MD data, built with Electron and TypeScript.

## Description

Ocean Backup is a cross-platform desktop application designed to help users backup their Ocean MD data efficiently and securely. The application provides a simple user interface to download the PDFs of a set of referrals.

This project is provided as-is. It is not supported or explictly endorsed by OceanMD or WELL Health.

## Features

- Cross-platform support (although currently only tested on Mac)
- Simple file download and backup of the PDF summaries for Ocean eRequests (eReferrals, eConsults and eOrders)
- Support for manual entry of referral references and/or Ocean CSV referral analytic files (exported using the Ocean Reports portal)

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/ocean-backup-app.git
cd ocean-backup-app
```

2. Install dependencies:

```bash
npm install
```

## Development

To run the application in development mode:

```bash
npm run dev
```

This will:

1. Build the TypeScript files
2. Start the Electron application

For continuous development with auto-reload:

```bash
npm run watch
```

## Building

To create a production build:

```bash
npm run make
```

This will generate platform-specific distributables in the `dist` directory.

## License

This project is licensed under the terms included in the LICENSE.txt file.
