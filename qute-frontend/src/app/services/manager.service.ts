import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject, Observable, of, tap, switchMap } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { Project } from '../model/Project';
import { Mutant } from '../model/Mutant';
import { QProgram } from '../model/QProgram';
import { MutantCycle } from '../model/MutantCycle';
import { QCircuit } from '../model/QCircuit';
import { ExecConfiguration } from '../model/ExecConfiguration';
import { ProjectNote } from '../model/ProjectNote';
import { TestSuite } from '../model/TestSuite';
import { Deterministic } from '../model/Deterministic';
import { Stochastic } from '../model/Stochastic';
import { ReperService } from './reper.service';
import * as localforage from 'localforage';


@Injectable({
  providedIn: 'root'
})
export class ManagerService {
  selectedProject?: Project;

  // List of all loaded projects
  projects: Project[] = [];
  private _projects = new BehaviorSubject<Project[]>([]);
  public projects$ = this._projects.asObservable();
  loadingProjects = false;
  private projectsCache$: Observable<Project[]> | null = null;
  private currentEmailForProjects: string | null = null;

  mutants: Mutant[] = []

  // Subject para notificar cuando se agrega un nuevo circuito
  private newCircuitSubject = new Subject<QProgram>();
  public newCircuit$ = this.newCircuitSubject.asObservable();

  // Subject para notificar cuando se elimina un proyecto
  private projectDeletedSubject = new Subject<string>();
  public projectDeleted$ = this.projectDeletedSubject.asObservable();

  private _selectedMutant = new BehaviorSubject<Mutant | null>(null);
  private _selectedProject = new BehaviorSubject<Project | null>(null);
  private _selectedMutantCycle = new BehaviorSubject<MutantCycle | null>(null);

  // BehaviorSubject para el estado de guardado del proyecto actual
  private _projectSavedState = new BehaviorSubject<boolean>(true);
  public projectSavedState$ = this._projectSavedState.asObservable();

  // Observable público para suscribirse
  public selectedMutant$ = this._selectedMutant.asObservable();

  public selectedProject$ = this._selectedProject.asObservable();
  public selectedMutantCycle$ = this._selectedMutantCycle.asObservable();

  showHome: boolean = true
  showCircuit: boolean = false
  showSidebar: boolean = false
  sidebarExpanded: boolean = false
  inputQubits: string = ""
  outputQubits: string = ""
  qubitCount: number = 0
  qubits: number[] = []
  shots: number = 100

  executionAlgorithm: string = "AllAgainstAll"
  toleratedError: number = 0.05
  generateWithAllInputs: boolean = false;

  showMutantsInfo: boolean = false;
  showMutantCycleInfo: boolean = false;
  showSaveButton: boolean = false;
  isProjectLoading: boolean = false;

  constructor(private reperService: ReperService) { }

  /**
   * Loads projects from the backend for the current user (by email).
   */
  loadProjects(email: string, forceRefresh = false): Observable<Project[]> {
    if (this.projectsCache$ && this.currentEmailForProjects === email && !forceRefresh) {
      return this.projectsCache$;
    }

    this.loadingProjects = true;
    this.currentEmailForProjects = email;

    this.projectsCache$ = this.reperService.getSidebarCircuits(email).pipe(
      tap(data => {
        this.projects = this.processSidebarProjectData(data);
        this._projects.next(this.projects);
        this.loadingProjects = false;
      }),
      shareReplay(1)
    );

    return this.projectsCache$;
  }

  /**
   * Gets a project by ID, loading it if necessary (though simplified for now, assumes loaded).
   * Typically called after loadProjects ensures data is there.
   */
  getProjectById(id: string): Project | undefined {
    return this.projects.find(p => p.id === id);
  }

  /**
   * Marca el proyecto actual como modificado (no guardado)
   * y emite el cambio de estado
   */
  markProjectAsModified(project?: Project): void {
    const targetProject = project || this.selectedProject;

    if (targetProject) {
      targetProject.markAsModified();

      // Only update UI if the modified project is the currently selected one
      if (this.selectedProject && this.selectedProject === targetProject) {
        this._projectSavedState.next(false);
        this.showSaveButton = true;
        this.cacheProjectLocally(targetProject);
      }
    }
  }

  /**
   * Marca el proyecto actual como guardado
   * y emite el cambio de estado
   */
  markProjectAsSaved(): void {
    if (this.selectedProject) {
      this.selectedProject.markAsSaved();
      this._projectSavedState.next(true);
      this.showSaveButton = false;
    }
  }

