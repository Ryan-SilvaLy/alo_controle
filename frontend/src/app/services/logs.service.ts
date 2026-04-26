import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthenticationService } from './authentication.service';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


export interface Log {
  id: number;
  usuario_username: string;
  acao: string;          
  criado_em: string;     
  atualizado_em: string;    
}


@Injectable({
  providedIn: 'root'
})
export class LogsService {
  private baseUrl: string;

  constructor(
    private http: HttpClient,
    private authService: AuthenticationService
  ) {
    this.baseUrl = environment.apiUrl + '/usuario/logs';
  }

  listarLogs(): Observable<Log[]> {
    return this.http.get<Log[]>(`${this.baseUrl}/`, { headers: this.authService.getAuthHeaders() });
  }
}
