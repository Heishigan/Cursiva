# Cursiva

**Project Sentinel: The Agentic Job Hunter**

Cursiva is an autonomous, agentic system designed to tailor resumes and cover letters with precision. It utilizes an Actor-Critic architecture to enforce strict quality and stylistic rules, preventing "AI speak" and hallucinations, to produce pristine, human-sounding job applications.

## Architecture
- **Frontend**: Next.js App Router (React)
- **Backend**: FastAPI & LangGraph
- **Infrastructure**: Google Cloud Platform (GCP)
- **Compilation**: Dockerized LaTeX

## Getting Started

### Frontend
```bash
cd frontend
npm run dev
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
