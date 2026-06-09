import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class QuteExecutionService {

  constructor(private client: HttpClient) { }

  runDeterministic(request: {
    circuitCode: string;
    inputs: number[];
    outputs: number[];
    testSuite: string;
    shots: number;
    initValues: string[] | null;
  }) {
    return this.client.post<any>(`${environment.api.execution}/api/tests/run-deterministic`, request);
  }

  runStochastic(request: {
    circuitCode: string;
    inputs: number[];
    outputs: number[];
    testSuite: string;
    shots: number;
    errorRange: number | null;
    initValues: string[] | null;
  }) {
    return this.client.post<any>(`${environment.api.execution}/api/tests/run-stochastic`, request);
  }

  validateCircuit(code: string) {
    return this.client.post<any>(`${environment.api.execution}/api/circuit/validate`, { code });
  }

  drawCircuit(code: string) {
    return this.client.post<any>(`${environment.api.execution}/api/circuit/draw`, { code });
  }
}
