FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies, specifically LaTeX
# We use --no-install-recommends to keep the image size down
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
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend application
COPY . .

# Create a directory for outputs/logs if needed
RUN mkdir -p /app/outputs

# Expose the FastAPI port
EXPOSE 8000

# Run uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
