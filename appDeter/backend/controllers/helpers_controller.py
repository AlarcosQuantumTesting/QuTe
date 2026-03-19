# appDeter/Backend/controllers/helpers_controller.py
import json
import uuid
from fastapi import HTTPException, Request

ALLOWED_INIT = ["", "0", "1", "h", "y", "z", "s", "t"]


    # ------------------------------
    #esto es por cosas de Spring que me trae loca la cookie
    # ------------------------------
def get_session_cookie_or_401(request: Request) -> str:
    session = request.cookies.get("SESSION_TOKEN")
    if not session:
        raise HTTPException(status_code=401, detail="Missing SESSION_TOKEN cookie")
    return session

    # ------------------------------
        # Normaliza los valores iniciales de entrada delqtcc 
        # Valida que cada token pertenezca al alfabeto permitido de inicialización
        # y ajusta dinámicamente la longitud al número de qubits de entrada del qProgram
    # ------------------------------

def normalize_init_tokens(tokens, n_qubits: int) -> list[str]:
    # tokens: ["z", "", "h"...] o lo que se decida
    if not isinstance(tokens, list):
        tokens = []
    out: list[str] = []
    for t in tokens:
        s = "" if t is None else str(t).strip().lower()
        if s not in ALLOWED_INIT:
            raise HTTPException(400, f'Invalid init token "{s}". Allowed: {ALLOWED_INIT}')
        out.append(s)

    if len(out) < n_qubits:
        out += [""] * (n_qubits - len(out))
    elif len(out) > n_qubits:
        out = out[:n_qubits]
    return out

    # ------------------------------
    #esto es porque en las test suite,testcase y qprogram en la base de datos se iban cambiando entre int y string 
    #y tuve que generar esta conversion porque me saltaba excepcion
    # ------------------------------
def gen_int_id() -> int:

    return int(uuid.uuid4().int % 2_000_000_000)

    # ------------------------------
    # Extrae y valida los valores iniciales de entrada definidos en el CUT
    # que serán persistidos a nivel de TestSuite (QTCCInputs) en Spring,esto en el
    #tfg es distinto porque se contemplaban de forma distinta, aqui va "mas separado"
    #de ahi que se necesite un enlace entre cut y testisuite a la hora de crearlos
    # ------------------------------
def legacy_cutcfg_to_testSuites(
    project_id: str,
    cutcfg: dict,
    mode: str,
    error_range: int,
    input_qubit_indexes: list[int],
):
    mode_l = (mode or "").lower().strip()

    suite = cutcfg.get("test_suite", [])
    if not isinstance(suite, list):
        raise HTTPException(400, "test_suite must be a list")

    output_qubit_indexes = cutcfg.get("output_indexes", [])
    if not isinstance(output_qubit_indexes, list):
        output_qubit_indexes = []

    if not isinstance(input_qubit_indexes, list):
        input_qubit_indexes = []

    # tokens iniciales (letras) por qubit de entrada
    init_tokens = normalize_init_tokens(
        cutcfg.get("input_init_values", []),
        n_qubits=len(input_qubit_indexes),
    )
    suite_id = gen_int_id()
    if mode_l == "deterministic":
        testCases = []
        for pair in suite:
            if not (isinstance(pair, list) and len(pair) == 2):
                raise HTTPException(400, "Each deterministic case must be [inputValue, outputValue]")
            input_value, output_value = pair

            testCases.append({
                "id": gen_int_id(),
                "type": "DETERMINISTIC",
                "entryIndexes": input_qubit_indexes,
                "outputIndexes": output_qubit_indexes,
                "entryValues": input_value,
                "expectedValues": output_value,
            })

        return [{
            "id": suite_id,
            "error_range": int(error_range),
            "entryValues": init_tokens,   
            "testCases": testCases
        }]

    if mode_l == "stochastic":
        prob_map = {}
        for pair in suite:
            if not (isinstance(pair, list) and len(pair) == 2):
                raise HTTPException(400, "Each stochastic case must be [outBits, prob]")
            outBits, prob = pair
            p = int(prob)
            if p < 0 or p > 100:
                raise HTTPException(400, "prob must be 0..100")
            prob_map[json.dumps(outBits)] = p

        return [{
            "id": suite_id,
            "error_range": int(error_range),
            "entryValues": init_tokens,   
            "testCases": [{
                "id": gen_int_id(),
                "type": "STOCHASTIC",
                "entryIndexes": input_qubit_indexes,
                "outputIndexes": output_qubit_indexes,
                "probabilityDistribution": prob_map,
            }]
        }]

    raise HTTPException(400, f"Invalid mode: {mode}")


def _derive_mode_from_testSuites(p: dict) -> str:
    suites = p.get("testSuites") or p.get("test_suites") or []
    if not isinstance(suites, list):
        return "deterministic"

    for s in suites:
        if not isinstance(s, dict):
            continue
        cases = s.get("testCases") or s.get("test_cases") or []
        if not isinstance(cases, list):
            continue
        for tc in cases:
            if not isinstance(tc, dict):
                continue
            t = (tc.get("type") or "").upper()
            if t == "STOCHASTIC":
                return "stochastic"
    return "deterministic"

    # ------------------------------
    #Este metodo es porque mi backend y spring no estan devolviendo exactamente lo mismo
    #entonces es una conversion para que no haya problemas de persistencia
    # ------------------------------

