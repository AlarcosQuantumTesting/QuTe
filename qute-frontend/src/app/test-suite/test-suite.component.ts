import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, throwError, Observable } from 'rxjs';
import { tap } from 'rxjs';
import { AppComponent } from '../app.component';
import { ManagerService } from '../services/manager.service';
import { ReperService } from '../services/reper.service';
import { QuteExecutionService } from '../services/qute-execution.service';
import { ConverterService } from '../services/converter.service';
import { UserService } from '../services/user.service';
import { Project } from '../model/Project';
import { QCode } from '../model/QCode';
import { TestSuite } from '../model/TestSuite';
import { Deterministic } from '../model/Deterministic';
import { Stochastic } from '../model/Stochastic';

@Component({
  selector: 'app-test-suite',
  templateUrl: './test-suite.component.html',
  styleUrls: ['./test-suite.component.css']
})
export class TestSuiteComponent implements OnInit, OnDestroy {

  project: Project | null = null;

  // Test Suite fields
  shots: number = 1024;
  errorRange: number = 5.0;
  testCases: any[] = [];
  testSuiteType: 'DETERMINISTIC' | 'STOCHASTIC' = 'DETERMINISTIC';

  // Qubit fields (loaded from project)
  inputQubitsStr: string = '';
  outputQubitsStr: string = '';
  inputQubitsIndicesList: number[] = [];
  outputQubitsIndicesList: number[] = [];

  // Results fields
  isRunningTests: boolean = false;
  deterministicVerdicts: any[] = [];
  stochasticResults: any[] = [];
  testRunSuccess: boolean = false;

  // Converter
  isConverting: boolean = false;
  quirkCodeText: string = '';
  circuitCode: string = '';

  activeSection: 'config' | 'results' = 'config';

