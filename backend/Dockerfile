FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# uvx is handy if users want to run MCP servers like `uvx mcp-server-fetch`.
# Node + npx covers the @modelcontextprotocol/* stdio servers.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates build-essential nodejs npm \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
