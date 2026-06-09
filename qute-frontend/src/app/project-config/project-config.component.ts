import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ManagerService } from '../services/manager.service';
import { ReperService } from '../services/reper.service';
import { QuteExecutionService } from '../services/qute-execution.service';
import { ConverterService } from '../services/converter.service';
import { UserService } from '../services/user.service';
import { Project } from '../model/Project';
import { QProgram } from '../model/QProgram';
import { QCode } from '../model/QCode';
import { TestSuite } from '../model/TestSuite';
import { Deterministic } from '../model/Deterministic';
import { Stochastic } from '../model/Stochastic';

@Component({
  selector: 'app-project-config',
  templateUrl: './project-config.component.html',
  styleUrls: ['./project-config.component.css']
})
export class ProjectConfigComponent implements OnInit, OnDestroy {

  selectedTab: 'circuit' | 'test-suite' | 'results' | 'converter' = 'circuit';
  project: Project | null = null;
  
  // Circuit fields
  circuitCode: string = '';
  inputQubitsStr: string = '';
  outputQubitsStr: string = '';
  cutImageBase64: string | null = null;
  qtccImageBase64: string | null = null;
  isValidating: boolean = false;
  isDrawing: boolean = false;
  validationResult: { valid: boolean; qubits?: number; error?: string } | null = null;

  // Test Suite fields
  shots: number = 1024;
  errorRange: number = 5.0;
  initValuesStr: string = '';
  testCases: any[] = [];
  testSuiteType: 'DETERMINISTIC' | 'STOCHASTIC' = 'DETERMINISTIC';

  // Converter fields
  quirkJsonInput: string = '';
  converterLanguage: 'qiskit' | 'qsharp' = 'qiskit';
  convertedCodeOutput: string = '';
  isConverting: boolean = false;

