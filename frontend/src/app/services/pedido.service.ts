import { Injectable } from '@angular/core';
import { AuthenticationService } from './authentication.service';
import { HttpClient } from '@angular/common/http';
import { map, Observable, Subject, tap } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class PedidoService {
  private baseUrl: string;
  private pedido: any = null;
  private pedidoSelecionado = null;
  private pedidosAtualizadosSubject = new Subject<void>();
  pedidosAtualizados$ = this.pedidosAtualizadosSubject.asObservable();
  
  constructor(
    private authService: AuthenticationService,
    private http: HttpClient
  ) {
    this.baseUrl = environment.apiUrl + '/api/pedido/';
  }


  setPedido(pedido: any) {
    this.pedidoSelecionado = pedido;
    localStorage.setItem('pedidoSelecionado', JSON.stringify(pedido));
  }

  getPedido() {
    if (!this.pedidoSelecionado) {
      const salvo = localStorage.getItem('pedidoSelecionado');
      if (salvo) {
        this.pedidoSelecionado = JSON.parse(salvo);
      }
    }
    return this.pedidoSelecionado;
  }

  limparPedido() {
    this.pedidoSelecionado = null;
    localStorage.removeItem('pedidoSelecionado');
  }

  
  atualizarStatusPedido(id: number, status: string, motivoRecusado?: string): Observable<any> {
    const body: any = { status };
    if (motivoRecusado) {
      body.motivo_recusado = motivoRecusado;
    }

    return this.http.patch(`${this.baseUrl}atualizar-status/${id}/`, body, {
      headers: this.authService.getAuthHeaders()
    }).pipe(tap(() => this.notificarPedidosAtualizados()));
  }

  atualizarStatusComprasPedido(id: number, statusCompras: 'visto' | 'negado', motivoNegado?: string): Observable<any> {
    const body: any = { acao: statusCompras };
    if (motivoNegado) {
      body.compras_motivo_negado = motivoNegado;
    }

    return this.http.patch(`${this.baseUrl}atualizar-status-compras/${id}/`, body, {
      headers: this.authService.getAuthHeaders()
    }).pipe(tap(() => this.notificarPedidosAtualizados()));
  }

  atualizarPedido(id: number, body: any): Observable<any> {
    return this.http.patch(`${this.baseUrl}atualizar/${id}/`, body, {
      headers: this.authService.getAuthHeaders()
    }).pipe(tap(() => this.notificarPedidosAtualizados()));
  }

  buscarPedidoPorId(id: number): Observable<any> {
    return this.http.get(`${this.baseUrl}buscar/${id}/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  listarPedidos(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}listar/`, { headers: this.authService.getAuthHeaders() });
  }

  contarPedidosNotificacao(nivelPermissao?: string): Observable<number> {
    const statusAlvo = nivelPermissao === 'compra' ? 'enviado' : 'pendente';

    return this.listarPedidos().pipe(
      map((res) => {
        const pedidos = Array.isArray(res) ? res : [];
        return pedidos.filter((pedido: any) => pedido?.status === statusAlvo).length;
      })
    );
  }

  criarPedido(body: any): Observable<any> {
    return this.http.post(`${this.baseUrl}criar/`, body, {
      headers: this.authService.getAuthHeaders()
    }).pipe(tap(() => this.notificarPedidosAtualizados()));
  }

  notificarPedidosAtualizados(): void {
    this.pedidosAtualizadosSubject.next();
  }
}
