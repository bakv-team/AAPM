from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from database.controllers import auth_controller
from database.controllers import admin_controller
from database.controllers import produto_controller
from database.controllers import categoria_controller
from database.controllers import movimentacao_controller
from api.v1 import pvd
from database.database import get_db
from database.models.usuario import Usuario



from database.auth import get_usuario_logado, get_usuario_opcional

app = FastAPI(title="AAPM")

#Configura para renderizar os templates HTML
templates = Jinja2Templates(directory="database/templates")
dashboard_templates = Jinja2Templates(directory="apps/pvd/views")

app.mount("/apps", StaticFiles(directory="apps"), name="apps")
app.mount("/static", StaticFiles(directory="database/static"), name="static")

@app.middleware("http")
async def disable_apps_static_cache(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/apps/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

app.include_router(auth_controller.router)
app.include_router(admin_controller.router)
app.include_router(produto_controller.router)
app.include_router(categoria_controller.router)
app.include_router(movimentacao_controller.router)
app.include_router(pvd.router)


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
    
    return RedirectResponse(url="/dashboard", status_code=302)


@app.get("/dashboard", response_class=HTMLResponse)
def tela_dashboard(
    request: Request,
    usuario = Depends(get_usuario_logado),
    db: Session = Depends(get_db)
):
    usuarios = []
    if usuario.get("role") == "admin":
        usuarios = db.query(Usuario).order_by(Usuario.nome).all()

    return dashboard_templates.TemplateResponse(
        request,
        "dashboard.html",
        {
            "request": request,
            "usuario": usuario,
            "usuarios": usuarios,
        }
    )


@app.get("/pdv", response_class=HTMLResponse)
def tela_pdv(
    request: Request,
    usuario = Depends(get_usuario_logado),
):
    return dashboard_templates.TemplateResponse(
        request,
        "vendas.html",
        {
            "request": request,
            "usuario": usuario,
        }
    )


@app.get("/vendas", response_class=HTMLResponse)
def tela_vendas_redirect():
    return RedirectResponse(url="/pdv", status_code=302)
