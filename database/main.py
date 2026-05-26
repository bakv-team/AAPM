from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse


from database.auth import get_usuario_opcional

app = FastAPI(title="AAPM")

#Configura para renderizar os templates HTML
templates = Jinja2Templates(directory="app/templates")

@app.get("/")
def tela_home(
    request: Request, 
    usuario: dict = Depends(get_usuario_opcional)
):

    #Usuario não Logado
    if usuario is None:
        return templates.TemplateResponse(
            request,
            {"request": request})
    
    return templates.TemplateResponse(
        request,
        {"request": request, "usuario": usuario})