def spring_to_projectindb(p: dict, fallback_email: str) -> dict:
    if not isinstance(p, dict):
        raise ValueError(f"Project is not a dict: {type(p)}")

    user_email = fallback_email
    users = p.get("users") or []
    if isinstance(users, list) and users:
        u0 = users[0]
        if isinstance(u0, dict):
            user_email = u0.get("id") or u0.get("email") or fallback_email

    # ------------------------------
    # qProgram / circuit_code
    # ------------------------------
    circuit_code = ""
    qp = p.get("qProgram") or p.get("qprogram") or p.get("q_program") or {}
    if not isinstance(qp, dict):
        qp = {}

    qcodes = qp.get("qcodes") or qp.get("qCodes") or []
    if isinstance(qcodes, list) and qcodes:
        qc0 = qcodes[0]
        if isinstance(qc0, dict):
            code = qc0.get("code")
            if isinstance(code, str):
                circuit_code = code

    mode = _derive_mode_from_testSuites(p)

    # ------------------------------
    # LEGACY cutcfg desde testSuites
    # ------------------------------
    inputQubits  = qp.get("inputQubits")  or qp.get("input_qubits")  or []
    outputQubits = qp.get("outputQubits") or qp.get("output_qubits") or []
    shots        = qp.get("shots") or 1024

    if not isinstance(inputQubits, list):
        inputQubits = []
    if not isinstance(outputQubits, list):
        outputQubits = []

    suites = p.get("testSuites") or p.get("test_suites") or []
    if not isinstance(suites, list):
        suites = []

    cutcfg = {}
    error_range_out = p.get("error_range") or p.get("errorRange") or None

    if suites and isinstance(suites[-1], dict):
        s0 = suites[-1]


        entry_vals = s0.get("entryValues") or s0.get("entry_values") or s0.get("entryvalues") or []

        try:
            init_tokens = normalize_init_tokens(entry_vals, n_qubits=len(inputQubits))
        except Exception:
            init_tokens = [""] * len(inputQubits)

        error_range = s0.get("error_range") or s0.get("errorRange") or 0
        if error_range_out is None:
            error_range_out = error_range

        test_cases = s0.get("testCases") or s0.get("test_cases") or []
        if not isinstance(test_cases, list):
            test_cases = []

        det_pairs = []
        for tc in test_cases:
            if not isinstance(tc, dict):
                continue
            inp = tc.get("entryValues") or tc.get("entry_values")
            outp = tc.get("expectedValues") or tc.get("expected_values")
            if isinstance(inp, list) and isinstance(outp, list):
                det_pairs.append([inp, outp])

        if det_pairs:
            cutcfg = {
                "input_indexes": inputQubits,
                "output_indexes": outputQubits,
                "shots": int(shots) if isinstance(shots, int) else 1024,
                "test_suite": det_pairs,
                "input_init_values": init_tokens,
            }
        else:
            for tc in test_cases:
                if not isinstance(tc, dict):
                    continue
                pd = tc.get("probabilityDistribution") or tc.get("probability_distribution")
                if not isinstance(pd, dict) or not pd:
                    continue

                suite_list = []
                for key, prob in pd.items():
                    bits = None
                    if isinstance(key, str):
                        k = key.strip()
                        if k.startswith("[") and k.endswith("]"):
                            try:
                                bits = [int(x.strip()) for x in k[1:-1].split(",") if x.strip() != ""]
                            except Exception:
                                bits = None
                    if bits is None:
                        bits = [int(ch) for ch in str(key) if ch in "01"]

                    try:
                        pval = float(prob)
                    except Exception:
                        continue
                    p100 = pval * 100.0 if pval <= 1.0 else pval
                    suite_list.append([bits, p100])

                if suite_list:
                    cutcfg = {
                        "input_indexes": inputQubits,
                        "output_indexes": outputQubits,
                        "shots": int(shots) if isinstance(shots, int) else 1024,
                        "test_suite": suite_list,
                        "input_init_values": init_tokens,
                        "error_range": error_range
                    }
                    break

    # ------------------------------
    # test_file_content: si Spring trae uno real, úsalo; si no, reconstruye
    # ------------------------------
    raw_test_content = p.get("test_file_content") or p.get("testFileContent") or ""

    #Fallback: qProgram.generator , no se muy bien que era pero intente adaptarme a lo que tiene Saurom
    if (not isinstance(raw_test_content, str)) or (raw_test_content.strip() in ("", "{}", "null")):
        gen = qp.get("generator")
        if isinstance(gen, str) and gen.strip() not in ("", "{}", "null"):
            raw_test_content = gen

    if isinstance(raw_test_content, str) and raw_test_content.strip() not in ("", "{}", "null"):
        test_content = raw_test_content
    else:
        test_content = json.dumps(cutcfg, ensure_ascii=False) if cutcfg else ""

    return {
        "name": p.get("name") or p.get("id") or "",
        "user_email": user_email,
        "collaborator": p.get("collaborator") or "",
        "description": p.get("description") or "",
        "mode": mode,
        "circuit_file_content": circuit_code,
        "test_file_content": test_content,
        "error_range": error_range_out,
    }
