# TripXL Backend

## Project Overview

TripXL is a comprehensive backend system designed for transportation and logistics management. It provides a robust API for handling bookings, vehicle dispatch, user authentication, route optimization, and various other operational functionalities. The system is built to support the TripXL platform, enabling efficient management of transportation services.

## Key Technologies

*   **Backend Framework**: Node.js with Express.js
*   **Language**: TypeScript
*   **Database**: Neon (Serverless PostgreSQL)
*   **ORM**: Drizzle ORM
*   **Authentication**: Passport.js (Local Strategy with session management)
*   **Bundler**: Webpack
*   **API Development**: RESTful services

## Prerequisites

Before you begin, ensure you have the following installed:

*   Node.js (LTS version recommended - the project uses versions 18.x, 20.x, 22.x in CI)
*   npm (comes with Node.js)
*   Access to a PostgreSQL compatible database. NeonDB is used in the configuration, so it's recommended for compatibility.

## Environment Variable Setup

This project requires certain environment variables to be configured for proper operation. Create a `.env` file in the root of the project and add the following variables:

```env
# Database Connection URL (Neon PostgreSQL)
DATABASE_URL="your_neon_database_connection_string"

# Session Secret for Express Session
SESSION_SECRET="your_strong_session_secret"

# (Optional) Port for the server to run on (defaults to 5000 or finds an available one)
# PORT=5000

# (Optional) Token for securing the fuel price update endpoint
# FUEL_PRICE_UPDATE_TOKEN="your_secure_token_for_fuel_updates"

# (Optional) SendGrid API Key for email services (e.g., password reset)
# SENDGRID_API_KEY="your_sendgrid_api_key"

# (Optional) Email address to send emails from
# EMAIL_FROM="your_email@example.com"
```

Replace placeholder values with your actual configuration details.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```

2.  **Install dependencies:**
    This project uses npm for package management.
    ```bash
    npm install
    ```
    *(Note: Based on the CI workflow, a `package.json` is expected at the root of the project.)*

3.  **Database Schema Setup:**
    The project uses Drizzle ORM. While specific migration commands aren't detailed in the currently available source, Drizzle ORM typically uses `drizzle-kit` for generating and applying migrations. You might need to:
    *   Ensure your `DATABASE_URL` is correctly configured in your `.env` file.
    *   Look for migration scripts or commands within the project (possibly in `package.json` scripts if it were visible, or related to Drizzle ORM documentation).
    *   If starting fresh and no migrations are provided, you might need to generate initial migrations from the schema defined in `@shared/schema`.

## Running the Application

The application can be run in development or production mode.

*   **Development Mode:**
    The `index.ts` file suggests Vite is used for development. A common command to start a Node.js/TypeScript project with Vite in development (often enabling hot-reloading) would be:
    ```bash
    npm run dev
    ```
    *(This assumes a `dev` script is defined in `package.json`.)*

*   **Production Mode:**
    A common command to start a Node.js application for production would be:
    ```bash
    npm start
    ```
    *(This assumes a `start` script is defined in `package.json`, which typically runs the compiled JavaScript output, possibly from a `dist` folder created by Webpack.)*

The server will attempt to start on the port defined by the `PORT` environment variable, or default to 5000. If that port is busy, it will try subsequent ports (5001, 5002, etc.).

## API Structure and Key Endpoints

The API is organized into several modules, generally accessible under the `/api` prefix. Key functional areas include:

*   **/api/auth**: User registration, login, logout, and session management.
*   **/api/bookings**: Creating, managing, and querying bookings.
*   **/api/dispatch**: Vehicle dispatch and assignment logic.
*   **/api/vehicle-groups, /api/vehicle-type-master**: Management of vehicle types and groups.
*   **/api/fuel-prices**: Managing and tracking fuel prices.
*   **/api/workflows**: Handling approval workflows.
*   **/api/maps**: Routes related to mapping and geo-services.
*   **/api/health**: Health check endpoint for the service.

Authentication is primarily handled via sessions using Passport.js. Most data-modifying endpoints will require authentication.

## Build Process

The project uses Webpack to bundle assets for production. The GitHub Actions workflow (`.github/workflows/webpack.yml`) defines the build step as:
```bash
npx webpack
```
This command will typically compile TypeScript to JavaScript and bundle it into an output directory (commonly `dist/`).

## Contributing

Contributions are welcome! Please follow these general guidelines:

*   Ensure any new code is well-documented.
*   Write unit tests for new features or bug fixes.
*   Follow the existing coding style and conventions.
*   Make pull requests to the `main` branch (or as specified by project maintainers).

(Further project-specific contribution details can be added here.)
