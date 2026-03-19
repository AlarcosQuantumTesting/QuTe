# appDeter/Backend/data/database.py
import os
import httpx
from fastapi import HTTPException

SPRING_BASE_URL = os.getenv("SPRING_BASE_URL", "https://alarcosj.esi.uclm.es/qsauronback")

async def spring_request(method: str, path: str, **kwargs):
    url = f"{SPRING_BASE_URL}{path}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.request(method, url, **kwargs)

            # Propaga errores HTTP del Spring
            if r.status_code >= 400:
                raise HTTPException(status_code=r.status_code, detail=r.text)

            ctype = r.headers.get("content-type", "")
            if ctype.startswith("application/json"):
                return r.json()
            return r.text

    except HTTPException:
        raise
    except httpx.RequestError as e:
        # Errores de conexión/timeout/DNS
        raise HTTPException(status_code=502, detail=f"Spring unreachable: {e}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Unexpected error: {e}")