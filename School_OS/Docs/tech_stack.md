Tech Stack Specification
Frontend
Primary Framework: React.js
Reasoning:
The designs from Stitch are in HTML, but converting them into React components allows for dynamic rendering, reusable UI components, and easier integration with APIs.
React + Tailwind CSS ensures clean, modern UI, responsive layouts, and fast iteration during development.
Supports component-based dashboards, which is crucial for multi-tenant SaaS architecture and the school/parent dashboards.
Styling: Tailwind CSS
Tailwind allows rapid styling based on existing Stitch designs.
All colors, spacing, and typography from the designs can be replicated faithfully.
Works perfectly with React components.
Optional: Plain HTML/CSS/JS can be used for static landing pages or early testing, but React is recommended for dashboards and interactive components.
Backend
Language & Framework: Python + Django
Django is used for API services, authentication, data models, and business logic.
Supports multi-tenant architecture with schema-per-tenant or row-level isolation.
Django ORM will initially use default SQLite for rapid testing and offline development.
Database (initial development): SQLite (Django default)
Lightweight, file-based, works offline.
Perfect for rapid iteration and testing of core functionality.
Database (production/final deployment): PostgreSQL
Recommended for scaling, multi-tenant isolation, concurrent connections, and robust queries.
Can be hosted on cloud providers such as AWS RDS, Heroku Postgres, or Firebase if needed.
APIs & Integration
Django REST Framework (DRF) for API endpoints.
JSON-based communication between React frontend and Django backend.
Authentication via JWT tokens for multi-tenant parent/teacher/admin access.
Other Tools
Version Control: Git + GitHub/GitLab
Task Automation & Deployment: Docker (optional), CI/CD pipelines (GitHub Actions or GitLab CI)
Data Interoperability: XML/XSD for ministry compliance, ISO/IEC 11179 data standards.
Optional Cloud Hosting: Firebase (for static hosting or database sync), AWS or Azure for full-scale deployment.
Recommendation
Start with React + Tailwind for dashboards to match Stitch designs faithfully.
Use SQLite with Django ORM for development/testing.
Extract HTML from Stitch designs into React components, preserving styles and layout.
Later, transition to PostgreSQL for production, keeping API and ORM code compatible.

Summary:

Layer	Tech / Framework	Notes
Frontend	React.js + Tailwind CSS	Interactive dashboards, reusable components
Backend	Python + Django	Business logic, multi-tenant management
API	Django REST Framework	JSON endpoints, JWT auth
Database (dev)	SQLite	Fast testing & offline development
Database (prod)	PostgreSQL	Cloud-ready, scalable
Version Control	Git + GitHub/GitLab	Collaboration & versioning
Deployment	Docker / CI-CD	Streamlined deployment, optional
Data Standards	ISO/IEC 11179, XML	Ministry compliance, interoperability

