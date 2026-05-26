# Popular o banco de dados com usuários admin

from database.database import SessionLocal
from database.models.usuario import Usuario
from database.auth import hash_senha

USUARIOS = [
    {
        "nome": "Admin Legal",
        "email": "admin@teste.com",
        "senha_hash": "admin123",
        "role": "admin",
        "ativo": True
    },
]

def criar_usuario():
    db = SessionLocal()
    try:
        for user in USUARIOS:
            existente = db.query(Usuario).filter_by(email=user["email"]).first()
            if existente:
                print(f"Esse e-mail {user["email"]} já está cadastrado no db")
                continue
            novo_usuario = Usuario(
                nome=user["nome"],
                email=user["email"],
                senha_hash=hash_senha(user["senha_hash"]),
                role=user["role"],
                ativo=user["ativo"],
            )
            db.add(novo_usuario)
            print(f"Usuário {user['email']} cadastrado com sucesso")
        db.commit()
    except Exception as error:
        db.rollback()
        print(f"Erro: {error}")
    
    finally:
        db.close()

criar_usuario()