  markMutantCyclesAsSaved(): void {
    if (this.selectedProject && this.selectedProject.mutantCycles) {
      this.selectedProject.mutantCycles.forEach(mc => mc.newlyGenerated = false);
    }
  }

  notifyProjectDeleted(projectId: string): void {
    localforage.removeItem(`qumu_project_${projectId}`).catch(e => console.warn("Error removing project cache", e));
    this.projects = this.projects.filter(p => p.id !== projectId);
    this._projects.next(this.projects);
    this.projectDeletedSubject.next(projectId);
  }

  /**
   * Obtiene el estado de guardado del proyecto actual
   */
  get isProjectSaved(): boolean {
    return this.selectedProject?.saved ?? true;
  }

  public cacheProjectLocally(project: Project): void {
    if (project && project.id) {
      localforage.setItem(`qumu_project_${project.id}`, project).catch(e => {
        console.warn("Could not cache project to localForage", e);
      });
    }
  }

  async setselectedProject(circuit: Project) {
    // Si el proyecto viene del sidebar, no está "completo".
    // El modelo Project inicializa qProgram y testSuites con objetos vacíos.
    // La forma más segura de saber si es ligero es comprobar si textQuirkCode está vacío/indefinido
    // y si no hay testSuites reales.
    const isLightweight = circuit && circuit.id &&
      (!circuit.qProgram || !circuit.qProgram.qCircuit || !circuit.qProgram.qCircuit.textQuirkCode) &&
      (!circuit.testSuites || circuit.testSuites.length === 0);

    if (isLightweight) {
      this.isProjectLoading = true;

      try {
        const cachedItem = await localforage.getItem<any>(`qumu_project_${circuit.id}`);
        if (cachedItem) {
          const fullyLoadedCircuitArr = this.processProjectData([cachedItem]);
          if (fullyLoadedCircuitArr.length > 0) {
            const loadedProject = fullyLoadedCircuitArr[0];
            loadedProject.saved = circuit.saved; // Restablecer estado visual anterior

            // Sustituir en la lista de projects de manera transparente
            const index = this.projects.findIndex(p => p.id === loadedProject.id);
            if (index !== -1) {
              this.projects[index] = loadedProject;
              this._projects.next(this.projects);
            }
            this._finalizeSetSelectedProject(loadedProject);
            this.isProjectLoading = false;
            return;
          }
        }
      } catch (e) {
        console.warn("Failed to reconstruct cached project from localForage", e);
      }

      // Si no está en caché local, hay que descargarlo entero del servidor.
      const email = sessionStorage.getItem('email');
      if (email) {
        this.reperService.getProject(email, circuit.id!).subscribe({
          next: (fullCircuitData) => {
            // fullCircuitData is raw JSON from backend
            const fullyLoadedCircuitArr = this.processProjectData([fullCircuitData]);
            if (fullyLoadedCircuitArr.length > 0) {
              const loadedProject = fullyLoadedCircuitArr[0];

              // Guardar en la caché local
              this.cacheProjectLocally(loadedProject);

              // Sustituir en la vista
              const index = this.projects.findIndex(p => p.id === loadedProject.id);
              if (index !== -1) {
                this.projects[index] = loadedProject;
                this._projects.next(this.projects);
              }
              this._finalizeSetSelectedProject(loadedProject);
            }
            this.isProjectLoading = false;
          },
          error: (err) => {
            console.error("Failed to lazy load project from backend", err);
            // Failsafe: fall back on what we have even if incomplete
            this._finalizeSetSelectedProject(circuit);
            this.isProjectLoading = false;
          }
        });
        return; // Finalize happens inside subscribe
      }
      this.isProjectLoading = false;
    }

    // Si estaba completo (e.g. uno que acabamos de crear con setNewselectedProject o ya estaba parseado completo)
    this._finalizeSetSelectedProject(circuit);
  }

