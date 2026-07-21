# Contributing to Cursiva

Welcome to the mainframe. If you want to push code to Cursiva, you are in the right place. We are building the next generation of autonomous career agents.

## Stack Overview
* **Frontend:** Next.js (App Router), React, CSS Modules
* **Backend:** FastAPI (Python), SQLAlchemy, LangChain
* **Auth:** Clerk
* **Database:** SQLite (local) / PostgreSQL (production)

## Getting Your Environment Spun Up

### 1. Clone the Repo
Pull down the code to your local rig.
```bash
git clone https://github.com/Heishigan/Cursiva.git
cd Cursiva
```

### 2. Backend Setup
We run a fast, async Python backend.
```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate
# On Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
```
Copy `.env.example` to `.env` and plug in your API keys (OpenAI, Clerk, etc).

Initialize the database using Alembic:
```bash
alembic upgrade head
```

Boot the server:
```bash
uvicorn main:app --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```
Copy `.env.example` to `.env.local` and add your Clerk public keys.

Run the dev server:
```bash
npm run dev
```

## Pull Request Protocol

1. **Fork and Branch:** Never push straight to `main`. Create a feature branch (`feat/your-feature` or `bug/your-fix`).
2. **Write Clean Code:** No sloppy hacks unless it's a brilliant zero-day exploit patch. Keep your code modular.
3. **Commit Messages:** Keep them clear and imperative ("fix: auth token rotation", not "fixed the thing").
4. **Submit PR:** Point your fork to our `main` branch. Describe exactly what you did.

We review PRs fast. Let's build something epic.
