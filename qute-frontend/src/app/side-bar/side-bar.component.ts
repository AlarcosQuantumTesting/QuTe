import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { ManagerService } from '../services/manager.service';
import { Project } from '../model/Project';
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
  }

  get circuits(): Project[] {
    return this.manager.projects;
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
      this.router.navigate(['/project', circuit.id]);
    }, 300);
  }

  selectCircuit(circuit: Project): void {
    this.manager.setselectedProject(circuit);
    this.router.navigate(['/project', circuit.id]);
  }

  isCircuitSelected(circuit: Project): boolean {
    return this.router.isActive(`/project/${circuit.id}`, {
      paths: 'exact',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored'
    });
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
