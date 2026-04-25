import { Component } from '@angular/core';
import { ControleService } from '../../../services/controle.service';
import { catchError, of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { FormsModule } from '@angular/forms';
import { RegistrarEntradaComponent } from '../registrar-entrada/registrar-entrada.component';
import { RegistrarSaidaComponent } from '../registrar-saida/registrar-saida.component';
import { AuthenticationService } from '../../../services/authentication.service';

@Component({
  selector: 'app-iniciar-controle',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RegistrarEntradaComponent,
    RegistrarSaidaComponent
  ],
  templateUrl: './iniciar-controle.component.html',
  styleUrl: './iniciar-controle.component.scss'
})
export class IniciarControleComponent {
  readonly itensPorPagina = 25;
  readonly itensModalPorPagina = 25;

  movimentacoes: { entradas: any[]; saidas: any[] } = { entradas: [], saidas: [] };
  carregando = false;
  erro: string | null = null;
  filtroTipo: 'todos' | 'entrada' | 'saida' = 'todos';
  termoBusca = '';
  hoverItemId: string | null = null;
  paginaAtual = 1;

  modalAberto = false;
  itensModal: any[] = [];
  tituloModal = '';
  paginaModalAtual = 1;

  modalExclusaoAberto = false;
  registroParaExcluir: any = null;
  tipoExclusao: 'entrada' | 'saida' = 'entrada';

  modalEntradaAberto = false;
  modalSaidaAberto = false;
  usuarioLogado: any = null;

  constructor(
    private controleService: ControleService,
    private router: Router,
    private snackbar: SnackbarService,
    private authService: AuthenticationService,
  ) {}

  ngOnInit() {
    this.usuarioLogado = this.authService.getUsuarioLogadoValue();
    this.authService.getUsuarioLogadoSubject().subscribe((usuario) => {
      this.usuarioLogado = usuario;
    });
    this.carregarMovimentacoes();
  }

  get podeOperarEstoque(): boolean {
    return ['administrador', 'moderador', 'almoxarifado'].includes(this.usuarioLogado?.nivel_permissao);
  }

  carregarMovimentacoes() {
    this.carregando = true;
    this.erro = null;

    this.controleService.listarMovimentacoesEstoque()
      .pipe(
        catchError(() => {
          this.erro = 'Erro ao carregar dados.';
          this.carregando = false;
          return of({ entradas: [], saidas: [] });
        })
      )
      .subscribe(data => {
        this.movimentacoes = {
          entradas: this.ordenarPorData(data.entradas || [], 'data_entrada'),
          saidas: this.ordenarPorData(data.saidas || [], 'data_saida')
        };
        this.carregando = false;
      });
  }

  registrarEntrada() {
    if (!this.podeOperarEstoque) return;
    this.modalEntradaAberto = true;
    document.body.style.overflow = 'hidden';
  }

  fecharModalEntrada() {
    this.modalEntradaAberto = false;
    this.restaurarScrollSeNecessario();
  }

  registrarSaida() {
    if (!this.podeOperarEstoque) return;
    this.modalSaidaAberto = true;
    document.body.style.overflow = 'hidden';
  }

  fecharModalSaida() {
    this.modalSaidaAberto = false;
    this.restaurarScrollSeNecessario();
  }

  visualizarItensEntrada(entrada: any) {
    this.controleService.listarItensEntrada(entrada.id).subscribe((itens: any[]) => {
      this.itensModal = itens;
      this.tituloModal = `Itens da Entrada #${entrada.id}`;
      this.paginaModalAtual = 1;
      this.modalAberto = true;
    });
  }

  editarEntrada(registro: any) {
    if (!this.podeOperarEstoque) return;
    this.router.navigate(['/controle/editar-entrada', registro.id]);
  }

  excluirEntrada(registro: any) {
    if (!this.podeOperarEstoque) return;
    this.registroParaExcluir = registro;
    this.tipoExclusao = 'entrada';
    this.modalExclusaoAberto = true;
  }

