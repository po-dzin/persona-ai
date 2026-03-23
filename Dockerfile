FROM python:3.12-slim

# Install Node.js 20
RUN apt-get update && apt-get install -y curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Build React frontend -> apps/web/dist/
RUN cd apps/web && npm ci && npm run build

# Install Python dependencies
RUN pip install --no-cache-dir -r apps/api/requirements.txt

EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --app-dir apps/api
