import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, Observable, of, switchMap, tap } from 'rxjs';
import { getFromSessionStorage, setInSessionStorage } from '../utils/storage-utils';
import { environment } from '../../environments/environment';


interface TokenResponse {
  access: string;
  refresh: string;
}

@Injectable({
  providedIn: 'root'
})

export class AuthenticationService {

  private baseUrl = environment.apiUrl + '/auth/';

  private apiLogin = this.baseUrl + 'token/';
  private apiRefresh = this.baseUrl + 'token/refresh/';
  private usuarioLogadoSubject = new BehaviorSubject<any | null>(null);
  private loggedIn = new BehaviorSubject<boolean>(this.hasToken());
  private readonly STORAGE_KEY = 'usuario_logado';

  constructor(
    private http: HttpClient
  ) { }

  getUsuarioLogadoSubject(): Observable<any> {
    /**
     * Retorna um Observable que emite as atualizações do usuário logado.
     * Componentes podem se inscrever para receber o usuário atual em tempo real,
     * sempre que ele for atualizado.
   */

  if (!this.usuarioLogadoSubject.value) {
    const armazenado = getFromSessionStorage<any>(this.STORAGE_KEY);
    if (armazenado) {
      this.usuarioLogadoSubject.next(armazenado);
    }
  }
  return this.usuarioLogadoSubject.asObservable();

  }

getUsuarioLogadoValue() {
  if (!this.usuarioLogadoSubject.value) {
    const armazenado = getFromSessionStorage<any>(this.STORAGE_KEY);
    if (armazenado) {
      this.usuarioLogadoSubject.next(armazenado);
    }
  }
  return this.usuarioLogadoSubject.value;
}

  setUsuarioLogado(usuario: any) {
  /**
   * Atualiza o valor atual do usuário logado e notifica todos os inscritos
   * (observadores) dessa mudança, emitindo o novo usuário para eles.
   * 
   * @param usuario - objeto com os dados do usuário logado
   */

  this.usuarioLogadoSubject.next(usuario);
  setInSessionStorage(this.STORAGE_KEY, usuario);
  }

  inicializarUsuarioLogado() {
    const token = localStorage.getItem('access_token');
    if (token) {
      this.http.get<any>(`${environment.apiUrl}/usuario/pegar-usuario-logado/`, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: (usuario) => this.setUsuarioLogado(usuario),
        error: () => this.logout() // token expirado ou inválido
      });
    }
  }


  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getAuthHeaders(contentTypeJson = true): HttpHeaders {
    // Método privado para montar os headers com token e content-type
    const token = this.getToken() || '';
    let headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    if (contentTypeJson) {
      headers = headers.set('Content-Type', 'application/json');
    }
    return headers;
  }
  
  private hasToken(): boolean {
    return !!localStorage.getItem('access_token');
  }

  isLoggedIn(): Observable<boolean> {
    return this.loggedIn.asObservable();
  }


login(username: string, password: string): Observable<any> {
  return this.http.post<TokenResponse>(this.apiLogin, { username, password }).pipe(
    tap(response => {
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      this.loggedIn.next(true);
    }),
    switchMap(() => this.http.get<any>(`${environment.apiUrl}/usuario/pegar-usuario-logado/`, {
      headers: this.getAuthHeaders()
    })),
    tap(usuario => this.setUsuarioLogado(usuario))
  );
}


  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.loggedIn.next(false);
    this.setUsuarioLogado(null);
  }


  refreshToken(): Observable<TokenResponse | null> {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return of(null);

    return this.http.post<TokenResponse>(this.apiRefresh, { refresh })
      .pipe(
        tap(response => {
          localStorage.setItem('access_token', response.access);
        }),
        catchError(() => {
          this.logout();
          return of(null);
        })
      );
  }
}
