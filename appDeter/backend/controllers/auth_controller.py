from fastapi import APIRouter, Form, Request, status, HTTPException
from fastapi.responses import JSONResponse
from ..services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register(
    email: str = Form(...),
    password: str = Form(...)
):
    # Llamamos al backend Java a través del AuthService
    AuthService.register(email, password)
    return JSONResponse(
        {"message": "Register success"},
        status_code=status.HTTP_201_CREATED
    )



@router.post("/login")
async def login(request: Request, email: str = Form(...), password: str = Form(...)):
    login_data = AuthService.login(email, password)
    token = login_data["token"]

    try:
        email_from_token = AuthService.get_user_email_from_token(token)
    except HTTPException:
        email_from_token = email

    # si usas session middleware, puedes mantenerlo, pero NO sustituye a la cookie que Spring exige
    request.session["user_email"] = email_from_token
    request.session["token"] = token

    resp = JSONResponse(
        {"logged_in": True, "message": "Login successful.", "token": token},
        status_code=status.HTTP_200_OK
    )

    # ESTA ES LA CLAVE
    resp.set_cookie(
        key="SESSION_TOKEN",
        value=token,
        httponly=True,      
        samesite="lax",     
        secure=False,       
        path="/"
    )
    return resp