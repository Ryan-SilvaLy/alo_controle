import { Injectable } from '@angular/core';
import { AuthenticationService } from './authentication.service';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';


export interface Produto {
  id?: number;
  patrimonio: string;
  nome: string;
  nome_cliente?: string;
  tempo_contrato: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProdutoService {

  private baseUrl = 'http://127.0.0.1:8000/api/produto/';
  constructor(
    private authService: AuthenticationService,
    private http: HttpClient,
  ) { }

  listarProdutos(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}`, { headers: this.authService.getAuthHeaders() });
  }

  obterProduto(id: number): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}${id}/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  criarProduto(data: Produto): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}`, data, {
      headers: this.authService.getAuthHeaders()
    });
  }

  atualizarProduto(id: number, data: Partial<Produto>): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}${id}/`, data, {
      headers: this.authService.getAuthHeaders()
    });
  }

  deletarProduto(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}${id}/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  criarProdutoPadrao(): Produto {
    return {
      patrimonio: '',
      nome: '',
      nome_cliente: '',
      tempo_contrato: ''
    };
  }
}



