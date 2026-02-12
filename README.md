# Job AI Scout - Backend and Frontend

## Overview

**Job AI Scout** is a comprehensive job tracking and classification platform designed to scrape job postings from various sources, classify them using AI, and provide actionable insights for users. The platform is built with a modern tech stack, ensuring scalability, performance, and ease of use.

---

## Features

- **Job Scraping**: Automatically scrape job postings from websites like LinkedIn, company career pages, and more.
- **AI Classification**: Classify job postings as technical or non-technical using OpenAI's GPT-4.
- **User Management**: Manage customers, companies, and job data with a robust backend.
- **Customizable Scan Frequency**: Automatically scan job postings based on user-defined intervals (e.g., 24h, 48h).
- **Admin Dashboard**: Manage configurations, scan settings, and user data through an intuitive admin interface.
- **Secure Authentication**: User authentication with JWT and password hashing.

---

## Tech Stack

### Frontend
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS and shadcn-ui
- **Build Tool**: Vite
- **State Management**: Context API

### Backend
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Web Scraping**: playwright
- **AI Integration**: OpenAI API
- **Task Scheduling**: Node-cron
- **Authentication**: JWT

---

## Installation and Setup

### Prerequisites
- **Node.js**: Install the latest version from [Node.js](https://nodejs.org/).
- **PostgreSQL**: Ensure PostgreSQL is installed and running.

### Steps

1. **Clone the Repository**
   ```bash
   git clone <YOUR_GIT_URL>
   cd job-ai-scout
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**
   Create a `.env` file in the root directory and configure the following:
   ```env
   PORT=5000

:5432/job-ai-scout-db
   JWT_SECRET=<your-jwt-secret>
   ```

4. **Run the Backend**
   ```bash
   npm run dev
   ```

5. **Run the Frontend**
   Navigate to the frontend directory and start the development server:
   ```bash
   cd frontend
   npm run dev
   ```

---

## API Endpoints

### Authentication
- **POST** `/api/auth/login`: User login
- **POST** `/api/auth/register`: User registration

### Customers
- **GET** `/api/customer`: Fetch all customers
- **POST** `/api/customer`: Add a new customer
- **DELETE** `/api/customer/:id`: Delete a customer

### Companies
- **GET** `/api/company`: Fetch all companies
- **POST** `/api/company`: Add a new company
- **DELETE** `/api/company/:id`: Delete a company

---

### Custom Domain
To connect a custom domain:
1. Navigate to **Project > Settings > Domains**.
2. Click **Connect Domain** and follow the instructions.

---

## Contributing

We welcome contributions! To contribute:
1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request with a detailed description of your changes.

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Acknowledgments

- **OpenAI**: For providing the GPT-4 API.
- **Puppeteer**: For enabling seamless web scraping.
- **Tailwind CSS**: For modern and responsive UI design.

---

This README provides a professional overview of the project, making it easy for developers and stakeholders to understand its purpose, features, and setup process.