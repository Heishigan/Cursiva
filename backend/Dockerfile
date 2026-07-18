FROM python:3.11-slim

# ── Environment ───────────────────────────────────────────────────────────────
# PYTHONUNBUFFERED: stream logs directly to stdout (no internal buffer) so
#   Cloud Run / Cloud Logging captures every log line in real time.
# PYTHONDONTWRITEBYTECODE: skip .pyc files — saves disk space in the container.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# ── System dependencies (LaTeX + fonts) ──────────────────────────────────────
# Install in a single layer and clean up apt cache in the same RUN to minimise
# image size. --no-install-recommends avoids pulling in unnecessary packages.
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-xetex \
    fonts-lato \
    fonts-liberation \
    fonts-roboto \
    lmodern \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ───────────────────────────────────────────────────────
# Copy requirements first so Docker can cache this layer independently of the
# application code. Only re-runs pip install when requirements.txt changes.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── Application code ──────────────────────────────────────────────────────────
COPY . .

# ── Non-root user (security best practice) ───────────────────────────────────
# Running as root inside a container is a security risk. Create a dedicated
# user with no login shell and switch to it before starting the server.
RUN addgroup --system appgroup && \
    adduser --system --ingroup appgroup --no-create-home appuser && \
    mkdir -p /app/outputs && \
    chown -R appuser:appgroup /app

USER appuser

# ── Health check ─────────────────────────────────────────────────────────────
# Docker / Cloud Run will mark the container unhealthy if this fails, enabling
# automatic restarts and preventing bad deploys from receiving traffic.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl --fail http://localhost:8000/ || exit 1

EXPOSE 8000

# ── Entrypoint ───────────────────────────────────────────────────────────────
# workers=1 is correct for Cloud Run — scale-out is handled by spinning up
# additional container instances, not threads within one container.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
