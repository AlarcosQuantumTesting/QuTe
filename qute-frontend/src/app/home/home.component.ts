import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ManagerService } from '../services/manager.service';
import { Project } from '../model/Project';
import { UserService } from '../services/user.service';
import { QProgram } from '../model/QProgram';
import { QCode } from '../model/QCode';
import { TestSuite } from '../model/TestSuite';
import { Stochastic } from '../model/Stochastic';
import { Deterministic } from '../model/Deterministic';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  activePreset: string = 'stochastic';
  copied: boolean = false;

  presets = {
    stochastic: {
      type: 'Pruebas Estocásticas',
      name: 'Validación Probabilística de Salidas',
      description: 'Valida la distribución de probabilidad de los estados de salida del circuito. En lugar de una coincidencia estricta, se definen los porcentajes esperados para cada estado (ej. 50% de probabilidad para |00⟩ y |11⟩) con un margen de tolerancia (ej. ±5.0%) al ejecutar simulaciones Aer.',
      code: `from qiskit import QuantumCircuit\n\ndef create_cut_circuit():\n    qc = QuantumCircuit(2)\n    qc.h(0)\n    qc.cx(0, 1)\n    return qc\n`,
      quirkCode: { cols: [["H"], ["•", "X"]] },
      qubits: 2,
      inputQubits: '0,1',
      outputQubits: '0,1',
      testConfig: {
        type: 'ESTOCÁSTICA',
        shots: 1024,
        tolerance: '±5.0%',
        expectations: '[0,0]:50%; [1,1]:50%'
      },
      probabilities: [
        { state: '00', pct: 50 },
        { state: '01', pct: 0 },
        { state: '10', pct: 0 },
        { state: '11', pct: 50 }
      ]
    },
    deterministic: {
      type: 'Pruebas Deterministas',
      name: 'Mapeo Exacto de Transición de Estados',
      description: 'Verifica la correspondencia lógica del circuito cuántico para entradas binarias específicas. Define bits de entrada específicos y aserta de forma estricta que la salida tras la ejecución simule el bit de salida objetivo con una precisión del 100%.',
      code: `from qiskit import QuantumCircuit\n\ndef create_cut_circuit():\n    qc = QuantumCircuit(1)\n    qc.x(0)\n    return qc\n`,
      quirkCode: { cols: [["X"]] },
      qubits: 1,
      inputQubits: '0',
      outputQubits: '0',
      testConfig: {
        type: 'DETERMINISTA',
        shots: 100,
        tolerance: '0.0%',
        expectations: 'Entrada: [0] ➔ Esperado: [1]'
      },
      probabilities: [
        { state: '0', pct: 0 },
        { state: '1', pct: 100 }
      ]
    },
    mutation: {
      type: 'Análisis de Mutación',
      name: 'Evaluación de Robustez de la Suite',
      description: 'Mide la efectividad de los casos de prueba inyectando fallos lógicos sutiles en el circuito (ej. cambiar compuertas o alterar conexiones). Si la suite detecta la diferencia entre el comportamiento del mutante y el circuito correcto, el mutante es catalogado como KILLED.',
      code: `from qiskit import QuantumCircuit\n\n# original: qc.h(0); qc.cx(0, 1)\n# mutant:   qc.id(0); qc.cx(0, 1) # Fallo de compuerta omitida\n\ndef create_mutated_circuit():\n    qc = QuantumCircuit(2)\n    qc.id(0) # Inyección de mutante\n    qc.cx(0, 1)\n    return qc\n`,
      quirkCode: { cols: [["H"], ["•", "X"]] },
      qubits: 2,
      inputQubits: '0,1',
      outputQubits: '0,1',
      testConfig: {
        type: 'CICLO DE MUTACIÓN',
        shots: 1024,
        tolerance: 'Ejecución Mutante',
        expectations: 'Mutantes: 3 | Muertos: 2 | Supervivientes: 1'
      },
      probabilities: [
        { state: 'Mutante: Quitar H', pct: 100, killed: true },
        { state: 'Mutante: Quitar CNOT', pct: 100, killed: true },
        { state: 'Mutante: Cambio de Fase', pct: 0, killed: false }
      ]
    }
  };

  constructor(public manager: ManagerService, public userService: UserService, private router: Router) { }

  ngOnInit(): void {
    if (this.userService.isAuthenticated$.value) {
      this.manager.showSidebar = true;
    }
  }

  get currentPreset() {
    return (this.presets as any)[this.activePreset];
  }

  selectPreset(key: string) {
    this.activePreset = key;
    this.copied = false;
  }

  copyCodeToClipboard(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    });
  }

  createCircuit() {
    let circuit = new Project(crypto.randomUUID(), "New Project");
    this.manager.setNewselectedProject(circuit);

    if (this.userService.isAuthenticated$.value) {
      this.manager.showSidebar = true;
    }

    this.router.navigate(['/project', circuit.id]);
  }

  launchPreset(key: string) {
    const preset = (this.presets as any)[key];
    if (!preset) return;

    // Use Bell state for stochastic/mutation presets, and X gate for deterministic preset
    const presetKey = key === 'mutation' ? 'stochastic' : key;
    const activePresetData = (this.presets as any)[presetKey];

    // Create project container
    const project = new Project(crypto.randomUUID(), activePresetData.type + " Project");
    
    // Select in manager initially
    this.manager.setNewselectedProject(project);

    // Populate actual fields on selected project to avoid them being reset
    if (this.manager.selectedProject) {
      const qProg = this.manager.selectedProject.qProgram;
      qProg.qubits = activePresetData.qubits;
      qProg.inputQubits = activePresetData.inputQubits;
      qProg.outputQubits = activePresetData.outputQubits;
      qProg.shots = 1024;
      
      if (activePresetData.quirkCode) {
        qProg.qCircuit.quirkCode = activePresetData.quirkCode;
        qProg.qCircuit.textQuirkCode = JSON.stringify(activePresetData.quirkCode, null, 2);
      }

      const qCode = new QCode(undefined, activePresetData.code, 'QuTe');
      qProg.qCodes = [qCode];

      // Update manager properties
      this.manager.inputQubits = activePresetData.inputQubits;
      this.manager.outputQubits = activePresetData.outputQubits;
      this.manager.qubitCount = activePresetData.qubits;
      this.manager.qubits = Array.from({ length: activePresetData.qubits }, (_, i) => i);
      this.manager.shots = 1024;

      // Add TestSuite with test cases matching preset outcomes
      const suite = new TestSuite();
      suite.error_range = 5.0;

      if (presetKey === 'stochastic') {
        const tc = new Stochastic();
        tc.entryIndexes = activePresetData.inputQubits.split(',').map((x: string) => parseInt(x));
        tc.outputIndexes = activePresetData.outputQubits.split(',').map((x: string) => parseInt(x));
        
        const dist = {
          '[0,0]': 50,
          '[1,1]': 50
        };
        (tc as any).probDistributionStr = '[0,0]:50;[1,1]:50';
        
        tc.probabilityDistribution = dist as any;
        suite.testCases = [tc];
      } else {
        const tc = new Deterministic();
        tc.entryIndexes = [0];
        tc.outputIndexes = [0];
        tc.entryValues = [0];
        tc.expectedValues = [1];
        suite.testCases = [tc];
      }
      this.manager.selectedProject.testSuites = [suite];

      // Store project locally
      this.manager.cacheProjectLocally(this.manager.selectedProject);
    }

    if (this.userService.isAuthenticated$.value) {
      this.manager.showSidebar = true;
    }
    this.router.navigate(['/project', project.id]);
  }

  selectCircuit(circuit: Project): void {
    this.manager.setselectedProject(circuit);
    this.router.navigate(['/project', circuit.id]);
  }

  isLoggedIn(): boolean {
    return this.userService.isAuthenticated$.value;
  }

  get email(): string | null {
    return sessionStorage.getItem('email');
  }

  get circuits(): Project[] {
    return this.manager.projects;
  }

  navigateToLogin(): void {
    window.location.href = environment.loginUrl;
  }
}


