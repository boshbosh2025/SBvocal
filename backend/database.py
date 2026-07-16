from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "mysql+pymysql://root:@localhost/speedybosh"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,       # vérifie la connexion avant chaque requête
    pool_recycle=3600         # recycle la connexion toutes les heures
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
