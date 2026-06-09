import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, Subscription, tap, BehaviorSubject, of, catchError, map } from 'rxjs';
import { ReperService } from './reper.service';
import { environment } from '../../environments/environment';
import * as localforage from 'localforage';
import { shareReplay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  public login$ = new Subject<void>();

  public isAuthenticated$ = new BehaviorSubject<boolean>(false);
  private sessionCache$: Observable<boolean> | null = null;

  constructor(private client: HttpClient, private reperService: ReperService) { }

  login(email: string, pwd: string): Observable<any> {
    return this.client.post<string>(`${environment.api.core}/users/login`, { email, pwd }, { responseType: 'text' as 'json', withCredentials: true })
      .pipe(
        tap(token => {
          // sessionStorage.setItem('token', token); // Cookie is now HttpOnly
          sessionStorage.setItem('email', email);
          this.isAuthenticated$.next(true);
          this.login$.next();
          this.sessionCache$ = null; // Clear cache on login
        })
      );
  }

  checkSession(forceRefresh = false): Observable<boolean> {
    if (this.sessionCache$ && !forceRefresh) {
      return this.sessionCache$;
    }

    this.sessionCache$ = this.reperService.getUser().pipe(
      tap(email => {
        sessionStorage.setItem('email', email);
        this.isAuthenticated$.next(true);
      }),
      map(() => true),
      catchError(() => {
        this.isAuthenticated$.next(false);
        sessionStorage.removeItem('email');
        return of(false);
      }),
      shareReplay(1)
    );

    return this.sessionCache$;
  }

  logout(): void {
    this.client.post(`${environment.api.core}/users/logout`, {}, { withCredentials: true }).subscribe({
      next: () => {
        this.clearSession();
      },
      error: () => {
        // Even if the backend fails, we should clear the local session
        this.clearSession();
      }
    });

  }

  private clearSession(): void {
    sessionStorage.removeItem('email');
    this.isAuthenticated$.next(false);
    this.sessionCache$ = null;

    // Clear all cached projects from localforage
    localforage.keys().then((keys: string[]) => {
      const keysToRemove = keys.filter(key => key && key.startsWith('qumu_project_'));
      Promise.all(keysToRemove.map(key => localforage.removeItem(key)))
        .catch(e => console.warn("Error clearing localForage cache on logout", e));
    }).catch(e => console.error("Error retrieving localforage keys", e));
  }
}
