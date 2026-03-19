from fastapi import HTTPException, status

from appDeter.backend.services.quantumServices.TestCase import TestCase
from appDeter.backend.services.quantumServices.CircuitDeterministic import CircuitDeterministic


class ProjectServiceDeter:

    @staticmethod
    def _validate_tests(test_suite, inputs_list, outputs_list):
        for idx, (inp, outp) in enumerate(test_suite, start=1):
            if not isinstance(inp, list) or len(inp) != len(inputs_list):
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Case #{idx}: invalid inputs — waiting {len(inputs_list)} qubits, got {len(inp) if isinstance(inp, list) else 'no list'}.",
                )
            if not isinstance(outp, list) or len(outp) != len(outputs_list):
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"Case #{idx}: invalid outputs — waiting {len(outputs_list)} qubits, got {len(outp) if isinstance(outp, list) else 'no list'}.",
                )

    @staticmethod
    def _build_qtcc_preview(CuT, outputs_list, inputs_list, test_suite, init_values=None):
        # Si hay init_values (tokens), úsalo para preparar.
        # Si no, usa el input del primer testcase (bits) como fallback para la foto.
        if init_values is None and test_suite:
            inp0, _out0 = test_suite[0]
            init_values = inp0

        # normaliza ""->None si viene como tokens
        if isinstance(init_values, list):
            cleaned=[]
            for v in init_values:
                tok = ("" if v is None else str(v)).strip().lower()
                cleaned.append(None if tok=="" else tok)
            init_values = cleaned

        # Para deterministic el expected_out sí viene del primer caso
        expected_out = test_suite[0][1] if test_suite else None

        return CircuitDeterministic.generateQTCC(
            CuT,
            CuT_output_indexes=outputs_list,
            input_values=init_values,
            result=expected_out,
            input_indexes=inputs_list
        )
    @staticmethod
    def run(CuT, inputs_list, outputs_list, test_suite, shots, init_values=None):
        ProjectServiceDeter._validate_tests(test_suite, inputs_list, outputs_list)

        qtcc_preview = ProjectServiceDeter._build_qtcc_preview(
            CuT, outputs_list, inputs_list, test_suite, init_values
        )

        logs, _raw = TestCase.run_test_process(
            CuT, outputs_list, test_suite, shots, inputs_list,
            mode="deterministic",
            error_range=None,
            input_init_values=init_values   # <-- YA NO None
        )

        return {"qtcc_circuit": qtcc_preview, "payload": {"logs": logs}}
