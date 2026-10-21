import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import init_db_pool, query_one
from routes import auth, teams, tournaments, matches, meta

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db_pool()
    yield

app = FastAPI(
    title="ArenaX – Automated Tournament & Matchmaking Engine",
    description="High-performance, 3NF-normalized Tournament & Matchmaking REST API",
    version="1.0.0",
    lifespan=lifespan
)

# Standardized Error Envelope matching frontend api.js expectations
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict):
        code = exc.detail.get("code", "ERROR")
        msg = exc.detail.get("message", "Request failed")
        fields = exc.detail.get("fields")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {"code": code, "message": msg, "fields": fields},
                "detail": msg
            }
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {"code": "ERROR", "message": str(exc.detail)},
            "detail": str(exc.detail)
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    fields = {}
    print(f"Validation Error payload: {await request.body()} errors: {errors}")
    for err in errors:
        loc = err.get("loc", [])
        field_name = loc[-1] if loc else "general"
        fields[str(field_name)] = err.get("msg", "Invalid value")
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Please fix the highlighted fields.",
                "fields": fields
            },
            "detail": "Validation error"
        }
    )

# CORS Middleware (supports separate static servers like port 5500, Vite, live-server, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def debug_auth_middleware(request: Request, call_next):
    auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
    response = await call_next(request)
    path = request.url.path.lower()
    if any(path.endswith(ext) for ext in [".js", ".html", ".css"]) or path in ["/", ""]:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        if "etag" in response.headers:
            del response.headers["etag"]
        if "last-modified" in response.headers:
            del response.headers["last-modified"]
    if request.url.path.startswith("/api"):
        print(f"[AUTH-DEBUG] {request.method} {request.url.path} status={response.status_code} auth_header={auth_header[:35] if auth_header else 'NONE'}")
    return response

# Register API Routers
app.include_router(auth.router)
app.include_router(teams.router)
app.include_router(tournaments.router)
app.include_router(matches.router)
app.include_router(meta.router)

@app.get("/api/health")
def health_check():
    try:
        res = query_one("SELECT 1 AS ok")
        db_status = "Connected" if res and res.get("ok") == 1 else "Disconnected"
    except Exception as e:
        db_status = f"Error: {str(e)}"
    return {
        "status": "healthy",
        "database": db_status
    }

# Mount Frontend static directory for direct browsing on http://localhost:8000
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
