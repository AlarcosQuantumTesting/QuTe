import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { ProjectConfigComponent } from './project-config/project-config.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'project/:projectId', component: ProjectConfigComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }

