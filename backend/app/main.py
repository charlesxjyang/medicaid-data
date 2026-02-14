"""FastAPI application for Medicaid Provider Spending Dashboard."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from .routers import stats, providers, procedures, map_routes

app = FastAPI(title="Medicaid Provider Spending API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://medicaid-dashboard.vercel.app",
        os.environ.get("CORS_ORIGIN", ""),
    ],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(providers.router, prefix="/api/providers", tags=["providers"])
app.include_router(procedures.router, prefix="/api/procedures", tags=["procedures"])
app.include_router(map_routes.router, prefix="/api/map", tags=["map"])

# Serve the Arrow file as a static file if it exists
ARROW_DIR = os.environ.get("ARROW_DIR", "/Users/charl/Programming/medicaid/frontend/public/data")
if os.path.isdir(ARROW_DIR):
    app.mount("/data", StaticFiles(directory=ARROW_DIR), name="static-data")


@app.get("/api/health")
def health():
    return {"status": "ok"}
