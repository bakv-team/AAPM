from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse

from database.controllers import auth_controller
from database.controllers import admin_controller
from database.controllers import produto_controller



from database.auth import get_usuario_opcional

app = FastAPI(title="AAPM")

#Configura para renderizar os templates HTML
templates = Jinja2Templates(directory="database/templates")

app.include_router(auth_controller.router)
app.include_router(admin_controller.router)
app.include_router(produto_controller.router)


@app.get("/")
def tela_home(
    request: Request,
    usuario = Depends(get_usuario_opcional)
    ):

    #Usuario não Logado
    if usuario is None:
        return templates.TemplateResponse(
            request,
            "index.html",
            {"request": request})
    
    return templates.TemplateResponse(
        request,
        "home.html",
        {"request": request, "usuario": usuario})