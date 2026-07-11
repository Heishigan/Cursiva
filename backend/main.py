from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Cursiva API", description="Backend engine for the Cursiva Agentic Job Hunter")

@app.get("/")
def read_root():
    return {"message": "Welcome to the Cursiva API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
