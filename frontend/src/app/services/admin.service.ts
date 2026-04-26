import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthenticationService } from './authentication.service';
import { getFromSessionStorage, setInSessionStorage } from '../utils/storage-utils';


export interface BaseUsuario {
  /**
   * Interface base que define os campos comuns a qualquer usuário no sistema.
   * 
   * Esta interface serve como estrutura principal para os dados padrão de um usuário,
   * permitindo que outras interfaces especializadas estendam e adicionem propriedades específicas,
   * como identificadores ou credenciais.
   */
  username: string;
  nome: string;
  cargo: string;
  setor: string;
  nivel_permissao: string;
}

export interface Usuario extends BaseUsuario {
  id: number;
}

export interface NovoUsuario extends BaseUsuario {
  password: string;
}


@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private usuarioSelecionado: Usuario | null = null;

  private baseUrl: string;
  private readonly STORAGE_KEY = 'usuario_selecionado';

  constructor(
    private http: HttpClient,
    private authService: AuthenticationService
  ) {
    this.baseUrl = environment.apiUrl + '/usuario';
  }


  setUsuarioSelecionado(usuario: Usuario) {
    this.usuarioSelecionado = usuario;
    setInSessionStorage(this.STORAGE_KEY, usuario);
  }

  getUsuarioSelecionado(): Usuario | null {
    if (!this.usuarioSelecionado) {
      this.usuarioSelecionado = getFromSessionStorage<Usuario>(this.STORAGE_KEY);
    }
    return this.usuarioSelecionado;
  }


   listarUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.baseUrl}/listar`, { headers: this.authService.getAuthHeaders() });
  }

  excluirUsuario(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/deletar/${id}/`, { headers: this.authService.getAuthHeaders() });
  }

  criarUsuario(usuario: NovoUsuario): Observable<any> {
    return this.http.post(`${this.baseUrl}/criar/`, usuario, { headers: this.authService.getAuthHeaders() });
  }

  atualizarUsuario(id: number, dados: Usuario): Observable<any> {
    return this.http.put(`${this.baseUrl}/atualizar/${id}/`, dados, { headers: this.authService.getAuthHeaders() });
  }

}
