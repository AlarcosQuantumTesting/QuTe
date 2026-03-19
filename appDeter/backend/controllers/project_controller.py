# appDeter/Backend/controllers/projects_controller.py
import json
import traceback
from typing import List, Optional
from fastapi import APIRouter, Body, HTTPException, Request, UploadFile, File, Form, Query, status
from fastapi.responses import JSONResponse

from appDeter.backend.services.ProjectServices.ProjectServiceDeter import ProjectServiceDeter
from appDeter.backend.services.ProjectServices.ProjectServiceStoch import ProjectServiceStoch
from appDeter.backend.models.table_model import TableConfig
from appDeter.backend.services.table_services import build_table
from appDeter.backend.services.ProjectServices.Project_service import ProjectService

from ..data.database import spring_request

# helpers 
from .helpers_controller import (
    get_session_cookie_or_401,
    legacy_cutcfg_to_testSuites,
    spring_to_projectindb,
    _derive_mode_from_testSuites,
)

router = APIRouter(prefix="/projects", tags=["projects"])

# ------------------------------
#Aqui se guarda el poryecto completo lo que viene siendo la parte de qprogram pertenenciente a Qute
# ------------------------------
@router.post("/save_full")
async def save_full_project(
    request: Request,
    name: str = Form(...),
    user_email: str = Form(...),
    collaborator: Optional[str] = Form(None),
    description: str = Form(...),
    mode: str = Form(...),
    error_range: int = Form(0),
    circuit_file: UploadFile = File(...),
    cut_config_json: str = Form(...),
):
    session = get_session_cookie_or_401(request)

    project_id = name.strip()
    if not project_id:
        raise HTTPException(422, "Project name empty")

    # Parse cut config
    try:
        cutcfg = json.loads(cut_config_json)
        inputQubits = cutcfg.get("input_indexes", [])
        if not isinstance(inputQubits, list):
            inputQubits = []

        init_tokens = cutcfg.get("input_init_values", [])
        if not isinstance(init_tokens, list):
            init_tokens = []
    except Exception as e:
        raise HTTPException(400, f"cut_config_json invalid JSON: {e}")

    #los cambios para que no haya erroes de persistencia
    testSuites = legacy_cutcfg_to_testSuites(
        project_id=project_id,
        cutcfg=cutcfg,
        mode=mode,
        error_range=error_range,
        input_qubit_indexes=inputQubits
    )

    # Construye qProgram mínimo (Spring model lo pide)
    inputQubits = cutcfg.get("input_indexes", [])
    outputQubits = cutcfg.get("output_indexes", [])
    qubits = len(inputQubits) + len(outputQubits)

    circuit_bytes = await circuit_file.read()
    try:
        circuit_text = circuit_bytes.decode("utf-8")
    except UnicodeDecodeError:
        circuit_text = circuit_bytes.decode("latin-1")

    #resultado de la conversion en json
    legacy_json = json.dumps({
        "input_indexes": inputQubits,
        "output_indexes": outputQubits,
        "test_suite": cutcfg.get("test_suite", []),
        "shots": int(cutcfg.get("shots", 1024)),
        "input_init_values": init_tokens,
        "error_range": int(error_range),
    }, ensure_ascii=False)

    #la forma que me dio Samuel
    payload = {
        "circuit": {
            "id": project_id,
            "name": name,
            "mutantCycles": None,
            "testSuites": testSuites,
            "testFileContent": legacy_json,
            "qProgram": {
                "id": project_id,
                "qubits": qubits,
                "expressions": [],
                "shots": int(cutcfg.get("shots", 1024)),
                "inputQubits": inputQubits,
                "outputQubits": outputQubits,
                "generator": None,
                "qcodes": [{
                    "platform": "qiskit",
                    "code": circuit_text
                }],
                "qCircuit": {
                    "id": project_id,
                    "qbits": 0,
                    "quirkCode": {"cols": []},
                    "mutableColumns": "",
                    "mutableRows": ""
                }
            },
            "users": [{"id": user_email}],
            "projectNotes": []
        },
        "user": {"id": user_email}
    }

    project = await spring_request(
        "PUT",
        "/projects/save",
        json=payload,
        cookies={"SESSION_TOKEN": session},
    )

    return JSONResponse({"message": "Project created", "project": project}, status_code=status.HTTP_201_CREATED)

