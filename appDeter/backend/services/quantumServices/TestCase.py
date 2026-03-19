from appDeter.backend.services.quantumServices.Circuit import Circuit
from appDeter.backend.services.quantumServices.CircuitDeterministic import CircuitDeterministic
from appDeter.backend.services.quantumServices.CircuitStochastic import CircuitStochastic

class TestCase:
    @staticmethod
    def deterministic_tests(CuT, outputs, test_suite, shots, inputs):
        logs = []
        for inp, expected in test_suite:
            QTCC = CircuitDeterministic.generateQTCC(CuT, outputs, inp, expected, inputs)
            verdict = Circuit.executeQTCC(QTCC, shots)
            logs.append(f"Input: {inp} → Expected: {expected} → Verdict: {verdict}")
        return logs, []

  
    @staticmethod
    def stochastic_tests(CuT, outputs, test_suite, shots, inputs, error_range=None, init_values=None):
        tol = float(error_range) if isinstance(error_range, (int, float)) else None
        raw = []

        # entradas iniciales: usa init_values si vienen; si no, ceros
        if init_values is not None:
            prepared = []
            for j, _idx in enumerate(inputs):
                try:
                    prepared.append(init_values[j])
                except Exception:
                    prepared.append(0)
        else:
            prepared = [0] * len(inputs)

        def bits_to_key(bits):
            return ''.join(str(b) for b in reversed(bits))

        for expected_out, expected_prob in test_suite:
            QTCC = CircuitStochastic.generateQTCC_stochastic(
                CuT,
                CuT_output_indexes=outputs,
                input_values=prepared,     # << ahora sí
                input_indexes=inputs,
                expected_out=expected_out
            )
            counts_dict = Circuit.run_counts(QTCC, shots)
            key = bits_to_key(expected_out)
            n_hits = int(counts_dict.get(key, 0))
            percent = round((n_hits / shots) * 100.0, 2)

            exp_float = None
            if isinstance(expected_prob, list):
                expected_prob = expected_prob[0] if expected_prob else None
            try:
                if expected_prob is not None:
                    exp_float = float(expected_prob)
            except Exception:
                exp_float = None
            expected_percent = (
                round(exp_float * 100.0, 2) if (exp_float is not None and 0.0 <= exp_float <= 1.0)
                else (round(exp_float, 2) if exp_float is not None else None)
            )

            if expected_percent is not None and tol is not None:
                ok = percent >= (expected_percent - tol)
            elif expected_percent is not None:
                ok = percent >= expected_percent
            else:
                ok = percent >= 50.0

            raw.append({
                'output': expected_out,
                'counts': n_hits,
                'percent': percent,
                'expected_percent': expected_percent,
                'tolerance': tol,
                'ok': ok,
            })

        return [], raw


    @staticmethod
    def run_test_process(CuT, outputs, test_suite, shots, inputs, mode, error_range=None, input_init_values=None):
        if mode == "deterministic":
            return TestCase.deterministic_tests(CuT, outputs, test_suite, shots, inputs)
        else:
            return TestCase.stochastic_tests(
                CuT, outputs, test_suite, shots, inputs,
                error_range=error_range, init_values=input_init_values
            )

    @staticmethod
    def format_test_suite(test_suite):
        formatted_test_suite = [tuple(map(tuple, case)) for case in test_suite]
        return tuple(formatted_test_suite)
