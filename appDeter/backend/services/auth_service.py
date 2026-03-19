import requests
from fastapi import HTTPException

JAVA_BASE_URL = "https://alarcosj.esi.uclm.es/qsauronback/users"


class AuthService:
    @staticmethod
    def register(email: str, password: str) -> None:
        """
        Registro de usuario a través del backend Java:
        POST http://localhost:8080/users/create
        """
        payload = {
            "email": email,
            "pwd": password   # Java / Alaride esperan "pwd"
        }

        try:
            resp = requests.post(f"{JAVA_BASE_URL}/create", json=payload, timeout=5)
        except requests.RequestException as e:
            raise HTTPException(
                status_code=502,
                detail=f"No se pudo contactar con el backend Java en /users/create: {e}"
            )

        if resp.status_code == 409:
            raise HTTPException(status_code=400, detail="Email ya registrado.")

        if resp.status_code >= 400:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Error al registrar usuario en backend Java "
                    f"(status {resp.status_code}, body: {resp.text})"
                )
            )
        # Si llega aquí, Java ha creado el usuario correctamente (void)

    @staticmethod
    def login(email: str, password: str) -> dict:
        """
        Login a través del backend Java:
        POST http://localhost:8080/users/login
        """
        payload = {
            "email": email,
            "pwd": password
        }

        try:
            resp = requests.post(f"{JAVA_BASE_URL}/login", json=payload, timeout=5)
        except requests.RequestException as e:
            raise HTTPException(
                status_code=502,
                detail=f"No se pudo contactar con el backend Java en /users/login: {e}"
            )

        if resp.status_code == 403:
            raise HTTPException(status_code=401, detail="Email o contraseña incorrectos.")

        if resp.status_code >= 400:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Error al hacer login en backend Java "
                    f"(status {resp.status_code}, body: {resp.text})"
                )
            )

        token = resp.text.strip()
        if not token:
            raise HTTPException(
                status_code=500,
                detail="Backend Java devolvió un token vacío."
            )

        return {"token": token}

    @staticmethod
    def get_user_email_from_token(token: str) -> str:
        payload = {"token": token}

        try:
            resp = requests.post(f"{JAVA_BASE_URL}/getUser", json=payload, timeout=5)
        except requests.RequestException as e:
            raise HTTPException(
                status_code=502,
                detail=f"No se pudo contactar con el backend Java en /users/getUser: {e}"
            )

        if resp.status_code == 403:
            raise HTTPException(status_code=401, detail="Token inválido.")

        if resp.status_code >= 400:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Error al obtener email desde backend Java "
                    f"(status {resp.status_code}, body: {resp.text})"
                )
            )

        email = resp.text.strip()
        if not email:
            raise HTTPException(
                status_code=500,
                detail="Backend Java devolvió un email vacío."
            )

        return email