# ------------------------------
#La obtencion de todos los proyectos por usuario y en el formato deseado a la hora de enseñar por pantalla
# ------------------------------

@router.get("/")
async def get_projects(request: Request, user_email: Optional[str] = Query(None), userEmail: Optional[str] = Query(None)):
    email = user_email or userEmail
    if not email:
        raise HTTPException(422, "Missing user email")

    session = get_session_cookie_or_401(request)

    spring_projects = await spring_request(
        "POST",
        "/projects/getAllByUser",
        json={"email": email},
        cookies={"SESSION_TOKEN": session},
    )

    if isinstance(spring_projects, str):
        raise HTTPException(status_code=400, detail=spring_projects)

    if isinstance(spring_projects, dict):
        spring_projects = (
            spring_projects.get("projects")
            or spring_projects.get("data")
            or spring_projects.get("content")
            or spring_projects.get("result")
            or []
        )

    if not isinstance(spring_projects, list):
        raise HTTPException(
            status_code=502,
            detail=f"Spring did not return a list. Got: {type(spring_projects)} -> {spring_projects}"
        )

    normalized = []
    bad = []

    for idx, p in enumerate(spring_projects):
        try:
            normalized.append(spring_to_projectindb(p, email))
        except Exception as e:
            bad.append({"index": idx, "error": str(e)})
            print(" Mapping crash at index:", idx)
            print(" Raw project:", p)

    return {"projects": normalized, "bad": bad}

# ------------------------------
#Este metodo es el que controla la edición del codigo del circuito, es decir Execute-Edit Code- Save Changes
# ------------------------------

@router.put("/{project_name}/circuit")
async def update_cut_circuit(request: Request, project_name: str, body: dict = Body(...)):
    session = get_session_cookie_or_401(request)

    new_code = body.get("updated_content")
    if not isinstance(new_code, str):
        raise HTTPException(400, detail="You must provide 'updated_content'")

    user_email = body.get("user_email") or body.get("email")
    if not user_email:
        raise HTTPException(422, detail="user_email required")

    project = await spring_request(
        "POST",
        "/projects/getProject",
        json={"email": user_email, "projectId": project_name},
        cookies={"SESSION_TOKEN": session},
    )
    if not isinstance(project, dict):
        raise HTTPException(404, detail="Project not found in Spring")

    qp = project.get("qProgram") or {}
    project["qProgram"] = qp

    qcodes = qp.get("qCodes")
    if qcodes is None:
        qcodes = qp.get("qcodes")

    if not isinstance(qcodes, list) or len(qcodes) == 0:
        qcodes = [{"platform": "qiskit", "code": new_code}]
    else:
        if not isinstance(qcodes[0], dict):
            qcodes[0] = {"platform": "qiskit", "code": new_code}
        else:
            qcodes[0]["platform"] = qcodes[0].get("platform") or "qiskit"
            qcodes[0]["code"] = new_code

    qp["qCodes"] = qcodes
    qp["qcodes"] = qcodes

    saved = await spring_request(
        "PUT",
        "/projects/save",
        json={
            "circuit": project,
            "user": {"id": user_email}
        },
        cookies={"SESSION_TOKEN": session},
    )

    return {"success": True, "project": saved}

# ------------------------------
#Metodo en proceso de reparacion debido a las notas
# ------------------------------

@router.delete("/{project_name}")
async def delete_project(request: Request, project_name: str, user_email: str = Query(..., alias="user_email")):
    session = get_session_cookie_or_401(request)

    await spring_request(
        "DELETE",
        f"/projects/{project_name}?email={user_email}",
        cookies={"SESSION_TOKEN": session},
    )
    return {"success": True}

