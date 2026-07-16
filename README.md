# Cursiva

Cursiva is an open-source, multi-agent AI job application pipeline. It acts as an autonomous executive assistant that deeply researches job descriptions, strategizes your angle, tailors your resume, and natively compiles flawless "Jake's Resume" LaTeX PDFs.

## Architecture
- **Backend**: FastAPI running a LangGraph multi-agent team (Requirements Extractor, Job Fit Strategist, Resume Tailor, Quality Reviewer, Cover Letter Writer) and a native `pdflatex` compilation engine.
- **Frontend**: Next.js (App Router) featuring an interactive Agent Workflow UI, Markdown/LaTeX diff editors, and a central CRM dashboard for all your applications.
- **Auth**: Clerk integration.
- **DB**: SQLAlchemy with SQLite (easily portable to PostgreSQL).

## Getting Started

### Prerequisites
1. Python 3.10+
2. Node.js 18+
3. A native LaTeX distribution installed on your system (e.g., `texlive` or `miktex`).
4. An OpenAI API Key (Users bring their own key in the UI settings).
5. Clerk API Keys.

### 1. Setup Backend
```bash
cd backend
python -m venv .venv
# Activate the virtual environment
# Windows: .\.venv\Scripts\Activate.ps1
# Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Setup Frontend
```bash
cd frontend
npm install
```
Create a `.env.local` file in `frontend/` with your Clerk credentials:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

### 3. Run the Servers
Terminal 1 (Backend):
```bash
cd backend
uvicorn main:app --reload --port 8000
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000` to start strategizing!

## License
This project is licensed under the MIT License. See the `LICENSE` file for details.