  // Results fields
  isRunningTests: boolean = false;
  deterministicLogs: string[] = [];
  stochasticResults: any[] = [];
  testRunSuccess: boolean = false;

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
      this.route.paramMap.subscribe(params => {
        const projectId = params.get('projectId');
        if (projectId) {
          // Check if project exists in list, else load it
          this.subscription.add(
            this.manager.projects$.subscribe(projects => {
              const found = projects.find(p => p.id === projectId);
              if (found) {
                if (this.manager.selectedProject !== found) {
                  this.manager.setselectedProject(found);
                }
              } else {
                // If not found in manager and user is authenticated, we trigger backend load
                const email = sessionStorage.getItem('email');
                if (email && !this.manager.loadingProjects) {
                  this.manager.loadProjects(email, true).subscribe();
                }
              }
            })
          );
        }
      })
    );

    this.subscription.add(
      this.manager.selectedProject$.subscribe(proj => {
        if (proj) {
          this.project = proj;
          this.loadProjectFields();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  loadProjectFields() {
    if (!this.project) return;

    // Load circuit code from QCodes (standard structure: project.qProgram.qCodes[0].code)
    if (this.project.qProgram && this.project.qProgram.qCodes && this.project.qProgram.qCodes.length > 0) {
      this.circuitCode = this.project.qProgram.qCodes[0].code || '';
    } else {
      // Default template code
      this.circuitCode = `from qiskit import QuantumCircuit\n\ndef create_cut_circuit():\n    qc = QuantumCircuit(2)\n    qc.h(0)\n    qc.cx(0, 1)\n    return qc\n`;
    }

    // Input/output indexes
    this.inputQubitsStr = this.project.qProgram.inputQubits || '0,1';
    this.outputQubitsStr = this.project.qProgram.outputQubits || '0,1';
    this.shots = this.project.qProgram.shots || 1024;

    // Load TestSuite
    if (this.project.testSuites && this.project.testSuites.length > 0) {
      const suite = this.project.testSuites[0];
      this.errorRange = suite.error_range || 5.0;
      
      // Determine type based on first test case
      if (suite.testCases && suite.testCases.length > 0) {
        this.testSuiteType = (suite.testCases[0].type as 'DETERMINISTIC' | 'STOCHASTIC') || 'DETERMINISTIC';
        this.testCases = suite.testCases.map((tc: any) => {
          if (tc.type === 'DETERMINISTIC') {
            return {
              id: tc.id || crypto.randomUUID(),
              type: 'DETERMINISTIC',
              input: Array.isArray(tc.entryValues) ? tc.entryValues.join(',') : '',
              expected: Array.isArray(tc.expectedValues) ? tc.expectedValues.join(',') : ''
            };
          } else {
            // Stochastic
            let probStr = '';
            if (tc.probabilityDistribution) {
              const keys = Object.keys(tc.probabilityDistribution);
              if (keys.length > 0) {
                probStr = keys.map(k => `${k}:${tc.probabilityDistribution[k]}`).join(';');
              }
            }
            return {
              id: tc.id || crypto.randomUUID(),
              type: 'STOCHASTIC',
              probDistributionStr: probStr
            };
          }
        });
      } else {
        this.testCases = [];
      }
    } else {
      this.testCases = [];
      this.errorRange = 5.0;
    }

    this.clearResults();
  }

  clearResults() {
    this.deterministicLogs = [];
    this.stochasticResults = [];
    this.testRunSuccess = false;
    this.cutImageBase64 = null;
    this.qtccImageBase64 = null;
  }

  saveProject() {
    if (!this.project) return;

    // Save fields back to project model
    this.project.qProgram.inputQubits = this.inputQubitsStr;
    this.project.qProgram.outputQubits = this.outputQubitsStr;
    this.project.qProgram.shots = this.shots;

    // Save QCodes
    const qCode = new QCode();
    qCode.platform = 'qiskit';
    qCode.code = this.circuitCode;
    this.project.qProgram.qCodes = [qCode];

    // Save TestSuite
    const suite = new TestSuite();
    suite.id = this.project.testSuites && this.project.testSuites.length > 0 ? this.project.testSuites[0].id : crypto.randomUUID();
    suite.error_range = this.errorRange;

    suite.testCases = this.testCases.map(tc => {
      const entryIdxs = this.inputQubitsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      const outputIdxs = this.outputQubitsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

      if (this.testSuiteType === 'DETERMINISTIC') {
        const det = new Deterministic();
        det.id = tc.id;
        det.entryIndexes = entryIdxs;
        det.outputIndexes = outputIdxs;
        det.entryValues = tc.input.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
        det.expectedValues = tc.expected.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
        return det;
      } else {
        const stoch = new Stochastic();
        stoch.id = tc.id;
        stoch.entryIndexes = entryIdxs;
        stoch.outputIndexes = outputIdxs;

        // Parse distribution e.g. "[0,0]:50;[1,1]:50"
        const distMap = new Map<string, number>();
        if (tc.probDistributionStr) {
          const parts = tc.probDistributionStr.split(';');
          parts.forEach((p: string) => {
            const kv = p.split(':');
            if (kv.length === 2) {
              distMap.set(kv[0].trim(), parseInt(kv[1].trim()));
            }
          });
        }
        stoch.probabilityDistribution = distMap;
        return stoch;
      }
    });

    this.project.testSuites = [suite];

    // Persist to server if logged in
    if (this.isLoggedIn()) {
      this.manager.showNotification('Saving project...', 'loading');
      this.reperService.save(this.project).subscribe({
        next: (savedProj) => {
          this.manager.showNotification('Project saved successfully.', 'success', 3000);
          this.manager.markProjectAsSaved();
          // Update cached copy
          this.manager.cacheProjectLocally(this.project!);
        },
        error: (err) => {
          console.error(err);
          this.manager.showNotification('Error saving project.', 'error', 3000);
        }
      });
    } else {
      // Local only saving
      this.manager.showNotification('Project saved to local memory.', 'success', 3000);
      this.manager.markProjectAsSaved();
      this.manager.cacheProjectLocally(this.project);
    }
  }

  isLoggedIn(): boolean {
    return this.userService.isAuthenticated$.value;
  }

  // Circuit actions
  validateCircuit() {
    this.isValidating = true;
    this.validationResult = null;
    this.quteExecution.validateCircuit(this.circuitCode).subscribe({
      next: (res) => {
        this.validationResult = res;
        this.isValidating = false;
      },
      error: (err) => {
        this.validationResult = { valid: false, error: err.error ? err.error.error : err.message };
        this.isValidating = false;
      }
    });
  }

  drawCircuit() {
    this.isDrawing = true;
    this.quteExecution.drawCircuit(this.circuitCode).subscribe({
      next: (res) => {
        this.cutImageBase64 = res.imageBase64;
        this.isDrawing = false;
      },
      error: (err) => {
        console.error(err);
        this.manager.showNotification('Error drawing the circuit.', 'error', 3000);
        this.isDrawing = false;
      }
    });
  }

  // Test Suite actions
  addTestCase() {
    if (this.testSuiteType === 'DETERMINISTIC') {
      this.testCases.push({
        id: crypto.randomUUID(),
        type: 'DETERMINISTIC',
        input: '0,0',
        expected: '0,0'
      });
    } else {
      this.testCases.push({
        id: crypto.randomUUID(),
        type: 'STOCHASTIC',
        probDistributionStr: '[0,0]:50;[1,1]:50'
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

  // Converter actions
  convertCircuit() {
    if (!this.quirkJsonInput) return;
    this.isConverting = true;
    this.converterService.convert({
      quirkJson: this.quirkJsonInput,
      language: this.converterLanguage
    }).subscribe({
      next: (res) => {
        this.convertedCodeOutput = res.code;
        this.isConverting = false;
      },
      error: (err) => {
        console.error(err);
        this.convertedCodeOutput = 'Conversion error: ' + (err.error ? err.error.error : err.message);
        this.isConverting = false;
      }
    });
  }

  pasteConvertedCode() {
    if (this.convertedCodeOutput) {
      this.circuitCode = this.convertedCodeOutput;
      this.selectedTab = 'circuit';
      this.manager.markProjectAsModified();
    }
  }

  // Run tests
  runTests() {
    if (this.testCases.length === 0) {
      this.manager.showNotification('The test suite is empty.', 'error', 3000);
      return;
    }

    this.isRunningTests = true;
    this.clearResults();
    this.manager.showNotification('Running quantum tests...', 'loading');

    const inputs = this.inputQubitsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const outputs = this.outputQubitsStr.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));

    // Construct python-style testsuite payload representation
    let testSuitePayload = '';
    if (this.testSuiteType === 'DETERMINISTIC') {
      const arrayRepr = this.testCases.map(tc => {
        const inpArr = tc.input.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
        const outArr = tc.expected.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n));
        return `[${JSON.stringify(inpArr)}, ${JSON.stringify(outArr)}]`;
      });
      testSuitePayload = `[${arrayRepr.join(', ')}]`;
    } else {
      const arrayRepr = this.testCases.map(tc => {
        // Stochastic structure: list of tuple/lists: (expected_bits_list, expected_prob_float_or_list)
        // We will parse: [0,0]:50;[1,1]:50 into separate items.
        // Let's create multiple cases for each defined branch of probability
        const cases: string[] = [];
        if (tc.probDistributionStr) {
          const parts = tc.probDistributionStr.split(';');
          parts.forEach((p: string) => {
            const kv = p.split(':');
            if (kv.length === 2) {
              const bits = JSON.parse(kv[0].trim());
              const prob = parseFloat(kv[1].trim()) / 100.0; // convert percentage back to 0..1
              cases.push(`[${JSON.stringify(bits)}, ${prob}]`);
            }
          });
        }
        return cases.join(', ');
      }).filter(s => s !== '');
      testSuitePayload = `[${arrayRepr.join(', ')}]`;
    }

    const request = {
      circuitCode: this.circuitCode,
      inputs: inputs,
      outputs: outputs,
      testSuite: testSuitePayload,
      shots: this.shots,
      initValues: null // To be populated if required
    };

    if (this.testSuiteType === 'DETERMINISTIC') {
      this.quteExecution.runDeterministic(request).subscribe({
        next: (res) => {
          this.deterministicLogs = res.logs;
          this.cutImageBase64 = res.cutImageBase64;
          this.qtccImageBase64 = res.qtccImageBase64;
          this.testRunSuccess = true;
          this.isRunningTests = false;
          this.manager.showNotification('Tests completed.', 'success', 3000);
        },
        error: (err) => {
          console.error(err);
          this.manager.showNotification('Error executing tests: ' + (err.error ? err.error.error : err.message), 'error', 5000);
          this.isRunningTests = false;
        }
      });
    } else {
      // Stochastic
      const stochRequest = {
        ...request,
        errorRange: this.errorRange
      };
      this.quteExecution.runStochastic(stochRequest).subscribe({
        next: (res) => {
          this.stochasticResults = res.percentages;
          this.cutImageBase64 = res.cutImageBase64;
          this.qtccImageBase64 = res.qtccImageBase64;
          this.testRunSuccess = true;
          this.isRunningTests = false;
          this.manager.showNotification('Tests completed.', 'success', 3000);
        },
        error: (err) => {
          console.error(err);
          this.manager.showNotification('Error executing tests: ' + (err.error ? err.error.error : err.message), 'error', 5000);
          this.isRunningTests = false;
        }
      });
    }
  }

  deleteProject() {
    if (!this.project || !this.project.id) return;

    this.manager.openConfirmationModal({
      title: 'Delete Project',
      message: 'Are you sure you want to delete this project? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: () => {
        if (this.isLoggedIn()) {
          this.reperService.delete(this.project!.id!).subscribe({
            next: () => {
              this.manager.notifyProjectDeleted(this.project!.id!);
              this.router.navigate(['/']);
            },
            error: (err) => {
              console.error(err);
              this.manager.showNotification('Error deleting project.', 'error', 3000);
            }
          });
        } else {
          // Local only delete
          this.manager.notifyProjectDeleted(this.project!.id!);
          this.router.navigate(['/']);
        }
      }
    });
  }

  selectTab(tab: 'circuit' | 'test-suite' | 'results' | 'converter') {
    this.selectedTab = tab;
  }
}
