import os
from functools import lru_cache
from typing import Optional

from flask import Request
from supabase import Client, create_client


class AuthError(Exception):
    """Erro genérico de autenticação."""

@lru_cache(maxsize=1)
def _get_auth_client() -> Client:
    """
    Cria uma instância única do cliente Supabase para autenticação.
    O uso de lru_cache evita a criação de um novo cliente em cada request.
    """
    # Remove variáveis de proxy que causam erro em versões instáveis do supabase-py
    for env_var in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]:
        if env_var in os.environ:
            del os.environ[env_var]

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not key:
        raise AuthError("SUPABASE_URL ou SUPABASE_ANON_KEY não configurado.")
    return create_client(url, key)


def _get_bearer_token(request: Request) -> str:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        raise AuthError("Cabeçalho Authorization ausente ou inválido.")
    return header.split(" ", 1)[1]


def get_current_user_id(request: Request) -> str:
    """
    Extrai e valida o token do Supabase e retorna o user_id (UUID como string).
    Usa o endpoint de verificação do próprio Supabase.
    """
    token = _get_bearer_token(request)
    try:
        supabase = _get_auth_client()
        response = supabase.auth.get_user(token)
        user = response.user
        if not user or not user.id:
            raise AuthError("Usuário não identificado no token.")
        return user.id
    except Exception as exc:
        raise AuthError("Token inválido ou expirado.") from exc