# ------------------------------
#Controlador de ejecución de los circuitos junto sus test suites,fotos de los circuitos y estadisitca en caso de estocastico
# ------------------------------
@router.post("/{project_name}/run_tests")
async def run_tests_controller(request: Request, project_name: str, body: dict = Body(..., example={"user_email": "a@b.com"})):
    try:
        session = get_session_cookie_or_401(request)

        user_email = body.get("user_email")
        if not user_email:
            raise HTTPException(422, "user_email required")

        project = await spring_request(
            "POST",
            "/projects/getProject",
            json={"email": user_email, "projectId": project_name},
            cookies={"SESSION_TOKEN": session},
        )
        if not isinstance(project, dict):
            raise HTTPException(404, "Project not found in Spring")

        mapped = spring_to_projectindb(project, user_email)

        circuit_content = mapped.get("circuit_file_content") or ""
        test_content    = mapped.get("test_file_content") or ""
        mode            = (mapped.get("mode") or "deterministic").lower().strip()
        error_range = float(next((ts.get("error_range") or ts.get("errorRange") for ts in (project.get("testSuites") or []) if (ts.get("error_range") or ts.get("errorRange")) is not None), 0))

        if not circuit_content.strip():
            raise HTTPException(400, "Missing circuit_file_content")
        if not test_content.strip():
            raise HTTPException(400, "Missing test_file_content (reconstructed legacy is empty)")

        data = json.loads(test_content or "{}")
        inputs      = data.get("input_indexes", [])
        outputs     = data.get("output_indexes", [])
        test_suite  = data.get("test_suite", [])
        shots       = int(data.get("shots", 1024))
        init_values = data.get("input_init_values")

        if isinstance(init_values, list):
            init_values = [None if (v is None or str(v).strip() == "") else str(v).strip().lower()
                           for v in init_values]
        else:
            init_values = None

        if not test_suite:
            raise HTTPException(400, "El test_suite está vacío")

        CuT = ProjectService._write_circuit_file(circuit_content)
        cut_b64 = ProjectService._draw_circuit_image(CuT)

        if mode == "deterministic":
            result = ProjectServiceDeter.run(CuT, inputs, outputs, test_suite, shots)
            qtcc_b64 = None
            if isinstance(result, dict) and result.get("qtcc_circuit") is not None:
                qtcc_b64 = ProjectService._draw_circuit_image(result["qtcc_circuit"])

            return {
                "success": True,
                "mode": "deterministic",
                "logs": result.get("payload", {}).get("logs", []),
                "cut_image_base64": cut_b64,
                "qtcc_image_base64": qtcc_b64,
                "shots": shots
            }

        if mode == "stochastic":
            try:
                errorRange = float(error_range or 0)
            except Exception:
                errorRange = 0.0

            result = ProjectServiceStoch.run(CuT, inputs, outputs, test_suite, shots, errorRange, init_values)

            qtcc_b64 = None
            if isinstance(result, dict) and result.get("qtcc_circuit") is not None:
                qtcc_b64 = ProjectService._draw_circuit_image(result["qtcc_circuit"])

            payload = dict(result.get("payload", {}))
            payload.update({
                "success": True,
                "mode": "stochastic",
                "cut_image_base64": cut_b64,
                "qtcc_image_base64": qtcc_b64,
                "shots": shots,
                "error_range": errorRange
            })
            return payload

        raise HTTPException(400, f"Invalid mode: {mode}")

    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print(tb)
        raise HTTPException(status_code=500, detail={"error": str(e), "traceback": tb})

