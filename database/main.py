from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from database.controllers import auth_controller
from database.controllers import admin_controller
from api.v1 import pvd
from database.database import get_db
from database.models.usuario import Usuario
from api.middleware import CSRF_COOKIE_NAME, csrf_token_for_request, set_csrf_cookie



from database.auth import get_usuario_logado, get_usuario_opcional, normalizar_permissoes

app = FastAPI(title="AAPM")

#Configura para renderizar os templates HTML
templates = Jinja2Templates(directory="database/templates")
dashboard_templates = Jinja2Templates(directory="apps/pvd/views")

app.mount("/apps", StaticFiles(directory="apps"), name="apps")
app.mount("/static", StaticFiles(directory="database/static"), name="static")

@app.middleware("http")
async def disable_apps_static_cache(request: Request, call_next):
    csrf_token = csrf_token_for_request(request)
    response = await call_next(request)
    if request.cookies.get("access_token") and not request.cookies.get(CSRF_COOKIE_NAME):
        set_csrf_cookie(response, csrf_token)
    if request.url.path.startswith("/apps/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

app.include_router(auth_controller.router)
app.include_router(admin_controller.router)
app.include_router(pvd.router)


@app.exception_handler(StarletteHTTPException)
async def tratar_rota_nao_encontrada(request: Request, exc: StarletteHTTPException):
    if exc.status_code != 404:
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)

    aceita_html = "text/html" in request.headers.get("accept", "")
    rota_interna = request.url.path.startswith(("/api/", "/apps/", "/static/"))
    mensagem = "Pagina nao encontrada. Voce foi direcionado para o login para iniciar novamente com seguranca."

    if rota_interna or not aceita_html:
        return JSONResponse({"detail": mensagem}, status_code=404)

    return templates.TemplateResponse(
        request,
        "login.html",
        {
            "request": request,
            "notfound_message": mensagem,
        },
        status_code=404,
    )


@app.get("/")
def tela_home(
    request: Request,
    usuario = Depends(get_usuario_opcional)
    ):

    #Usuario não Logado
    if usuario is None:
        return templates.TemplateResponse(
            request,
            "login.html",
            {"request": request})
    
    destino = "/dashboard" if usuario.get("role") == "admin" or normalizar_permissoes(usuario.get("permissoes")) else "/pdv"
    return RedirectResponse(url=destino, status_code=302)


@app.get("/dashboard", response_class=HTMLResponse)
def tela_dashboard(
    request: Request,
    usuario = Depends(get_usuario_opcional),
    db: Session = Depends(get_db)
):
    if usuario is None:
        return RedirectResponse(url="/auth/login", status_code=302)

    if usuario.get("role") != "admin" and not normalizar_permissoes(usuario.get("permissoes")):
        return RedirectResponse(url="/pdv", status_code=302)

    usuarios = []
    if usuario.get("role") == "admin":
        usuarios = db.query(Usuario).order_by(Usuario.nome).all()

    return dashboard_templates.TemplateResponse(
        request,
        "dashboard.html",
        {
            "request": request,
            "usuario": usuario,
            "permissoes_usuario": normalizar_permissoes(usuario.get("permissoes")),
            "usuarios": usuarios,
            "csrf_token": csrf_token_for_request(request),
        }
    )


@app.get("/pdv", response_class=HTMLResponse)
def tela_pdv(
    request: Request,
    usuario = Depends(get_usuario_opcional),
):
    if usuario is None:
        return RedirectResponse(url="/auth/login", status_code=302)

    return dashboard_templates.TemplateResponse(
        request,
        "vendas.html",
        {
            "request": request,
            "usuario": usuario,
            "permissoes_usuario": normalizar_permissoes(usuario.get("permissoes")),
        }
    )


@app.get("/vendas", response_class=HTMLResponse)
def tela_vendas_redirect():
    return RedirectResponse(url="/pdv", status_code=302)
