import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ManagerService } from '../services/manager.service';
import { Project } from '../model/Project';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {


  constructor(public manager: ManagerService, private userService: UserService, private router: Router) { }

  ngOnInit(): void {
    if (this.userService.isAuthenticated$.value) {
      this.manager.showSidebar = true;
      // Optionally redirect or hide home if that's the desired behavior for logged in users
      // But the user complained about 'modal de inicio de sesión', likely referring to the Home screen itself acting as a login prompt/modal.
      // If the intent is that logged in users see the app immediately, we should trigger that state transition.
      // However, the original code didn't auto-redirect, it just set showSidebar on createCircuit.
      // Let's assume the user wants the UI to reflect login state immediately.
    }
  }

  createCircuit() {
    let circuit = new Project(crypto.randomUUID(), "Project1")
    this.manager.setNewselectedProject(circuit)

    if (this.userService.isAuthenticated$.value) {
      this.manager.showSidebar = true
    }

    // Navigate to the new project
    this.router.navigate(['/project', circuit.id]);
  }

}