# ------------------------------
#Controlador de la edicion de la test suite,es decir la Test Configuration, 
#IMPORTANTE: a la hora de crear el proyecto se comento que no hacia falta que se pudiera cambiar las puertas de valores iniciales del qtcc 
#entonces, entiendo que es un a restriccion que no puedas tener mas inputs de CuT que initial values del QTCC declarados
# ------------------------------
@router.put("/{project_name}/test_config")
async def update_test_config(
    request: Request,
    project_name: str,
    body: dict = Body(..., example={"updated_content": "{...json...}", "error_range": 5, "user_email": "a@b.com"})
):
    session = get_session_cookie_or_401(request)

    updated = body.get("updated_content")
    if not isinstance(updated, str):
        raise HTTPException(400, detail="updated_content missing (must be a string JSON)")

    try:
        cutcfg = json.loads(updated)
    except Exception as e:
        raise HTTPException(400, detail=f"updated_content is not valid JSON: {e}")
    
    #obtencion de cosas de la BBDD
    inputs = cutcfg.get("input_indexes", [])
    outputs = cutcfg.get("output_indexes", [])
    shots = int(cutcfg.get("shots", 1024))

    if not isinstance(inputs, list) or not isinstance(outputs, list):
        raise HTTPException(400, detail="input_indexes/output_indexes must be lists")

    er = body.get("error_range", cutcfg.get("error_range", 0))
    try:
        er_int = int(er)
    except Exception:
        er_int = 0

    user_email = body.get("user_email")
    if not user_email:
        raise HTTPException(422, detail="user_email required to fetch project (Spring validateCookie needs it)")

    project = await spring_request(
        "POST",
        "/projects/getProject",
        json={"email": user_email, "projectId": project_name},
        cookies={"SESSION_TOKEN": session},
    )
    if not isinstance(project, dict):
        raise HTTPException(404, detail="Project not found in Spring")

    mode = body.get("mode")
    if not isinstance(mode, str) or not mode.strip():
        mode = _derive_mode_from_testSuites(project)
    mode = mode.lower().strip()

    testSuites = legacy_cutcfg_to_testSuites(
        project_id=project_name,
        cutcfg=cutcfg,
        mode=mode,
        error_range=er_int,
        input_qubit_indexes=inputs
    )
    #aqui empieza lo de que se cambien los parametros 
    project["testFileContent"] = updated
    project["errorRange"] = er_int
    project["testSuites"] = testSuites

    qp = project.get("qProgram") or {}
    project["qProgram"] = qp
    qp["shots"] = shots
    qp["inputQubits"] = inputs
    qp["outputQubits"] = outputs
    qp["qubits"] = len(inputs) + len(outputs)

    # Si tu Spring espera qCodes (camelCase), deja ambos por si acaso
    if "qcodes" in qp and "qCodes" not in qp:
        qp["qCodes"] = qp["qcodes"]
    if "qCodes" in qp and "qcodes" not in qp:
        qp["qcodes"] = qp["qCodes"]

    saved = await spring_request(
        "PUT",
        "/projects/updateTestSuites",
        json={
            "email": user_email,
            "projectId": project_name,
            "testSuites": testSuites,
            "testFileContent": updated,     # <- CLAVE
            "errorRange": er_int,           # <- CLAVE (camelCase como DTO)
            "shots": shots,                 # <- CLAVE
            "inputQubits": inputs,          # <- CLAVE
            "outputQubits": outputs         # <- CLAVE
        },
        cookies={"SESSION_TOKEN": session},
    )



    return {"success": True, "project": saved}



# ------------------------------
#Metodo de obtener el code circuit, apra que salga y se vea
# ------------------------------
@router.get("/{project_name}/cut_config")
async def get_cut_config(request: Request, project_name: str, user_email: str = Query(...)):
    session = get_session_cookie_or_401(request)

    project = await spring_request(
        "POST",
        "/projects/getProject",
        json={"email": user_email, "projectId": project_name},
        cookies={"SESSION_TOKEN": session},
    )
    if not isinstance(project, dict):
        raise HTTPException(status_code=404, detail="Project not found")

    mapped = spring_to_projectindb(project, user_email)

    cutcfg_obj = {}
    try:
        cutcfg_obj = json.loads(mapped.get("test_file_content") or "{}")
    except Exception:
        cutcfg_obj = {}

    return {
        "cut_config": cutcfg_obj,
        "mode": mapped.get("mode"),
        "error_range": mapped.get("error_range"),
        "project": mapped
    }

# ------------------------------
#Controlador sobre la tabla que TEST CONFIGURATION ya que se considera un metodo aparte y su estructura por fast api necesita programacion 
#ademas de su rellenado
# ------------------------------
@router.get("/{project_name}/oi_table")
async def get_oi_table(request: Request, project_name: str):
    session = get_session_cookie_or_401(request)

    doc = await spring_request("GET", f"/projects/{project_name}", cookies={"SESSION_TOKEN": session})

    test_content = doc.get("test_file_content") or doc.get("testFileContent") or "{}"
    config = json.loads(test_content or "{}")

    inputs = config.get("input_indexes", [])
    outputs = config.get("output_indexes", [])
    if not (isinstance(inputs, list) and isinstance(outputs, list)):
        raise HTTPException(status_code=400, detail="Invalid test_file_content format")

    num_qubits = len(inputs) + len(outputs)

    init_vals = config.get("input_init_values", [])
    if not isinstance(init_vals, list):
        init_vals = []

    table = build_table(TableConfig(
        num_qubits=num_qubits,
        inputs=inputs,
        outputs=outputs,
        input_header="Inputs",
        output_header="Outputs",
        qubit_prefix="q",
        input_init_values=[("" if v is None else str(v).strip().lower()) for v in init_vals],
    ))

    return {"success": True, "table": table.model_dump()}
