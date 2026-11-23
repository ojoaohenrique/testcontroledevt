from flask import Blueprint, jsonify, request

from backend.services.auth_service import AuthError, get_current_user_id
from backend.supabase_client import get_supabase_client

# Blueprint dedicado à rota de inspetores
inspetores_bp = Blueprint("inspetores", __name__)

# Somente estes campos podem ser gravados pela API
CAMPOS_PERMITIDOS = {"nome", "matricula", "turno"}


def listar_inspetores():
    """
    Busca todos os registros da tabela 'inspetores' no Supabase.
    Retorna a lista de registros como uma lista de dicionários.
    """
    supabase = get_supabase_client()
    response = supabase.table("inspetores").select("*").execute()
    return response.data or []


def adicionar_inspetor(data):
    """
    Insere um novo registro na tabela 'inspetores'.
    Espera um dicionário com os campos compatíveis com a tabela.
    """
    supabase = get_supabase_client()
    response = supabase.table("inspetores").insert(data).execute()
    if response.data:
        return response.data[0]
    return None


@inspetores_bp.route("/inspetores", methods=["GET"])
def get_inspetores():
    """
    GET /inspetores
    Lista todos os inspetores cadastrados (exige login).
    """
    try:
        get_current_user_id(request)
    except AuthError:
        return jsonify({"error": "Não autorizado."}), 401
    try:
        return jsonify(listar_inspetores()), 200
    except Exception:
        return jsonify({"error": "Erro interno."}), 500


@inspetores_bp.route("/inspetores", methods=["POST"])
def post_inspetor():
    """
    POST /inspetores  (exige login)
    Exemplo de corpo JSON:
    {
      "nome": "INSP MAIK",
      "matricula": "123",
      "turno": "Diurno"
    }
    """
    try:
        get_current_user_id(request)
    except AuthError:
        return jsonify({"error": "Não autorizado."}), 401
    try:
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Corpo inválido."}), 400

        dados = {
            k: str(v).strip()[:120]
            for k, v in payload.items()
            if k in CAMPOS_PERMITIDOS and v is not None
        }
        if not dados.get("nome"):
            return jsonify({"error": "Campo 'nome' é obrigatório."}), 400

        return jsonify(adicionar_inspetor(dados)), 201
    except Exception:
        return jsonify({"error": "Erro interno."}), 500
