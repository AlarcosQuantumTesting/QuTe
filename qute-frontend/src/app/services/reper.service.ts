import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { Injectable } from '@angular/core';
import { Project } from '../model/Project';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReperService {
  private right: string = "?db=quantum_mutation&collection="

  constructor(private client: HttpClient) { }

  getCircuits(email: string) {
    return this.client.post<any>(`${environment.api.core}/projects/getAllByUser`, { email }, { withCredentials: true })
  }

  getSidebarCircuits(email: string) {
    return this.client.post<any>(`${environment.api.core}/projects/getAllByUserSummary`, { email }, { withCredentials: true })
  }

  getProject(email: string, projectId: string) {
    return this.client.post<any>(`${environment.api.core}/projects/getProject`, { email, projectId }, { withCredentials: true })
  }

  save(circuit: Project) {
    // Crear una copia del circuito para no modificar el original
    const circuitToSend: any = { ...circuit };

    // En QuTe sí modificamos y guardamos las testSuites.
    // Pero quitamos generator para evitar problemas de proxy de Hibernate si no se usa.
    if (circuitToSend.qProgram) {
      circuitToSend.qProgram = { ...circuitToSend.qProgram };
      delete (circuitToSend.qProgram as any).generator;
    }

    // Enviar todos los ciclos para que el backend no los borre.
    if (circuit.mutantCycles) {
      circuitToSend.mutantCycles = circuit.mutantCycles.map(mc => {
        const mcToSend = { ...mc };
        (mcToSend as any).mutants = null;
        return mcToSend as any;
      });
    }

    return this.client.put<any>(`${environment.api.core}/projects/save`, {
      circuit: circuitToSend, user: {
        id: sessionStorage.getItem('email')
      }
    }, { withCredentials: true })
  }

  saveMutantsBatch(projectId: string, cycleId: number, mutants: any[]) {
    return this.client.post<any>(`${environment.api.core}/qumureper/saveMutantsBatch`, { projectId, cycleId, mutants, email: sessionStorage.getItem('email')! }, { withCredentials: true })
  }

  saveExecutionsBatch(projectId: string, cycleId: number, mutants: any[]) {
    return this.client.post<any>(`${environment.api.core}/qumureper/saveExecutionsBatch`, { projectId, cycleId, mutants, email: sessionStorage.getItem('email')! }, { withCredentials: true })
  }

  delete(projectId: string) {
    return this.client.post<any>(`${environment.api.core}/projects/delete`, { projectId, userId: sessionStorage.getItem('email')! }, { withCredentials: true })
  }

  deleteMutantCycle(projectId: string, cycleId: number) {
    return this.client.post<any>(`${environment.api.core}/qumureper/deleteMutantCycle`, { projectId, cycleId }, { withCredentials: true })
  }

  getUser() {
    return this.client.post<string>(`${environment.api.core}/users/getUser`, {}, {
      withCredentials: true,
      responseType: 'text' as 'json'
    }).pipe(
      tap(user => sessionStorage.setItem('email', user))
    );
  }

  getProjects(token: string, id: string) {
    return this.client.post<any>(`${environment.api.core}/projects/getAllByUser`, { token, email: sessionStorage.getItem('email')!, id }, { withCredentials: true })
  }
}