  imprimirEntrada(registro: any) {
    this.controleService.listarItensEntrada(registro.id).subscribe({
      next: (itens) => this.imprimirMovimentacao('Entrada', registro, itens),
      error: () => this.snackbar.show('Erro ao carregar itens para impressao.', 'error')
    });
  }

  visualizarItensSaida(saida: any) {
    this.controleService.listarItensSaida(saida.id).subscribe((itens: any[]) => {
      this.itensModal = itens;
      this.tituloModal = `Itens da Saida #${saida.id}`;
      this.paginaModalAtual = 1;
      this.modalAberto = true;
    });
  }

  editarSaida(registro: any) {
    if (!this.podeOperarEstoque) return;
    this.router.navigate(['/controle/editar-saida', registro.id]);
  }

  excluirSaida(registro: any) {
    if (!this.podeOperarEstoque) return;
    this.registroParaExcluir = registro;
    this.tipoExclusao = 'saida';
    this.modalExclusaoAberto = true;
  }

  imprimirSaida(registro: any) {
    this.controleService.listarItensSaida(registro.id).subscribe({
      next: (itens) => this.imprimirMovimentacao('Saida', registro, itens),
      error: () => this.snackbar.show('Erro ao carregar itens para impressao.', 'error')
    });
  }

  fecharModal() {
    this.modalAberto = false;
    this.itensModal = [];
    this.tituloModal = '';
    this.paginaModalAtual = 1;
  }

  confirmarExclusao() {
    if (!this.podeOperarEstoque) return;
    if (!this.registroParaExcluir) return;

    const serviceMethod = this.tipoExclusao === 'entrada'
      ? 'excluirEntradaEstoque'
      : 'excluirSaidaEstoque';

    this.controleService[serviceMethod](this.registroParaExcluir.id).subscribe({
      next: () => {
        this.snackbar.show(
          `${this.tipoExclusao === 'entrada' ? 'Entrada' : 'Saida'} excluida com sucesso.`,
          'success'
        );
        this.carregarMovimentacoes();
        this.fecharModalExclusao();
      },
      error: () => this.snackbar.show(`Erro ao excluir a ${this.tipoExclusao}.`, 'error')
    });
  }

  fecharModalExclusao() {
    this.modalExclusaoAberto = false;
    this.registroParaExcluir = null;
    this.tipoExclusao = 'entrada';
  }

  getEntradasOrdenadas(): any[] {
    return this.movimentacoes.entradas;
  }

  getSaidasOrdenadas(): any[] {
    return this.movimentacoes.saidas;
  }

