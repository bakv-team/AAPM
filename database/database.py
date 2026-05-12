from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv
import os

load_dotenv()



# 1. Pegamos a URL do .env
DATABASE_URL = os.getenv("DATABASE_URL")

# 2. Criamos o Engine (O motor do SQLAlchemy)
# O engine não abre a conexão imediatamente, ele espera o primeiro comando.
# Adicionamos pool_pre_ping para evitar quedas de conexão com o Supabase.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600
)

# 3. Configuramos o Sessionmaker vinculado ao Engine (e não à conexão direta)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Definimos a Base para os modelos
class Base(DeclarativeBase):
    pass

# 5. Função para obter a sessão do banco (Dependency Injection)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# OPCIONAL: Se você realmente precisar de uma conexão "bruta" (psycopg2) 
# para algum caso específico, coloque dentro de uma função.
def get_raw_connection():
    import psycopg2
    # Removemos query strings (como ?prepared_statements=false) que o psycopg2 puro não entende
    clean_url = DATABASE_URL.split('?')[0]
    return psycopg2.connect(clean_url)