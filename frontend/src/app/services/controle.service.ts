import { Injectable } from '@angular/core';
import { AuthenticationService } from './authentication.service';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';


interface MovimentacoesEstoque {
  entradas: any[];
  saidas: any[];
}

@Injectable({
  providedIn: 'root'
})
export class ControleService {

  private baseUrl = 'http://127.0.0.1:8000/api/controle/';

  constructor(
    private authService: AuthenticationService,
    private http: HttpClient,
  ) { }
  
  listarMovimentacoesEstoque(): Observable<MovimentacoesEstoque> {
    return this.http.get<MovimentacoesEstoque>(`${this.baseUrl}movimentacoes/estoque`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  listarEntradasEstoque(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}registro-entrada/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  listarSaidasEstoque(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}registro-saida/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  registrarEntradaEstoque(data: any): Observable<any> {
  return this.http.post<any>(`${this.baseUrl}registro-entrada/`, data, {
    headers: this.authService.getAuthHeaders()
  });
  }

  criarNotaFiscal(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}nota-fiscal/`, data, {
      headers: this.authService.getAuthHeaders()
    });
  }

  obterNotaFiscal(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}nota-fiscal/${id}/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  atualizarNotaFiscal(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}nota-fiscal/${id}/`, data, {
      headers: this.authService.getAuthHeaders()
    });
  }

  registrarSaidaEstoque(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}registro-saida/`, data, {
      headers: this.authService.getAuthHeaders()
    });
  }

  obterEntradaEstoque(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}registro-entrada/${id}/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  atualizarEntradaEstoque(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}registro-entrada/${id}/`, data, {
      headers: this.authService.getAuthHeaders()
    });
  }

  excluirEntradaEstoque(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}registro-entrada/${id}/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  obterSaidaEstoque(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}registro-saida/${id}/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  atualizarSaidaEstoque(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}registro-saida/${id}/`, data, {
      headers: this.authService.getAuthHeaders()
    });
  }

  excluirSaidaEstoque(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}registro-saida/${id}/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  buscarUltimaEntradaEstoque(itemId: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}registro-entrada/ultima-entrada/${itemId}/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  listarItensEntrada(entradaId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}registro-entrada/${entradaId}/itens/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  listarItensSaida(saidaId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}registro-saida/${saidaId}/itens/`, {
      headers: this.authService.getAuthHeaders()
    });
  }
}
