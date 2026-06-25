import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { ManagerService } from '../services/manager.service';
import { Project } from '../model/Project';
import { TestSuite } from '../model/TestSuite';
import { UserService } from '../services/user.service';
import { ThemeService } from '../services/theme.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-side-bar',
  templateUrl: './side-bar.component.html',
  styleUrls: ['./side-bar.component.css']
})
export class SideBarComponent implements OnInit, OnDestroy {

  menuAbierto = false;
  mostrarInicio = true;
  loading = false;
  isCreatingProject = false;
  userMenuOpen = false;

  /** Set of project IDs that are expanded in the tree */
  expandedProjects: Set<string> = new Set();

  private subs = new Subscription();

  constructor(
    private router: Router,
    private manager: ManagerService,
    private userService: UserService,
    private themeService: ThemeService
  ) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.mostrarInicio = this.router.url === '/' || this.router.url === '/home';
      }
    });
  }

  ngOnInit(): void {
    this.manager.sidebarExpanded = this.menuAbierto;

    // Verify session via cookie
    this.userService.checkSession().subscribe(isAuthenticated => {
      if (isAuthenticated) {
        this.loadCircuitsFromService();
      }
    });

    this.subs.add(
      this.userService.login$.subscribe(() => {
        this.loadCircuitsFromService();
      })
    );

    // Auto-expand selected project when it changes
    this.subs.add(
      this.manager.selectedProject$.subscribe(project => {
        if (project && project.id) {
          this.expandedProjects.add(project.id);
        }
      })
    );
  }

  get circuits(): Project[] {
    return this.manager.projects;
  }

  // ---- Tree expand/collapse ----
  toggleProject(projectId: string): void {
    if (this.expandedProjects.has(projectId)) {
      this.expandedProjects.delete(projectId);
    } else {
      this.expandedProjects.add(projectId);
    }
  }

  isProjectExpanded(projectId: string): boolean {
    return this.expandedProjects.has(projectId);
  }

  // ---- Test Suites ----
  getTestSuites(project: Project): TestSuite[] {
    return project.testSuites && project.testSuites.length > 0 ? project.testSuites : [];
  }

  // ---- Navigation ----
  selectProject(circuit: Project): void {
    this.manager.setselectedProject(circuit);
    this.router.navigate(['/project', circuit.id]);
  }

  selectTestSuite(circuit: Project, suiteIndex: number): void {
    this.manager.setselectedProject(circuit);
    this.router.navigate(['/project', circuit.id, 'suite', suiteIndex]);
  }

  // ---- Route active checks ----
  isProjectRouteSelected(circuit: Project): boolean {
    return this.router.isActive(`/project/${circuit.id}`, {
      paths: 'exact',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored'
    });
  }

  isSuiteRouteSelected(circuit: Project, suiteIndex: number): boolean {
    return this.router.isActive(`/project/${circuit.id}/suite/${suiteIndex}`, {
      paths: 'exact',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored'
    });
  }

  toggleMenu() {
    this.menuAbierto = !this.menuAbierto;
    this.manager.sidebarExpanded = this.menuAbierto;
  }

  createNewCircuit() {
    if (this.isCreatingProject) return;
    this.isCreatingProject = true;

    setTimeout(() => {
      let circuit = new Project(crypto.randomUUID(), "Project " + (this.circuits.length + 1));
      this.manager.setNewselectedProject(circuit);
      this.isCreatingProject = false;
      if (circuit.id) {
        this.expandedProjects.add(circuit.id);
      }
      this.router.navigate(['/project', circuit.id]);
    }, 300);
  }

  goToHome() {
    this.router.navigate(['/']);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  isLoggedIn(): boolean {
    return this.userService.isAuthenticated$.value;
  }

  refreshCircuits(): void {
    if (this.manager.selectedProject && !this.manager.selectedProject.saved) {
      this.manager.openConfirmationModal({
        title: 'Unsaved changes',
        message: 'You have unsaved changes in the current project. Are you sure you want to refresh? Local changes will be lost.',
        confirmText: 'Refresh',
        cancelText: 'Cancel',
        type: 'warning',
        onConfirm: () => {
          this.loadCircuitsFromService(true);
        }
      });
      return;
    }
    this.loadCircuitsFromService(true);
  }

  loadCircuitsFromService(forceRefresh = false): void {
    const email = sessionStorage.getItem('email');
    if (!email) return;

    this.loading = true;
    this.manager.loadProjects(email, forceRefresh).subscribe({
      next: () => {
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading projects:', error);
        this.loading = false;
      }
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  logout(): void {
    this.userService.logout();
    this.router.navigate(['/']);
  }

  navigateToQSauron(): void {
    window.location.href = environment.loginUrl;
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen = !this.userMenuOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick() {
    if (this.userMenuOpen) {
      this.userMenuOpen = false;
    }
  }
}
