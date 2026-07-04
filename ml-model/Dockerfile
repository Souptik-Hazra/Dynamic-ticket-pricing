# Use a specific Python version
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Expose port (5000 is default for flask in this project)
EXPOSE 5000

# Run as non-privileged user for security
RUN useradd -m mluser && chown -R mluser /app
USER mluser

# Health check
HEALTHCHECK --interval=30s --timeout=5s \
  CMD curl --fail http://localhost:5000/health || exit 1

# Use Gunicorn as production-grade server with resource-conscious worker lifecycle
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "--max-requests", "1000", "--max-requests-jitter", "50", "app:create_app()"]