  get itensConsolidados(): any[] {
    const termo = this.termoBusca.trim().toLowerCase();

    const itens = [
      ...this.movimentacoes.entradas.flatMap((entrada) =>
        (entrada.itens || []).map((itemMov: any, index: number) =>
          this.mapearLinhaMovimentacaoItem({
            tipo: 'entrada',
            item: itemMov,
            data: entrada.data_entrada,
            referencia: entrada.id,
            principal: entrada.nota_fiscal_detalhe?.numero_nota || `Entrada #${entrada.id}`,
            secundario: entrada.nota_fiscal_detalhe?.nome_fornecedor || entrada.recebido_por || '---',
            bloco: null,
            registro: entrada,
            index
          })
        )
      ),
      ...this.movimentacoes.saidas.flatMap((saida) =>
        (saida.itens || []).map((itemMov: any, index: number) =>
          this.mapearLinhaMovimentacaoItem({
            tipo: 'saida',
            item: itemMov,
            data: saida.data_saida,
            referencia: saida.id,
            principal: saida.bloco_requisicao || `Saida #${saida.id}`,
            secundario: itemMov.solicitante || saida.registrado_por || '---',
            bloco: saida.bloco_requisicao || null,
            registro: saida,
            index
          })
        )
      )
    ];

    return itens
      .filter((itemLinha) => {
        const correspondeTipo = this.filtroTipo === 'todos' || itemLinha.tipo === this.filtroTipo;
        const correspondeBusca =
          !termo ||
          [
            itemLinha.nome,
            itemLinha.codigo,
            itemLinha.principal,
            itemLinha.secundario,
            itemLinha.referencia,
            itemLinha.bloco,
            itemLinha.patrimonio
          ].some((valor) => (valor || '').toString().toLowerCase().includes(termo));

        return correspondeTipo && correspondeBusca;
      })
      .sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime());
  }

  limparFiltros() {
    this.filtroTipo = 'todos';
    this.termoBusca = '';
    this.paginaAtual = 1;
  }

  getChaveItem(itemResumo: any): string {
    return itemResumo.chave;
  }

  onHoverItem(itemResumo: any) {
    this.hoverItemId = this.getChaveItem(itemResumo);
  }

  onLeaveItem() {
    this.hoverItemId = null;
  }

  getHistoricoPreview(itemResumo: any): any[] {
    return [];
  }

  get itensConsolidadosPaginados(): any[] {
    const inicio = (this.getPaginaAtualSegura() - 1) * this.itensPorPagina;
    return this.itensConsolidados.slice(inicio, inicio + this.itensPorPagina);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.itensConsolidados.length / this.itensPorPagina));
  }

  get itensModalPaginados(): any[] {
    const inicio = (this.getPaginaModalSegura() - 1) * this.itensModalPorPagina;
    return this.itensModal.slice(inicio, inicio + this.itensModalPorPagina);
  }

  get totalPaginasModal(): number {
    return Math.max(1, Math.ceil(this.itensModal.length / this.itensModalPorPagina));
  }

  paginaAnterior() {
    this.paginaAtual = Math.max(1, this.getPaginaAtualSegura() - 1);
  }

  proximaPagina() {
    this.paginaAtual = Math.min(this.totalPaginas, this.getPaginaAtualSegura() + 1);
  }

  paginaAnteriorModal() {
    this.paginaModalAtual = Math.max(1, this.getPaginaModalSegura() - 1);
  }

  proximaPaginaModal() {
    this.paginaModalAtual = Math.min(this.totalPaginasModal, this.getPaginaModalSegura() + 1);
  }

  visualizarUltimoRegistro(itemResumo: any) {
    if (itemResumo.tipo === 'entrada') {
      this.visualizarItensEntrada(itemResumo.registro);
      return;
    }

    this.visualizarItensSaida(itemResumo.registro);
  }

  editarUltimoRegistro(itemResumo: any) {
    if (!this.podeOperarEstoque) return;
    if (itemResumo.tipo === 'entrada') {
      this.editarEntrada(itemResumo.registro);
      return;
    }

    this.editarSaida(itemResumo.registro);
  }

  imprimirUltimoRegistro(itemResumo: any) {
    if (itemResumo.tipo === 'entrada') {
      this.imprimirEntrada(itemResumo.registro);
      return;
    }

    this.imprimirSaida(itemResumo.registro);
  }

  getTotalMovimentacoes(): number {
    return this.movimentacoes.entradas.length + this.movimentacoes.saidas.length;
  }

  getTotalItensMovimentados(): number {
    return this.itensConsolidados.length;
  }

  getItensComBloco(): number {
    return this.itensConsolidados.filter((item) => !!item.bloco).length;
  }

  getEntradasRecentes(): number {
    return this.contarUltimosDias(this.movimentacoes.entradas, 'data_entrada');
  }

  getSaidasRecentes(): number {
    return this.contarUltimosDias(this.movimentacoes.saidas, 'data_saida');
  }

  getUltimaMovimentacaoLabel(): string {
    const datas = [
      ...this.movimentacoes.entradas.map(entrada => entrada.data_entrada),
      ...this.movimentacoes.saidas.map(saida => saida.data_saida)
    ]
      .filter(Boolean)
      .map(data => new Date(data));

    if (!datas.length) {
      return 'Sem registros';
    }

    const ultimaData = datas.sort((a, b) => b.getTime() - a.getTime())[0];

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(ultimaData);
  }

  private contarUltimosDias(registros: any[], campoData: string, dias = 7): number {
    const agora = new Date();
    const limite = new Date();
    limite.setDate(agora.getDate() - dias);

    return registros.filter(registro => {
      const data = new Date(registro[campoData]);
      return !Number.isNaN(data.getTime()) && data >= limite;
    }).length;
  }

  private ordenarPorData(registros: any[], campoData: string): any[] {
    return [...registros].sort((a, b) => {
      const dataA = new Date(a[campoData] || 0).getTime();
      const dataB = new Date(b[campoData] || 0).getTime();
      return dataB - dataA;
    });
  }

  private getPaginaAtualSegura(): number {
    if (this.paginaAtual > this.totalPaginas) {
      this.paginaAtual = this.totalPaginas;
    }

    return this.paginaAtual;
  }

  private getPaginaModalSegura(): number {
    if (this.paginaModalAtual > this.totalPaginasModal) {
      this.paginaModalAtual = this.totalPaginasModal;
    }

    return this.paginaModalAtual;
  }

  private mapearLinhaMovimentacaoItem(contexto: any) {
    const itemMov = contexto.item || {};

    return {
      chave: `${contexto.tipo}-${contexto.referencia}-${contexto.index}-${itemMov.item || itemMov.item_codigo || itemMov.item_nome || 'item'}`,
      tipo: contexto.tipo,
      statusLabel: contexto.tipo === 'entrada' ? 'Entrada' : 'Saida',
      itemId: itemMov.item || null,
      codigo: itemMov.item_codigo || '---',
      nome: itemMov.item_nome || itemMov.produto_nome || 'Item sem nome',
      quantidade: Number(itemMov.quantidade || 0),
      data: contexto.data,
      referencia: contexto.referencia,
      principal: contexto.principal,
      secundario: contexto.secundario,
      bloco: contexto.bloco || '---',
      solicitante: itemMov.solicitante || null,
      patrimonio: itemMov.patrimonio || null,
      registro: contexto.registro
    };
  }

  private restaurarScrollSeNecessario() {
    if (!this.modalEntradaAberto && !this.modalSaidaAberto) {
      document.body.style.overflow = 'auto';
    }
  }

  private imprimirMovimentacao(tipo: 'Entrada' | 'Saida', registro: any, itens: any[]) {
    const popup = window.open('', '_blank', 'width=900,height=700');

    if (!popup) {
      this.snackbar.show('Nao foi possivel abrir a janela de impressao.', 'warning');
      return;
    }

    const titulo = `${tipo} #${registro.id}`;
    const linhasItens = itens.map((item: any) => `
      <tr>
        <td>${item.item_codigo ?? '-'}</td>
        <td>${item.item_nome ?? '-'}</td>
        <td>${item.quantidade ?? '-'}</td>
        <td>${item.solicitante ?? '-'}</td>
        <td>${item.patrimonio ?? '-'}</td>
      </tr>
    `).join('');

    popup.document.write(`
      <html>
        <head>
          <title>${titulo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h1 { margin-bottom: 8px; }
            .meta { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>${titulo}</h1>
          <div class="meta">
            <div><strong>Data:</strong> ${tipo === 'Entrada' ? (registro.data_entrada ?? '-') : (registro.data_saida ?? '-')}</div>
            <div><strong>Observacao:</strong> ${registro.observacao ?? '-'}</div>
            <div><strong>${tipo === 'Entrada' ? 'Recebido por' : 'Responsavel'}:</strong> ${tipo === 'Entrada' ? (registro.recebido_por ?? '-') : (registro.responsavel ?? registro.registrado_por ?? '-')}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Codigo</th>
                <th>Item</th>
                <th>Quantidade</th>
                <th>Solicitante</th>
                <th>Patrimonio</th>
              </tr>
            </thead>
            <tbody>
              ${linhasItens || '<tr><td colspan="5">Nenhum item encontrado.</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `);

    popup.document.close();
    popup.focus();
    popup.print();
  }
}