  private _finalizeSetSelectedProject(circuit: Project) {
    this.selectedProject = circuit
    this.qubitCount = this.selectedProject.getQubits()

    // Solo procesar qubits si hay código Quirk válido
    if (this.qubitCount > 0) {
      this.qubits = Array.from({ length: this.qubitCount }, (_, i) => i);

      // Generate default "all selected" strings
      let allInputQubits = "";
      let allOutputQubits = "";
      for (let i = 0; i < this.qubitCount; i++) {
        allInputQubits += i + ",";
        allOutputQubits += i + ",";
      }
      if (allInputQubits.endsWith(",")) allInputQubits = allInputQubits.substring(0, allInputQubits.length - 1);
      if (allOutputQubits.endsWith(",")) allOutputQubits = allOutputQubits.substring(0, allOutputQubits.length - 1);

      // Input Qubits Logic: Handle Array or String
      let currentInputQubits: any = this.selectedProject.qProgram.inputQubits;
      if (Array.isArray(currentInputQubits)) {
        currentInputQubits = currentInputQubits.join(',');
      }

      if (currentInputQubits !== null && currentInputQubits !== undefined) {
        // If it exists (even if empty string `""`), we respect it
        this.inputQubits = currentInputQubits as string;
        this.selectedProject.qProgram.inputQubits = currentInputQubits; // Ensure it's stored as string
      } else {
        // Only if completely undefined we default to "0,1,2..."
        this.inputQubits = allInputQubits;
        this.selectedProject.qProgram.inputQubits = this.inputQubits;
      }

      // Output Qubits Logic: Handle Array or String
      let currentOutputQubits: any = this.selectedProject.qProgram.outputQubits;
      if (Array.isArray(currentOutputQubits)) {
        currentOutputQubits = currentOutputQubits.join(',');
      }

      if (currentOutputQubits && typeof currentOutputQubits === 'string' && currentOutputQubits.trim() !== '') {
        this.outputQubits = currentOutputQubits;
        this.selectedProject.qProgram.outputQubits = currentOutputQubits; // Ensure it's stored as string
      } else {
        this.outputQubits = allOutputQubits;
        this.selectedProject.qProgram.outputQubits = this.outputQubits;
      }

    } else {
      // Para circuitos sin código Quirk, inicializar valores por defecto
      this.qubits = []
      this.inputQubits = ""
      this.outputQubits = ""
      // Do not overwrite project properties here if they might exist? 
      // Assuming if qubitCount is 0/invalid, we probably just want safety defaults locally, 
      // but maybe we shouldn't touch project properties if we can avoid it.
      // However, the original code did overwrite.
      if (!this.selectedProject.qProgram.inputQubits) this.selectedProject.qProgram.inputQubits = "";
      if (!this.selectedProject.qProgram.outputQubits) this.selectedProject.qProgram.outputQubits = "";
    }

    // Emitir el estado de guardado del proyecto seleccionado
    this._projectSavedState.next(circuit.saved);
    this.showSaveButton = !circuit.saved;

    // Notificar a los suscriptores del cambio de circuito
    this._selectedProject.next(circuit);
  }

  setNewselectedProject(circuit: Project) {
    this.selectedProject = circuit

    // Inicializar valores por defecto para nuevo proyecto
    this.qubitCount = 0
    this.qubits = []
    this.inputQubits = ""
    this.outputQubits = ""

    if (this.selectedProject.qProgram) {
      this.selectedProject.qProgram.inputQubits = ""
      this.selectedProject.qProgram.outputQubits = ""
    }

    if (sessionStorage.getItem('email')) {
      this.showSidebar = true
    }

    // Los proyectos nuevos no están guardados
    this._projectSavedState.next(false);
    this.showSaveButton = true;

    // Add to local projects list if not present
    if (!this.projects.some(p => p.id === circuit.id)) {
      this.projects = [...this.projects, circuit];
      this._projects.next(this.projects);
    }

    // Cache local initially
    this.cacheProjectLocally(circuit);

    // Notificar a los suscriptores del nuevo circuito seleccionado
    this._selectedProject.next(circuit);
  }

  setMutants(mutants: any) {
    this.mutants = []
    console.log("Mutants received: ", mutants);
    for (let i = 0; i < mutants.length; i++) {
      let mutantIndex = mutants[i].mutantIndex;
      let mutatedColumn = mutants[i].mutatedColumn;
      let mutatedRow = mutants[i].mutatedRow;
      let mutationOperator = mutants[i].mutationOperator;
      let circuit = new QProgram(crypto.randomUUID(), mutants[i].quirk);
      circuit.qubits = mutants[i].qubits;
      circuit.inputQubits = this.inputQubits;
      circuit.outputQubits = this.outputQubits;
      circuit.qCircuit.mutableColumns = this.selectedProject?.qProgram.qCircuit.mutableColumns || "";
      circuit.qCircuit.mutableRows = this.selectedProject?.qProgram.qCircuit.mutableRows || "";
      let mutant = new Mutant(mutantIndex, mutatedColumn, mutatedRow, mutationOperator, circuit);
      this.mutants.push(mutant)

    }
    let nextId = this.selectedProject ? this.selectedProject.getNextMutantCycleId() : 0;
    let mutantPrj = new MutantCycle(this.mutants, nextId);
    mutantPrj.name = 'Mutant Cycle ' + mutantPrj.id;
    mutantPrj.newlyGenerated = true;
    this.selectedProject?.mutantCycles.push(mutantPrj);

    // Marcar como modificado al agregar mutantes
    this.markProjectAsModified();
  }

