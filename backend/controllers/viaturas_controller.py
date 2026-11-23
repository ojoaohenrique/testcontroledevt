from decimal import Decimal

from flask import Blueprint, jsonify, request

from backend.models.base import SessionLocal
from backend.services.auth_service import AuthError, get_current_user_id
from backend.services.viatura_service import listar_viaturas_ativas, registrar_saida, registrar_volta

viaturas_bp = Blueprint("viaturas", __name__)


@viaturas_bp.route("/viaturas", methods=["GET"])
def listar_viaturas():
    try:
        get_current_user_id(request)
    except AuthError as exc:
        return jsonify({"error": str(exc)}), 401
    db = SessionLocal()
    try:
        viaturas = listar_viaturas_ativas(db)
        payload = [
            {
                "id": str(v.id),
                "prefixo": v.prefixo,
                "modelo": v.modelo,
                "ativo": bool(v.ativo),
            }
            for v in viaturas
        ]
        return jsonify(payload), 200
    finally:
        db.close()


@viaturas_bp.route("/saida", methods=["POST"])
def nova_saida():
    db = SessionLocal()
    try:
        try:
            user_id = get_current_user_id(request)
        except AuthError as exc:
            return jsonify({"error": str(exc)}), 401

        body = request.get_json(force=True) or {}
        required_fields = ["viatura_id", "motorista", "patrulheiro", "inspetor", "km_saida"]
        if any(f not in body for f in required_fields):
            return jsonify({"error": "Campos obrigatórios ausentes na saída de viatura."}), 400

        saida = registrar_saida(
            db,
            viatura_id=body["viatura_id"],
            motorista=body["motorista"],
            patrulheiro=body["patrulheiro"],
            inspetor=body["inspetor"],
            km_saida=Decimal(str(body["km_saida"])),
            protocolo=body.get("protocolo"),
            observacoes=body.get("observacoes"),
            usuario_id=user_id,
        )

        return (
            jsonify(
                {
                    "id": str(saida.id),
                    "viatura_id": str(saida.viatura_id),
                    "motorista": saida.motorista,
                    "patrulheiro": saida.patrulheiro,
                    "inspetor": saida.inspetor,
                    "km_saida": float(saida.km_saida),
                    "data_saida": saida.data_saida.isoformat(),
                    "km_chegada": float(saida.km_chegada) if saida.km_chegada is not None else None,
                    "km_rodado": float(saida.km_rodado) if saida.km_rodado is not None else None,
                    "protocolo": saida.protocolo,
                    "observacoes": saida.observacoes,
                    "usuario_id": str(saida.usuario_id),
                }
            ),
            201,
        )
    except Exception as exc:  # pragma: no cover - proteção genérica
        db.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        db.close()


@viaturas_bp.route("/volta", methods=["POST"])
def registrar_retorno():
    db = SessionLocal()
    try:
        try:
            _ = get_current_user_id(request)
        except AuthError as exc:
            return jsonify({"error": str(exc)}), 401

        body = request.get_json(force=True) or {}
        if "id" not in body or "km_chegada" not in body:
            return jsonify({"error": "Campos 'id' e 'km_chegada' são obrigatórios."}), 400

        try:
            saida = registrar_volta(
                db,
                saida_id=body["id"],
                km_chegada=Decimal(str(body["km_chegada"])),
                observacoes=body.get("observacoes"),
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        return (
            jsonify(
                {
                    "id": str(saida.id),
                    "km_chegada": float(saida.km_chegada),
                    "km_rodado": float(saida.km_rodado),
                    "observacoes": saida.observacoes,
                }
            ),
            200,
        )
    except Exception as exc:  # pragma: no cover
        db.rollback()
        return jsonify({"error": str(exc)}), 500
    finally:
        db.close()

