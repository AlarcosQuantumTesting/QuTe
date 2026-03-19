import datetime
import io
import json
import base64
import traceback
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from qiskit.visualization import circuit_drawer

from appDeter.backend.data.database import spring_request
from appDeter.backend.services.quantumServices.Circuit import Circuit
from appDeter.backend.services.quantumServices.CircuitLoadError import CircuitLoadError

from .ProjectServiceDeter import ProjectServiceDeter
from .ProjectServiceStoch import ProjectServiceStoch


class ProjectService:
    #-----------------------------
    # Crea un nuevo proyecto en Spring enviando el circuito y opcionalmente
    # el archivo de configuración de tests, delegando en el backend Java
    # la persistencia del Project, QProgram y TestSuites en MySQL.
    #-----------------------------
    @staticmethod
    async def create(
        name: str,
        user_email: str,
        collaborator: Optional[str],
        description: str,
        mode: str,
        error_range: Optional[float],
        circuit_file: UploadFile,
        test_file: Optional[UploadFile],
    ) -> dict:

        circuit_bytes = await circuit_file.read()
        test_bytes = await test_file.read() if test_file is not None else None

        files = {
            "circuit_file": (circuit_file.filename, circuit_bytes, circuit_file.content_type),
        }
        if test_file is not None:
            files["test_file"] = (test_file.filename, test_bytes, test_file.content_type)

        data = {
            "name": name,
            "user_email": user_email,
            "collaborator": collaborator or "",
            "description": description,
            "mode": mode,
            "error_range": "" if error_range is None else str(error_range),
        }

        # Spring crea en MySQL y devuelve el proyecto
        return await spring_request("POST", "/projects", data=data, files=files)

    #-----------------------------------------
    # Verifica la existencia del proyecto en Spring antes de cualquier
    # operación de ejecución o actualización sobre el mismo.
    #Este metodo quiza se deba quitar porque lo use tambien para debugear
    #-----------------------------------------

    @staticmethod
    async def _validate_project(project_name: str) -> dict:
        project = await spring_request("GET", f"/projects/{project_name}")
        if not isinstance(project, dict):
            raise HTTPException(404, "Project not found")
        return project

    #-----------------------------------------
    # Genera el objeto CuT ejecutable escribiendo temporalmente el código
    # del circuito persistido y cargándolo mediante Circuit.create_cut_circuit.
    # Traduce errores de carga del circuito a excepciones HTTP interpretables.
    #-----------------------------------------

    @staticmethod
    def _write_circuit_file(circuit_content: str, path: str = "/tmp/circuit.py"):
        f = None
        try:
            f = open(path, "w", encoding="utf-8")
            f.write(circuit_content)
        finally:
            if f:
                f.close()

        try:
            return Circuit.create_cut_circuit(path)
        except CircuitLoadError as e:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail={
                    "type": "circuit_error",
                    "message": str(e),
                    "filename": e.filename,
                    "lineno": e.lineno,
                    "colno": e.colno,
                    "code_line": e.code_line,
                    "traceback": e.tb,
                },
            )
    #----------------------
    #Estos metodos son los de las imagenes
    #-----------------------
    @staticmethod
    def _draw_circuit_image(circuit, scale: float = 1.5) -> str:
        fig = circuit_drawer(circuit, output="mpl", scale=scale, style="iqp")
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        return base64.b64encode(buf.getvalue()).decode()

    @staticmethod
    async def _save_images(project_name: str, cut_b64: str, qtcc_b64: Optional[str]):
        await spring_request(
            "PUT",
            f"/projects/{project_name}/images",
            json={
                "cut_image_base64": cut_b64,
                "qtcc_image_base64": qtcc_b64,
                "image_need_updated": False,
                "images_updated_at": datetime.datetime.utcnow().isoformat(),
            },
        )
    #----------------------
    #Servicio
    #-----------------------
    @staticmethod
    async def run_tests(project_name: str) -> dict:
        try:
            project = await ProjectService._validate_project(project_name)

            # Ajusta nombres de campos según tu Spring (snake_case vs camelCase)
            mode = project.get("mode", "deterministic")
            test_content = project.get("test_file_content") or project.get("testFileContent") or ""
            circuit_content = project.get("circuit_file_content") or project.get("circuitFileContent") or ""
            error_range = project.get("error_range") or project.get("errorRange")
            
            data = json.loads(test_content or "{}")
            inputs_list = data.get("input_indexes", [])
            outputs_list = data.get("output_indexes", [])
            test_suite = data.get("test_suite", [])
            shots = data.get("shots", 1024)
            init_values = data.get("input_init_values")

            if isinstance(init_values, list):
                init_values = [
                    None if (v is None or str(v).strip() == "")
                    else str(v).strip().lower()
                    for v in init_values
                ]
            else:
                init_values = None

            if not test_suite:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "El test_suite está vacío")
            if not isinstance(shots, int) or shots <= 0:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"shots inválido: {shots!r}")

            CuT = ProjectService._write_circuit_file(circuit_content)
            cut_b64 = ProjectService._draw_circuit_image(CuT)

            if mode == "deterministic":
                result = ProjectServiceDeter.run(CuT, inputs_list, outputs_list, test_suite, shots)
            elif mode == "stochastic":
                result = ProjectServiceStoch.run(CuT, inputs_list, outputs_list, test_suite, shots, error_range, init_values)
            else:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid mode: {mode}")

            qtcc_b64 = None
            if result.get("qtcc_circuit") is not None:
                qtcc_b64 = ProjectService._draw_circuit_image(result["qtcc_circuit"])

            await ProjectService._save_images(project_name, cut_b64, qtcc_b64)

            payload = dict(result.get("payload", {}))
            payload.update({
                "success": True,
                "cut_image_base64": cut_b64,
                "qtcc_image_base64": qtcc_b64,
            })
            return payload

        except HTTPException:
            raise
        except Exception as e:
            traceback.print_exc()
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error inesperado al ejecutar tests: {e}",
            )