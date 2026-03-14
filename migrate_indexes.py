"""
migrate_indexes.py — RL Trader V4
Cria os índices de banco de dados definidos em database/models.py.
Execute UMA VEZ após o update_vps.bat quando os índices foram adicionados.

Uso:
    python migrate_indexes.py
"""

import sys
import os

# Garante que o path do projeto está no PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 55)
print("  RL TRADER — Migração de Índices do Banco de Dados")
print("=" * 55)

try:
    from src.infrastructure.config import settings
    from src.infrastructure.database.models import Base

    # Monta a URL do banco — tenta MySQL primeiro, cai no SQLite
    db_url = None

    if settings.DB_HOST and settings.DB_NAME:
        db_url = (
            f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}"
            f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
        )
        print(f"\n[DB] Usando MySQL: {settings.DB_HOST}/{settings.DB_NAME}")
    else:
        db_url = f"sqlite:///{settings.SQLITE_PATH}"
        print(f"\n[DB] Usando SQLite: {settings.SQLITE_PATH}")

    from sqlalchemy import create_engine, text, inspect

    engine = create_engine(db_url, echo=False)

    print("\n[1/2] Verificando tabelas existentes...")
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    print(f"      Tabelas encontradas: {existing_tables}")

    print("\n[2/2] Criando índices (se ainda não existem)...")
    # create_all só cria o que não existe — não destrói dados
    Base.metadata.create_all(engine, checkfirst=True)

    # Verifica os índices criados
    for table_name in ['trades', 'audit_events']:
        if table_name in existing_tables:
            indexes = inspector.get_indexes(table_name)
            idx_names = [i['name'] for i in indexes]
            print(f"      [{table_name}] Índices: {idx_names}")

    print("\n✅ Migração concluída com sucesso!")
    print("   Os índices foram criados ou já existiam.")
    print("=" * 55)

except ImportError as e:
    print(f"\n❌ Erro de import: {e}")
    print("   Execute este script a partir da raiz do projeto RL TRADER V4_VPS.")
    sys.exit(1)
except Exception as e:
    print(f"\n❌ Erro durante a migração: {e}")
    print("   Verifique as credenciais do banco no arquivo .env")
    sys.exit(1)
