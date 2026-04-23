import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthenticationService } from './authentication.service';

// Interface para o TipoItem
export interface TipoItem {
  id: number;
  nome: string;
  criado_em?: string;
  atualizado_em?: string;
}

// Interface para criação/edição de Item
export interface ItemCreate {
  codigo: string;
  nome: string;
  descricao: string;
  tipo_item_id: number | null;    
  prateleira_estoque: string;
  quantidade_atual: number;
  quantidade_minima: number;
  unidade_medida: string;
  situacao?: string;
  status?: string;
  codigo_barras?: string;
}

// Interface completa de Item (para GET)
export interface Item extends ItemCreate {
  id: number;
  tipo_item: TipoItem;           // objeto aninhado retornado pelo backend
}


@Injectable({
  providedIn: 'root'
})
export class ItemService {
  
  private baseUrl = 'http://127.0.0.1:8000/api/item/';
  private baseUrlTipoItem = 'http://127.0.0.1:8000/api/item/tipoItem';

  public UNIDADE_MEDIDA_CHOICES: [string, string][] = [
    ['un', 'Unidade'],
    ['kg', 'Quilo'],
    ['g', 'Grama'],
    ['l', 'Litro'],
    ['ml', 'Mililitro'],
    ['cx', 'Caixa'],
    ['pct', 'Pacote'],
    ['m', 'Metro'],
    ['cm', 'Centímetro'],
  ];

  constructor(
    private http: HttpClient,
    private authService: AuthenticationService

  ) { }
  
  criarItem(item: ItemCreate): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}criar/`, item, { headers: this.authService.getAuthHeaders() });
  }

  listarItens(): Observable<Item[]> {

    return this.http.get<Item[]>(`${this.baseUrl}listar/`, { headers: this.authService.getAuthHeaders() });
  }

  atualizarItem(id: number, dadosParciais: Partial<Item>): Observable<any> {
  return this.http.patch<any>(`${this.baseUrl}atualizar/${id}/`, dadosParciais, { headers: this.authService.getAuthHeaders() });
}

  atualizarStatusItem(id: number): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}atualizar-status/${id}/`, {}, { headers: this.authService.getAuthHeaders() });
  }

  listarItensEmBaixaPorTipo(): Observable<any> {
  return this.http.get<any>(`${this.baseUrl}por-tipo-baixo/`, { headers: this.authService.getAuthHeaders() });
}

  criarTipoItem(data: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrlTipoItem}/`, data, {
      headers: this.authService.getAuthHeaders()
    });
  }

  listarTipoItem(): Observable<any> {
    return this.http.get<any>(`${this.baseUrlTipoItem}/`,{
      headers: this.authService.getAuthHeaders()
    });
  }

  atualizarTipoItem(id: number, data: Partial<TipoItem>): Observable<any> {
    return this.http.patch<any>(`${this.baseUrlTipoItem}/${id}/`, data, {
      headers: this.authService.getAuthHeaders()
    });
  }

  excluirTipoItem(id: number): Observable<any> {
    return this.http.delete<any>(`${this.baseUrlTipoItem}/${id}/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

 getItemNome(itensDisponiveis: Item[], itemId: number | string): string {
    const id = Number(itemId); // força para número
    const item = itensDisponiveis.find(i => i.id === id);
    return item ? `${item.codigo} - ${item.nome}` : 'Item desconhecido';
  }
}
