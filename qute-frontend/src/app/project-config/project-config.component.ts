import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppComponent } from '../app.component';
import { ManagerService } from '../services/manager.service';
import { ReperService } from '../services/reper.service';
import { UserService } from '../services/user.service';
import { ConverterService } from '../services/converter.service';
import { Project } from '../model/Project';

@Component({
  selector: 'app-project-config',
  templateUrl: './project-config.component.html',
  styleUrls: ['./project-config.component.css']
})
export class ProjectConfigComponent implements OnInit, OnDestroy {

  project: Project | null = null;

  // Circuit fields
  quirkCodeText: string = '';
  circuitCode: string = '';
  inputQubitsStr: string = '';
  outputQubitsStr: string = '';

  // Qubit selections
  qubitsIndices: number[] = [];
  inputQubitsSelection: { [key: number]: boolean } = {};
  outputQubitsSelection: { [key: number]: boolean } = {};
  qubitCount: number = 0;

  // Inline name editing
  editingName: boolean = false;
  projectNameCache: string = '';

  @ViewChild('nameInput') nameInput?: ElementRef<HTMLInputElement>;

  private subscription = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public manager: ManagerService,
    private reperService: ReperService,
    private userService: UserService,
    private converterService: ConverterService
  ) { }

  ngOnInit(): void {
    this.subscription.add(
      this.route.paramMap.subscribe(params => {
        const projectId = params.get('projectId');
        if (projectId) {
          this.subscription.add(
            this.manager.projects$.subscribe(projects => {
              const found = projects.find(p => p.id === projectId);
              if (found) {
                if (this.manager.selectedProject !== found) {
                  this.manager.setselectedProject(found);
                }
              } else {
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

    // Load Quirk JSON code
    if (this.project.qProgram?.qCircuit?.textQuirkCode) {
      try {
        const parsed = JSON.parse(this.project.qProgram.qCircuit.textQuirkCode);
        this.quirkCodeText = JSON.stringify(parsed, null, 2);
      } catch (e) {
        this.quirkCodeText = this.project.qProgram.qCircuit.textQuirkCode;
      }
    } else if (this.project.qProgram?.qCircuit?.quirkCode) {
      try {
        const parsed = typeof this.project.qProgram.qCircuit.quirkCode === 'string'
          ? JSON.parse(this.project.qProgram.qCircuit.quirkCode)
          : this.project.qProgram.qCircuit.quirkCode;
        this.quirkCodeText = JSON.stringify(parsed, null, 2);
      } catch (e) {
        this.quirkCodeText = typeof this.project.qProgram.qCircuit.quirkCode === 'string'
          ? this.project.qProgram.qCircuit.quirkCode
          : JSON.stringify(this.project.qProgram.qCircuit.quirkCode, null, 2);
      }
    } else {
      const firstCode = this.project.qProgram.qCodes?.[0]?.code;
      if (firstCode && firstCode.trim().startsWith('{')) {
        try {
          this.quirkCodeText = JSON.stringify(JSON.parse(firstCode), null, 2);
        } catch (e) {
          this.quirkCodeText = firstCode;
        }
      } else {
        this.quirkCodeText = '{\n  "cols": [\n    ["H"],\n    ["•", "X"]\n  ]\n}';
      }
    }

    if (this.project.qProgram?.qCodes?.length > 0) {
      this.circuitCode = this.project.qProgram.qCodes[0].code || '';
    } else {
      this.circuitCode = '';
    }

    const rawInputs = this.project.qProgram.inputQubits;
    this.inputQubitsStr = Array.isArray(rawInputs) ? rawInputs.join(',') : (rawInputs !== null && rawInputs !== undefined ? String(rawInputs) : '0,1');
    const rawOutputs = this.project.qProgram.outputQubits;
    this.outputQubitsStr = Array.isArray(rawOutputs) ? rawOutputs.join(',') : (rawOutputs !== null && rawOutputs !== undefined ? String(rawOutputs) : '0,1');
    this.loadQubitSelections();
  }

  onQuirkCodeChange(newVal: string) {
    if (!newVal) return;
    try {
      const parsed = JSON.parse(newVal);
      if (this.project) {
        this.project.qProgram.qubits = -1;
        this.project.qProgram.qCircuit.quirkCode = parsed;
        this.project.qProgram.qCircuit.textQuirkCode = newVal;
        // Clear cached qiskit code so it gets regenerated
        this.project.qProgram.qCodes = [];
        this.circuitCode = '';
        this.loadQubitSelections();
      }
      this.manager.markProjectAsModified();
    } catch (e) {
      // Ignore parse errors while typing
    }
  }

  visualizeCircuit() {
    if (this.quirkCodeText && this.quirkCodeText.trim() !== '') {
      const url = AppComponent.quirkUrl + '#circuit=' + this.quirkCodeText.trim();
      window.open(url, '_blank');
    } else {
      this.manager.showNotification('Cannot visualize circuit: no quirk code available', 'error', 3000);
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
        if (this.userService.isAuthenticated$.value) {
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
          this.manager.notifyProjectDeleted(this.project!.id!);
          this.router.navigate(['/']);
        }
      }
    });
  }

  // --- Name editing ---
  startNameEdit() {
    if (!this.project) return;
    this.projectNameCache = this.project.name;
    this.editingName = true;
    setTimeout(() => this.nameInput?.nativeElement?.focus(), 50);
  }

  saveProjectName() {
    if (!this.project || !this.editingName) return;
    const newName = this.projectNameCache.trim();
    if (newName && newName !== this.project.name) {
      this.project.name = newName;
      this.manager.markProjectAsModified();
    }
    this.editingName = false;
  }

  cancelNameEdit() {
    this.editingName = false;
  }

  // --- Qubit selections ---
  loadQubitSelections() {
    if (!this.project) return;

    this.qubitCount = this.project.qProgram.getQubits();
    if (this.qubitCount <= 0) {
      const inputs = (this.inputQubitsStr || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      const outputs = (this.outputQubitsStr || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      const maxIndex = Math.max(-1, ...inputs, ...outputs);
      this.qubitCount = maxIndex >= 0 ? maxIndex + 1 : 2;
    }

    this.qubitsIndices = Array.from({ length: this.qubitCount }, (_, i) => i);

    this.inputQubitsSelection = {};
    const selectedInputs = (this.inputQubitsStr || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    this.qubitsIndices.forEach(i => this.inputQubitsSelection[i] = selectedInputs.includes(i));

    this.outputQubitsSelection = {};
    const selectedOutputs = (this.outputQubitsStr || '').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    this.qubitsIndices.forEach(i => this.outputQubitsSelection[i] = selectedOutputs.includes(i));
  }

  updateInputQubits() {
    const selected = this.qubitsIndices.filter(i => this.inputQubitsSelection[i]);
    this.inputQubitsStr = selected.join(',');
    if (this.project) {
      this.project.qProgram.inputQubits = this.inputQubitsStr;
      this.manager.markProjectAsModified();
    }
  }

  updateOutputQubits() {
    const selected = this.qubitsIndices.filter(i => this.outputQubitsSelection[i]);
    this.outputQubitsStr = selected.join(',');
    if (this.project) {
      this.project.qProgram.outputQubits = this.outputQubitsStr;
      this.manager.markProjectAsModified();
    }
  }

  toggleAllInputQubits() {
    const allSelected = this.qubitsIndices.every(i => this.inputQubitsSelection[i]);
    this.qubitsIndices.forEach(i => this.inputQubitsSelection[i] = !allSelected);
    this.updateInputQubits();
  }

  toggleAllOutputQubits() {
    const allSelected = this.qubitsIndices.every(i => this.outputQubitsSelection[i]);
    this.qubitsIndices.forEach(i => this.outputQubitsSelection[i] = !allSelected);
    this.updateOutputQubits();
  }
}
