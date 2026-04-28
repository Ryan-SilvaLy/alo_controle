import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, Subject, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthenticationService } from './authentication.service';

export interface AssinaturaEpiLancamento {
  id: number;
  nome_item_snapshot: string;
  grupo_item_snapshot: string;
  quantidade: number | string;
  data_saida: string;
  numero_bloco_requisicao: string;
  setor_nome_snapshot: string;
  responsavel_nome_snapshot: string;
  solicitante_nome_snapshot: string;
  patrimonio_snapshot?: string | null;
  foi_impresso: boolean;
  impresso_em?: string | null;
  ativo: boolean;
  cancelado_em?: string | null;
  cancelado_motivo?: string;
  status_lancamento: 'pendente_impressao' | 'impresso' | 'cancelado';
}

export interface AssinaturaEpiRelatorioItem {
  id: number;
  lancamento: AssinaturaEpiLancamento;
}

export interface AssinaturaEpiRelatorio {
  id: number;
  competencia: number;
  competencia_label: string;
  solicitante_nome: string;
  mes_referencia: number;
  ano_referencia: number;
  sequencia_relatorio: number;
  status_assinatura: 'pendente_assinatura' | 'assinado';
  gerado_em: string;
  gerado_por?: number | null;
  gerado_por_nome?: string;
  assinado_em?: string | null;
  assinado_por?: number | null;
  assinado_por_nome?: string;
  quantidade_itens: number;
  itens: AssinaturaEpiRelatorioItem[];
}

export interface AssinaturaEpiCompetencia {
  id: number;
  solicitante_nome: string;
  mes_referencia: number;
  ano_referencia: number;
  competencia_label: string;
  status: 'aberta' | 'fechada';
  pendentes_impressao: number;
  relatorios_gerados: number;
  status_assinatura: 'pendente_assinatura' | 'assinado' | 'sem_relatorio';
}

export interface AssinaturaEpiCompetenciaDetalhe extends AssinaturaEpiCompetencia {
  lancamentos: AssinaturaEpiLancamento[];
  relatorios: AssinaturaEpiRelatorio[];
}

@Injectable({
  providedIn: 'root'
})
export class AssinaturaEpiService {
  private baseUrl: string;
  private assinaturasAtualizadasSubject = new Subject<void>();
  assinaturasAtualizadas$ = this.assinaturasAtualizadasSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthenticationService
  ) {
    this.baseUrl = environment.apiUrl + '/api/assinaturas-epi/';
  }

  listarCompetencias(filtros?: Record<string, string | number | null | undefined>): Observable<AssinaturaEpiCompetencia[]> {
    let params = new HttpParams();

    Object.entries(filtros || {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && `${value}`.trim() !== '') {
        params = params.set(key, `${value}`);
      }
    });

    return this.http.get<AssinaturaEpiCompetencia[]>(`${this.baseUrl}competencias/`, {
      headers: this.authService.getAuthHeaders(),
      params
    });
  }

  obterCompetencia(id: number): Observable<AssinaturaEpiCompetenciaDetalhe> {
    return this.http.get<AssinaturaEpiCompetenciaDetalhe>(`${this.baseUrl}competencias/${id}/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  gerarRelatorio(competenciaId: number): Observable<AssinaturaEpiRelatorio> {
    return this.http.post<AssinaturaEpiRelatorio>(
      `${this.baseUrl}competencias/${competenciaId}/gerar-relatorio/`,
      {},
      { headers: this.authService.getAuthHeaders() }
    ).pipe(tap(() => this.notificarAssinaturasAtualizadas()));
  }

  contarCompetenciasAbertas(): Observable<number> {
    return this.listarCompetencias({ status: 'aberta' }).pipe(
      map((competencias) => Array.isArray(competencias) ? competencias.length : 0)
    );
  }

  listarRelatorios(competenciaId?: number): Observable<AssinaturaEpiRelatorio[]> {
    let params = new HttpParams();
    if (competenciaId) {
      params = params.set('competencia', competenciaId);
    }

    return this.http.get<AssinaturaEpiRelatorio[]>(`${this.baseUrl}relatorios/`, {
      headers: this.authService.getAuthHeaders(),
      params
    });
  }

  obterRelatorio(id: number): Observable<AssinaturaEpiRelatorio> {
    return this.http.get<AssinaturaEpiRelatorio>(`${this.baseUrl}relatorios/${id}/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  marcarAssinado(id: number): Observable<AssinaturaEpiRelatorio> {
    return this.http.post<AssinaturaEpiRelatorio>(
      `${this.baseUrl}relatorios/${id}/marcar-assinado/`,
      {},
      { headers: this.authService.getAuthHeaders() }
    ).pipe(tap(() => this.notificarAssinaturasAtualizadas()));
  }

  obterDadosImpressao(id: number): Observable<AssinaturaEpiRelatorio> {
    return this.http.get<AssinaturaEpiRelatorio>(`${this.baseUrl}relatorios/${id}/imprimir/`, {
      headers: this.authService.getAuthHeaders()
    });
  }

  notificarAssinaturasAtualizadas(): void {
    this.assinaturasAtualizadasSubject.next();
  }
}
