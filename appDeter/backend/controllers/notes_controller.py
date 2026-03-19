# appDeter/Backend/controllers/notes_controller.py
import asyncio

from fastapi import APIRouter, HTTPException, Query, Body, Request
from pydantic import BaseModel
from typing import Optional

from appDeter.backend.controllers.helpers_controller import get_session_cookie_or_401, spring_to_projectindb
from ..data.database import spring_request

router = APIRouter(prefix="/notes", tags=["notes"])


class NoteCreate(BaseModel):
    project_id: str
    user_email: str
    title: str = ""
    text: str = ""
    type: Optional[str] = "general"


class NoteUpdate(BaseModel):
    project_id: str
    user_email: str
    title: Optional[str] = None
    text: Optional[str] = None
    type: Optional[str] = None


    # ------------------------------
    # Extrae la cookie de sesión (SESSION_TOKEN) desde la request.
    # Si no existe, corta el flujo devolviendo 401 para forzar autenticación.
    # ------------------------------
def _session_cookie_or_401(request: Request) -> str:
    session = request.cookies.get("SESSION_TOKEN")
    if not session:
        raise HTTPException(status_code=401, detail="Missing SESSION_TOKEN cookie")
    return session

    # ------------------------------
    # Helper async para traer las notas de un proyecto desde Spring.
    # Hace una llamada a /notes/list enviando email + projectId y la cookie de sesión.
    # Normaliza la respuesta a lista (si Spring devuelve otra cosa, retorna []).
    # Si falla por cualquier excepción, devuelve [] para no romper el listado de proyectos.
    # ------------------------------
async def _fetch_notes_for_project(project_id: str, email: str, session: str):
    
    try:
        notes = await spring_request(
            "POST",
            "/notes/list",
            json={"email": email, "projectId": project_id},
            cookies={"SESSION_TOKEN": session},
        )
        return notes if isinstance(notes, list) else []
    except Exception:
        return []
    
    # ------------------------------
    # Endpoint GET /notes/
    # Lista proyectos del usuario consultando a Spring (/projects/getAllByUser).
    # Normaliza la respuesta a lista y adapta cada proyecto al formato del frontend
    # usando spring_to_projectindb.
    # Después enriquece cada proyecto con sus notas: hace N requests concurrentes
    # a /notes/list (una por proyecto) y añade pr["notes"] con el resultado.
    # Devuelve la lista de proyectos ya convertidos + notas.
    # ------------------------------
@router.get("/")
async def list_projects(request: Request, user_email: str = Query(...)):
    session = get_session_cookie_or_401(request)

    spring_projects = await spring_request(
        "POST",
        "/projects/getAllByUser",
        json={"email": user_email},
        cookies={"SESSION_TOKEN": session},
    )

    # 2) normaliza a lista
    arr = spring_projects if isinstance(spring_projects, list) else (spring_projects.get("projects") or [])
    if not isinstance(arr, list):
        arr = []

    # 3) convierte Spring->frontend (tu mapper)
    converted = []
    for p in arr:
        converted.append(spring_to_projectindb(p, fallback_email=user_email))

    # 4) ENRIQUECE con notas (solo FastAPI)
    #    Nota: aquí usamos project["name"] como projectId (en tu sistema name==id)
    tasks = [
        _fetch_notes_for_project(pr.get("name"), user_email, session)
        for pr in converted
    ]
    notes_lists = await asyncio.gather(*tasks)

    for pr, notes in zip(converted, notes_lists):
        pr["notes"] = notes

    return converted

    # ------------------------------
    # Endpoint POST /notes/
    # Crea una nota en Spring (/notes/create).
    # Construye el body con email + projectId y asegura defaults:
    # title/text nunca None y type por defecto "general".
    # Reenvía la cookie SESSION_TOKEN para que Spring autentique la operación.
    # Devuelve tal cual la respuesta de Spring.
    # ------------------------------
@router.post("/")
async def create_note(request: Request, payload: NoteCreate):
    session = _session_cookie_or_401(request)

    body = {
        "email": payload.user_email,
        "projectId": payload.project_id,
        "title": payload.title or "",
        "text": payload.text or "",
        "type": payload.type or "general",
    }

    return await spring_request(
        "POST",
        "/notes/create",
        json=body,
        cookies={"SESSION_TOKEN": session},
    )

    # ------------------------------
    # Endpoint PUT /notes/{note_id}
    # Actualiza una nota existente en Spring (/notes/{note_id}).
    # Siempre manda email + projectId (para autorización/validación en Spring),
    # y solo incluye los campos que vengan en payload (title/text/type) para permitir
    # updates parciales sin pisar valores con None.
    # Reenvía la cookie SESSION_TOKEN.
    # Devuelve la respuesta de Spring.
    # ------------------------------
@router.put("/{note_id}")
async def update_note(request: Request, note_id: str, payload: NoteUpdate):
    session = _session_cookie_or_401(request)

    body = {"email": payload.user_email, "projectId": payload.project_id}
    if payload.title is not None:
        body["title"] = payload.title
    if payload.text is not None:
        body["text"] = payload.text
    if payload.type is not None:
        body["type"] = payload.type

    return await spring_request(
        "PUT",
        f"/notes/{note_id}",
        json=body,
        cookies={"SESSION_TOKEN": session},
    )

    # ------------------------------
    # Endpoint DELETE /notes/{note_id}
    # Borra una nota en Spring (/notes/{note_id}).
    # Spring (según tu backend) espera BODY incluso en DELETE, por eso se manda
    # json con email + projectId además de la ruta con note_id.
    # project_id y user_email vienen por query params.
    # Reenvía la cookie SESSION_TOKEN y devuelve la respuesta de Spring.
    # ------------------------------
@router.delete("/{note_id}")
async def delete_note(
    request: Request,
    note_id: str,
    project_id: str = Query(...),
    user_email: str = Query(...),
):
    session = _session_cookie_or_401(request)

    # Spring espera BODY en DELETE
    return await spring_request(
        "DELETE",
        f"/notes/{note_id}",
        json={"email": user_email, "projectId": project_id},
        cookies={"SESSION_TOKEN": session},
    )
