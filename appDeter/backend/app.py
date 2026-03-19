
from fastapi import FastAPI, Request,HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from appDeter.backend.controllers import auth_controller, project_controller
from appDeter.backend.controllers.notes_controller import router as notes_router


def create_app() -> FastAPI:
    app = FastAPI()

    # Plantillas y estáticos
    templates = Jinja2Templates(directory="appDeter/Frontend/presentation/templates")
    app.mount("/static", StaticFiles(directory="appDeter/Frontend/presentation/static"), name="static")

    @app.get("/", response_class=HTMLResponse)
    async def root(request: Request):
        return templates.TemplateResponse("app.html", {"request": request})

    # Sesiones y CORS
    app.add_middleware(SessionMiddleware, secret_key="your_secret_key")
    app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8000",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:4200",
        "http://127.0.0.1:4201",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


    #  middleware de errores
    @app.middleware("http")
    async def error_handler(request: Request, call_next):
        try:
            return await call_next(request)
        except HTTPException as exc:
            # deja que FastAPI maneje sus HTTPException (400, 404, etc.)
            raise exc
        except RequestValidationError as rve:
            return JSONResponse(status_code=422, content={"detail": rve.errors()})
        except Exception:
            import traceback
            print("ERROR DETECTADO:\n", traceback.format_exc())
            return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    # Routers
    app.include_router(auth_controller.router)
    app.include_router(project_controller.router)

    return app

app = create_app()
app.include_router(notes_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)