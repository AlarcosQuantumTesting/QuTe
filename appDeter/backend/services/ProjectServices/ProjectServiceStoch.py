from fastapi import HTTPException, status

from appDeter.backend.services.quantumServices.TestCase import TestCase
from appDeter.backend.services.quantumServices.CircuitStochastic import CircuitStochastic


class ProjectServiceStoch:

    @staticmethod
    def _validate_tests(test_suite, outputs_list):
        for idx, (expected_out, p) in enumerate(test_suite, start=1):
            if not isinstance(expected_out, list) or len(expected_out) != len(outputs_list):
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Case #{idx}: 'expected_out' invalid — expected {len(outputs_list)} bits, "
                    f"got {len(expected_out) if isinstance(expected_out, list) else 'not a list'}."
                )

            if isinstance(p, list):
                p = p[0] if p else None
            try:
                fp = float(p)
            except Exception:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Case #{idx}: invalid probability {p!r}.")

            if not (0.0 <= fp <= 1.0 or 0.0 <= fp <= 100.0):
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Case #{idx}: probability out of range {fp} (use 0..1 or 0..100)."
                )

    @staticmethod
    def _build_qtcc_preview(CuT, outputs_list, inputs_list, test_suite, init_values=None):
        # si no hay init_values y el primer caso parece [inp,out], usar inp solo para la foto
        if init_values is None and test_suite and isinstance(test_suite[0], list) and len(test_suite[0]) == 2:
            maybe_inp, _maybe_out = test_suite[0]
            if isinstance(maybe_inp, list):
                init_values = maybe_inp

        # ✅ NORMALIZA: "" -> None (no preparar)
        if isinstance(init_values, list):
            cleaned = []
            for v in init_values:
                tok = ("" if v is None else str(v)).strip().lower()
                cleaned.append(None if tok == "" else tok)
            init_values = cleaned

        return CircuitStochastic.generateQTCC_stochastic(
            CuT,
            CuT_output_indexes=outputs_list,
            input_values=init_values,
            input_indexes=inputs_list,
            expected_out=None
        )


    @staticmethod
    def run(CuT, inputs_list, outputs_list, test_suite, shots, error_range=None, init_values=None):
        ProjectServiceStoch._validate_tests(test_suite, outputs_list)

        qtcc_preview = ProjectServiceStoch._build_qtcc_preview(
            CuT, outputs_list, inputs_list, test_suite, init_values
        )

        _logs, raw = TestCase.run_test_process(
            CuT, outputs_list, test_suite, shots, inputs_list, mode="stochastic",
            error_range=error_range, input_init_values=init_values
        )

        return {
            "qtcc_circuit": qtcc_preview,
            "payload": {
                "percentages": raw
            }
        }