  getNumberOfInputQubits() {
    return this.inputQubits.split(",").length
  }

  // Getter para compatibilidad
  get selectedMutant(): Mutant | null {
    return this._selectedMutant.value;
  }

  // Método para actualizar el mutante seleccionado
  setSelectedMutant(mutant: Mutant | null): void {
    this._selectedMutant.next(mutant);
  }

  // Getter para MutantCycle seleccionado
  get selectedMutantCycle(): MutantCycle | null {
    return this._selectedMutantCycle.value;
  }

  // Método para actualizar el MutantCycle seleccionado
  setSelectedMutantCycle(mutantCycle: MutantCycle | null): void {
    this._selectedMutantCycle.next(mutantCycle);
  }

  // --- Global Confirmation Modal Management ---

  modalState = {
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'info' as 'info' | 'warning' | 'danger',
    onConfirm: () => { },
    onCancel: () => { }
  };

  openConfirmationModal(config: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'info' | 'warning' | 'danger';
    onConfirm: () => void;
    onCancel?: () => void;
  }) {
    this.modalState = {
      isOpen: true,
      title: config.title,
      message: config.message,
      confirmText: config.confirmText || 'Confirm',
      cancelText: config.cancelText || 'Cancel',
      type: config.type || 'info',
      onConfirm: config.onConfirm,
      onCancel: config.onCancel || (() => { })
    };
  }

  closeConfirmationModal() {
    this.modalState.isOpen = false;
  }

  confirmModal() {
    if (this.modalState.onConfirm) {
      this.modalState.onConfirm();
    }
    this.closeConfirmationModal();
  }

  cancelModal() {
    if (this.modalState.onCancel) {
      this.modalState.onCancel();
    }
    this.closeConfirmationModal();
  }

  // --- Execution Status Notification ---

  notification = {
    message: '',
    type: 'loading' as 'loading' | 'success' | 'error',
    visible: false
  };

  private notificationTimeout: any;

  showNotification(message: string, type: 'loading' | 'success' | 'error', duration: number = 0): void {
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }


    this.notification = {
      message,
      type,
      visible: true
    };

    if (duration > 0) {
      this.notificationTimeout = setTimeout(() => {
        this.closeNotification();
      }, duration);
    }
  }

  closeNotification(): void {
    this.notification.visible = false;
  }

  // Legacy support for simple string binding if needed, or mapped to new system
  get executionStatus(): string | null {
    return this.notification.visible ? this.notification.message : null;
  }

  setExecutionStatus(message: string): void {
    // Default legacy call maps to loading with 5s timeout as per user request for "Running"
    // But better to control explicitly. For backward compatibility with what I just wrote:
    this.showNotification(message, 'loading', 5000);
  }

  clearExecutionStatus(): void {
    this.closeNotification();
  }

  // Helper method to process loaded projects (moved from SideBarComponent)
  processProjectData(data: any[]): Project[] {
    return data.map((circuitData: any) => {
      // Deep mapping to classes
      const project = new Project(undefined, undefined, undefined, undefined, true);
      project.id = circuitData.id;
      project.name = circuitData.name;

      // QProgram
      if (circuitData.qProgram) {
        const qProgram = new QProgram();
        Object.assign(qProgram, circuitData.qProgram);

        // QCircuit
        if (circuitData.qProgram.qCircuit) {
          const qCircuit = new QCircuit(circuitData.qProgram.qCircuit.id, circuitData.qProgram.qCircuit.quirkCode);
          qProgram.qCircuit = qCircuit;
        }
        project.qProgram = qProgram;
      }

      // MutantCycles
      project.mutantCycles = (circuitData.mutantCycles || []).map((cycleData: any) => {
        const mutantCycle = new MutantCycle();
        mutantCycle.id = cycleData.id;
        mutantCycle.name = cycleData.name || ('Mutant Cycle ' + cycleData.id);
        mutantCycle.date = cycleData.date;
        mutantCycle.execConfiguration = new ExecConfiguration(cycleData.execConfiguration);

        // Mutants
        mutantCycle.mutants = (cycleData.mutants || []).map((mutantData: any) => {
          const mutant = new Mutant();
          mutant.id = mutantData.id;
          mutant.mutantResults = mutantData.mutantResults;
          mutant.mutantIndex = mutantData.mutantIndex;
          mutant.mutatedColumn = mutantData.mutatedColumn;
          mutant.mutatedRow = mutantData.mutatedRow;
          if (mutantData.operator) {
            mutant.operator.name = mutantData.operator.name;
            mutant.mutationOperator = mutantData.operator.name;
            mutant.operator.id = mutantData.operator.type;
            mutant.operator.enabled = mutantData.operator.enabled;
            mutant.operator.description = mutantData.operator.description;
          }


          // Circuit (QProgram)
          if (mutantData.circuit) {
            const mutantQProgram = new QProgram();
            Object.assign(mutantQProgram, mutantData.circuit);

            if (mutantData.circuit.qCircuit) {
              const mutantQCircuit = new QCircuit(mutantData.circuit.qCircuit.id, mutantData.circuit.qCircuit.quirkCode);
              mutantQProgram.qCircuit = mutantQCircuit;
            }
            mutant.circuit = mutantQProgram;
          }
          return mutant;
        });

        return mutantCycle;
      });

      if (circuitData.projectNotes) {
        project.projectNotes = (circuitData.projectNotes || []).map((noteData: any) => {
          const note = new ProjectNote(
            noteData.title,
            noteData.text,
            noteData.type,
            noteData.id,
            new Date(noteData.timestamp)
          );
          return note;
        });
      }

      // TestSuites
      if (circuitData.testSuites) {
        project.testSuites = (circuitData.testSuites || []).map((testSuiteData: any) => {
          const testSuite = new TestSuite();
          testSuite.id = testSuiteData.id;
          testSuite.error_range = testSuiteData.error_range;

          // TestCases
          testSuite.testCases = (testSuiteData.testCases || []).map((testCaseData: any) => {
            let testCase: any = null; // Typing loosely to avoid circular dep issues in this snippet
            if (testCaseData.type === 'DETERMINISTIC') {
              testCase = new Deterministic();
              testCase.entryValues = testCaseData.entryValues;
              testCase.expectedValues = testCaseData.expectedValues;
            } else if (testCaseData.type === 'STOCHASTIC') {
              testCase = new Stochastic();
              testCase.probabilityDistribution = testCaseData.probabilityDistribution;
            }

            if (testCase) {
              testCase.id = testCaseData.id;
              testCase.entryIndexes = testCaseData.entryIndexes;
              testCase.outputIndexes = testCaseData.outputIndexes;
            }
            return testCase;
          }).filter((tc: any) => tc !== null);

          return testSuite;
        });
      }

      return project;
    });
  }

  // Simplified mapper for sidebar data to ensure missing relationships do not crash
  processSidebarProjectData(data: any[]): Project[] {
    return data.map((circuitData: any) => {
      // By using true for fromServer, we avoid prompting save on load
      const project = new Project(undefined, undefined, undefined, undefined, true);
      project.id = circuitData.id;
      project.name = circuitData.name;

      project.mutantCycles = (circuitData.mutantCycles || []).map((cycleData: any) => {
        const mutantCycle = new MutantCycle();
        mutantCycle.id = cycleData.id;
        mutantCycle.name = cycleData.name || ('Mutant Cycle ' + cycleData.id);

        mutantCycle.mutants = (cycleData.mutants || []).map((mutantData: any) => {
          const mutant = new Mutant();
          mutant.mutantIndex = mutantData.mutantIndex;
          if (mutantData.operator) {
            mutant.operator.name = mutantData.operator.name;
            mutant.mutationOperator = mutantData.operator.name;
          }
          return mutant;
        });

        return mutantCycle;
      });

      return project;
    });
  }

  clearProjects(): void {
    this.projects = [];
    this._projects.next(this.projects);
    this.selectedProject = undefined;
    this._selectedProject.next(null);
    this._selectedMutant.next(null);
    this._selectedMutantCycle.next(null);
    this.mutants = [];
    this.qubitCount = 0;
    this.qubits = [];
    this.inputQubits = "";
    this.outputQubits = "";
    this.showSaveButton = false;
    this.currentEmailForProjects = null;
    this.projectsCache$ = null;
  }
}




