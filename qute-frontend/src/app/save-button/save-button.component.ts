import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, throwError, Observable } from 'rxjs';
import { tap } from 'rxjs';
import { ManagerService } from '../services/manager.service';
import { ReperService } from '../services/reper.service';
import { ConverterService } from '../services/converter.service';
import { UserService } from '../services/user.service';
import { QCode } from '../model/QCode';
import { TestSuite } from '../model/TestSuite';
import { Deterministic } from '../model/Deterministic';
import { Stochastic } from '../model/Stochastic';
import { Project } from '../model/Project';

@Component({
  selector: 'app-save-button',
  templateUrl: './save-button.component.html',
  styleUrls: ['./save-button.component.css']
})
export class SaveButtonComponent implements OnInit, OnDestroy {

  hasUnsavedChanges = false;
  isSaving = false;
  private subscription = new Subscription();

  constructor(
    public manager: ManagerService,
    private reperService: ReperService,
    private converterService: ConverterService,
    private userService: UserService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subscription.add(
      this.manager.projectSavedState$.subscribe(saved => {
        this.hasUnsavedChanges = !saved;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get shouldShow(): boolean {
    return !!this.manager.selectedProject;
  }

  saveProject(): void {
    const project = this.manager.selectedProject;
    if (!project) return;

    const quirkCodeText = project.qProgram?.qCircuit?.textQuirkCode || '';

    if (!quirkCodeText) {
      // No circuit code - just save project metadata
      this.persistProject(project, null);
      return;
    }

    // Check if we already have converted code
    const existingCode = project.qProgram?.qCodes?.[0]?.code;
    if (existingCode) {
      this.buildAndSave(project, existingCode);
      return;
    }

    this.isSaving = true;
    this.manager.showNotification('Saving project...', 'loading');

    this.converterService.convert({ quirkJson: quirkCodeText, language: 'qiskit' }).subscribe({
      next: (res) => {
        this.buildAndSave(project, res.code);
      },
      error: (err) => {
        this.isSaving = false;
        this.manager.showNotification('Error converting circuit: ' + err.message, 'error', 4000);
      }
    });
  }

  private buildAndSave(project: Project, code: string | null): void {
    if (code) {
      const qCode = new QCode();
      qCode.platform = 'QuTe';
      qCode.code = code;
      project.qProgram.qCodes = [qCode];
    }

    this.persistProject(project, code);
  }

  private persistProject(project: Project, code: string | null): void {
    this.isSaving = true;
    this.manager.showNotification('Saving project...', 'loading');

    if (this.userService.isAuthenticated$.value) {
      this.reperService.save(project).subscribe({
        next: () => {
          this.isSaving = false;
          this.manager.showNotification('Project saved successfully.', 'success', 3000);
          this.manager.markProjectAsSaved();
          this.manager.cacheProjectLocally(project);
        },
        error: (err) => {
          this.isSaving = false;
          console.error(err);
          this.manager.showNotification('Error saving project.', 'error', 3000);
        }
      });
    } else {
      this.isSaving = false;
      this.manager.showNotification('Project saved to local memory.', 'success', 3000);
      this.manager.markProjectAsSaved();
      this.manager.cacheProjectLocally(project);
    }
  }
}