  private subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public manager: ManagerService,
    private reperService: ReperService,
    private quteExecution: QuteExecutionService,
    private converterService: ConverterService,
    private userService: UserService
  ) { }

  ngOnInit(): void {
    this.subscription.add(
      this.manager.selectedProject$.subscribe(proj => {
        if (proj) {
          this.project = proj;
          this.loadFromProject();
        }
      })
    );

    this.subscription.add(
      this.route.paramMap.subscribe(params => {
        const projectId = params.get('projectId');
        if (projectId && this.manager.projects.length > 0) {
          const found = this.manager.projects.find(p => p.id === projectId);
          if (found && this.manager.selectedProject !== found) {
            this.manager.setselectedProject(found);
          }
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadFromProject() {
    if (!this.project) return;

    const rawInputs = this.project.qProgram.inputQubits;
    this.inputQubitsStr = Array.isArray(rawInputs) ? rawInputs.join(',') : (rawInputs !== null && rawInputs !== undefined ? String(rawInputs) : '0,1');
    const rawOutputs = this.project.qProgram.outputQubits;
    this.outputQubitsStr = Array.isArray(rawOutputs) ? rawOutputs.join(',') : (rawOutputs !== null && rawOutputs !== undefined ? String(rawOutputs) : '0,1');
    this.shots = this.project.qProgram.shots || 1024;

    const selectedInputs = (this.inputQubitsStr || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const selectedOutputs = (this.outputQubitsStr || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    this.inputQubitsIndicesList = selectedInputs;
    this.outputQubitsIndicesList = selectedOutputs;

    // Load quirk code
    if (this.project.qProgram?.qCircuit?.textQuirkCode) {
      this.quirkCodeText = this.project.qProgram.qCircuit.textQuirkCode;
    } else if (this.project.qProgram?.qCircuit?.quirkCode) {
      try {
        const parsed = typeof this.project.qProgram.qCircuit.quirkCode === 'string'
          ? JSON.parse(this.project.qProgram.qCircuit.quirkCode)
          : this.project.qProgram.qCircuit.quirkCode;
        this.quirkCodeText = JSON.stringify(parsed, null, 2);
      } catch {
        this.quirkCodeText = '';
      }
    }

    if (this.project.qProgram?.qCodes?.length > 0) {
      this.circuitCode = this.project.qProgram.qCodes[0].code || '';
    }

    // Load TestSuite
    if (this.project.testSuites && this.project.testSuites.length > 0) {
      const suite = this.project.testSuites[0];
      this.errorRange = suite.error_range || 5.0;

      if (suite.testCases && suite.testCases.length > 0) {
        this.testSuiteType = (suite.testCases[0].type as 'DETERMINISTIC' | 'STOCHASTIC') || 'DETERMINISTIC';
        const loadedCases: any[] = [];
        suite.testCases.forEach((tc: any) => {
          if (tc.type === 'DETERMINISTIC') {
            loadedCases.push({
              id: tc.id || crypto.randomUUID(),
              type: 'DETERMINISTIC',
              input: Array.isArray(tc.entryValues) ? tc.entryValues.join(',') : '',
              expected: Array.isArray(tc.expectedValues) ? tc.expectedValues.join(',') : ''
            });
          } else {
            const dist = tc.probabilityDistribution || {};
            const keys = Object.keys(dist);
            keys.forEach(k => {
              const cleanKey = k.replace('[', '').replace(']', '');
              loadedCases.push({
                id: crypto.randomUUID(),
                type: 'STOCHASTIC',
                expected: cleanKey,
                probability: dist[k]
              });
            });
            if (keys.length === 0) {
              loadedCases.push({
                id: tc.id || crypto.randomUUID(),
                type: 'STOCHASTIC',
                expected: Array(this.getOutputQubitsCount()).fill('0').join(','),
                probability: 0
              });
            }
          }
        });
        this.testCases = loadedCases;
      } else {
        this.testCases = [];
      }
    } else {
      this.testCases = [];
      this.errorRange = 5.0;
    }

    this.clearResults();
  }

  addTestCase() {
    if (this.testSuiteType === 'DETERMINISTIC') {
      this.testCases.push({
        id: crypto.randomUUID(),
        type: 'DETERMINISTIC',
        input: Array(this.getInputQubitsCount()).fill('0').join(','),
        expected: Array(this.getOutputQubitsCount()).fill('0').join(',')
      });
    } else {
      this.testCases.push({
        id: crypto.randomUUID(),
        type: 'STOCHASTIC',
        expected: Array(this.getOutputQubitsCount()).fill('0').join(','),
        probability: 0
      });
    }
    this.manager.markProjectAsModified();
  }

  removeTestCase(index: number) {
    this.testCases.splice(index, 1);
    this.manager.markProjectAsModified();
  }

  changeTestSuiteType(type: 'DETERMINISTIC' | 'STOCHASTIC') {
    this.testSuiteType = type;
    this.testCases = [];
    this.addTestCase();
    this.manager.markProjectAsModified();
  }

  onShotsChange() {
    if (this.project) {
      this.project.qProgram.shots = this.shots;
      this.manager.markProjectAsModified();
    }
  }

  onErrorRangeChange() {
    this.manager.markProjectAsModified();
  }

  clearResults() {
    this.deterministicVerdicts = [];
    this.stochasticResults = [];
    this.testRunSuccess = false;
  }

  getConvertedCodeObservable(): Observable<{ code: string }> {
    if (!this.quirkCodeText) {
      return throwError(() => new Error('Quirk JSON code is empty. Please define the circuit in the Circuit & Editor tab first.'));
    }

    try {
      JSON.parse(this.quirkCodeText);
    } catch (e: any) {
      return throwError(() => new Error('Invalid Quirk JSON: ' + e.message));
    }

    if (this.circuitCode) {
      return new Observable(observer => {
        observer.next({ code: this.circuitCode });
        observer.complete();
      });
    }

    this.isConverting = true;
    return this.converterService.convert({
      quirkJson: this.quirkCodeText,
      language: 'qiskit'
    }).pipe(
      tap({
        next: (res) => {
          this.circuitCode = res.code;
          this.isConverting = false;
        },
        error: () => {
          this.isConverting = false;
        }
      })
    );
  }

  /** Syncs test suite data into the project model before saving/running */
  syncTestSuiteToProject(code: string): void {
    if (!this.project) return;
    const qCode = new QCode();
    qCode.platform = 'QuTe';
    qCode.code = code;
    this.project.qProgram.qCodes = [qCode];
    this.project.qProgram.shots = this.shots;

    const suite = new TestSuite();
    suite.id = this.project.testSuites?.length > 0 ? this.project.testSuites[0].id : crypto.randomUUID();
    suite.error_range = this.errorRange;

    const entryIdxs = this.inputQubitsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const outputIdxs = this.outputQubitsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

    if (this.testSuiteType === 'DETERMINISTIC') {
      suite.testCases = this.testCases.map(tc => {
        const det = new Deterministic();
        det.id = tc.id || crypto.randomUUID();
        det.entryIndexes = entryIdxs;
        det.outputIndexes = outputIdxs;
        det.entryValues = this.getBitsArray(tc.input, entryIdxs.length);
        det.expectedValues = this.getBitsArray(tc.expected, outputIdxs.length);
        return det;
      });
    } else {
      const stoch = new Stochastic();
      stoch.id = this.project.testSuites?.[0]?.testCases?.[0]?.id || crypto.randomUUID();
      stoch.entryIndexes = entryIdxs;
      stoch.outputIndexes = outputIdxs;
      const distObj: { [key: string]: number } = {};
      this.testCases.forEach(tc => {
        if (tc.expected) {
          const cleanExpected = this.getBitsArray(tc.expected, outputIdxs.length).join(',');
          distObj[`[${cleanExpected}]`] = tc.probability || 0;
        }
      });
      stoch.probabilityDistribution = distObj as any;
      suite.testCases = [stoch];
    }

    this.project.testSuites = [suite];
  }

  runTests() {
    if (this.testCases.length === 0) {
      this.manager.showNotification('The test suite is empty.', 'error', 3000);
      return;
    }

    this.isRunningTests = true;
    this.clearResults();
    this.manager.showNotification('Running quantum tests...', 'loading');

    this.getConvertedCodeObservable().subscribe({
      next: (res) => {
        this.syncTestSuiteToProject(res.code);

        const inputs = this.inputQubitsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        const outputs = this.outputQubitsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

        let testSuitePayload = '';
        if (this.testSuiteType === 'DETERMINISTIC') {
          const arrayRepr = this.testCases.map(tc => {
            const inpArr = this.getBitsArray(tc.input, inputs.length);
            const outArr = this.getBitsArray(tc.expected, outputs.length);
            return `[${JSON.stringify(inpArr)}, ${JSON.stringify(outArr)}]`;
          });
          testSuitePayload = `[${arrayRepr.join(', ')}]`;
        } else {
          const arrayRepr = this.testCases.map(tc => {
            const outArr = this.getBitsArray(tc.expected, outputs.length);
            const probVal = (tc.probability || 0) / 100.0;
            return `[${JSON.stringify(outArr)}, ${probVal}]`;
          });
          testSuitePayload = `[${arrayRepr.join(', ')}]`;
        }

        const request = {
          circuitCode: res.code,
          inputs,
          outputs,
          testSuite: testSuitePayload,
          shots: this.shots,
          initValues: null
        };

        if (this.testSuiteType === 'DETERMINISTIC') {
          this.quteExecution.runDeterministic(request).subscribe({
            next: (runRes) => {
              this.deterministicVerdicts = runRes.verdicts;
              this.testRunSuccess = true;
              this.isRunningTests = false;
              this.activeSection = 'results';
              this.manager.showNotification('Tests completed.', 'success', 3000);
            },
            error: (err) => {
              console.error(err);
              this.manager.showNotification('Error executing tests: ' + (err.error ? err.error.error : err.message), 'error', 5000);
              this.isRunningTests = false;
            }
          });
        } else {
          const stochRequest = { ...request, errorRange: this.errorRange };
          this.quteExecution.runStochastic(stochRequest).subscribe({
            next: (runRes) => {
              this.stochasticResults = runRes.percentages;
              this.testRunSuccess = true;
              this.isRunningTests = false;
              this.activeSection = 'results';
              this.manager.showNotification('Tests completed.', 'success', 3000);
            },
            error: (err) => {
              console.error(err);
              this.manager.showNotification('Error executing tests: ' + (err.error ? err.error.error : err.message), 'error', 5000);
              this.isRunningTests = false;
            }
          });
        }
      },
      error: (err) => {
        this.isRunningTests = false;
        this.manager.showNotification(err.message, 'error', 4000);
      }
    });
  }

  // --- Qubit helpers ---
  getInputQubitsCount(): number {
    if (!this.inputQubitsStr) return 0;
    return this.inputQubitsStr.split(',').map(s => s.trim()).filter(s => s !== '').length;
  }

  getOutputQubitsCount(): number {
    if (!this.outputQubitsStr) return 0;
    return this.outputQubitsStr.split(',').map(s => s.trim()).filter(s => s !== '').length;
  }

  getBitsArray(valStr: string, count: number): number[] {
    if (count <= 0) return [];
    const parts = (valStr || '').split(',').map(s => s.trim()).filter(s => s !== '');
    const arr: number[] = [];
    for (let i = 0; i < count; i++) {
      if (i < parts.length) {
        const val = parseInt(parts[i]);
        arr.push(isNaN(val) ? 0 : (val === 1 ? 1 : 0));
      } else {
        arr.push(0);
      }
    }
    return arr;
  }

  toggleBit(tc: any, type: 'input' | 'expected', index: number) {
    const count = type === 'input' ? this.getInputQubitsCount() : this.getOutputQubitsCount();
    const bits = this.getBitsArray(tc[type], count);
    if (index >= 0 && index < bits.length) {
      bits[index] = bits[index] === 1 ? 0 : 1;
      tc[type] = bits.join(',');
      this.manager.markProjectAsModified();
    }
  }

  getStochasticTotalProbability(): number {
    let total = 0;
    this.testCases.forEach(tc => {
      if (tc.type === 'STOCHASTIC') total += tc.probability || 0;
    });
    return Math.round(total * 100) / 100;
  }

  getDeterministicPassCount(): number {
    return this.deterministicVerdicts.filter(v => v.verdict).length;
  }

  getDeterministicPassRate(): number {
    if (this.deterministicVerdicts.length === 0) return 0;
    const count = this.getDeterministicPassCount();
    return Math.round((count / this.deterministicVerdicts.length) * 100);
  }

  isLoggedIn(): boolean {
    return this.userService.isAuthenticated$.value;
  }
}
