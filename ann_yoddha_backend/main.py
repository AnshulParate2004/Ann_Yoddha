"""Compatibility entrypoint that runs the real FastAPI app."""
import os
from app.main import app

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    # Render requires binding to $PORT and reload=True can cause performance issues in production
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)
