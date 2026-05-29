import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PedidoService } from '../../../services/pedido.service';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';
import { ItemService, Item } from '../../../services/item.service';
import { AuthenticationService } from '../../../services/authentication.service';

@Component({
  selector: 'app-iniciar-pedido',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, HasPermissionDirective],
  templateUrl: './iniciar-pedido.component.html',
  styleUrl: './iniciar-pedido.component.scss'
})
export class IniciarPedidoComponent implements OnInit {
  pedidos: any[] = [];
  itensDisponiveis: Item[] = [];
  carregando = true;
  pedidoSelecionado: any = null;
  pedidoParaEditar: any = null;
  filtroStatus = 'pendente';
  filtroGrupo = 'todos';
  termoBusca = '';
  novoStatus = '';
  motivoRecusado = '';
  motivoNegadoCompras = '';
  erroMotivo = false;
  erroMotivoCompras = false;
  pedidoComprasSelecionado: any = null;
  pedidoParaImprimir: any = null;
  currentDate: Date = new Date();
  pedidoSelecionadoParaImpressao: any = null;
  usuarioLogado: any = null;

  constructor(
    private pedidoService: PedidoService,
    private itemService: ItemService,
    private authService: AuthenticationService,
    private router: Router,
    private snackBar: SnackbarService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.usuarioLogado = this.authService.getUsuarioLogadoValue();
    this.aplicarFiltroPadraoPorPerfil();
    this.authService.getUsuarioLogadoSubject().subscribe((usuario) => {
      this.usuarioLogado = usuario;
      this.aplicarFiltroPadraoPorPerfil();
    });
    this.carregarPedidos();
    this.carregarItens();
  }

  get isCompras(): boolean {
    return this.usuarioLogado?.nivel_permissao === 'compra';
  }

  get podeGerenciarStatusGeral(): boolean {
    return ['administrador', 'moderador', 'almoxarifado'].includes(this.usuarioLogado?.nivel_permissao);
  }

  carregarItens(): void {
    this.itemService.listarItens().subscribe({
      next: (res) => {
        this.itensDisponiveis = res;
      },
      error: (err) => {
        console.error('Erro ao carregar itens:', err);
      }
    });
  }

  carregarPedidos(): void {
    this.pedidoService.listarPedidos().subscribe({
      next: (res) => {
        this.pedidos = [...res].sort((a, b) =>
          new Date(b.criado_em || 0).getTime() - new Date(a.criado_em || 0).getTime()
        );
        this.carregando = false;
      },
      error: (err) => {
        console.error('Erro ao carregar pedidos:', err);
        this.carregando = false;
      }
    });
  }

  visualizarItens(pedido: any) {
    console.log('Visualizando itens de:', pedido.codigo_pedido);
  }

  get pedidosFiltrados(): any[] {
    return this.pedidos.filter((pedido) => {
      const correspondeStatus = this.filtroStatus === 'todos' || pedido.status === this.filtroStatus;
      const correspondeGrupo = this.filtroGrupo === 'todos' || (pedido.tipo_item_nome || 'Sem grupo') === this.filtroGrupo;

      const termo = this.termoBusca.trim().toLowerCase();
      const correspondeBusca = !termo || [
        pedido.codigo_pedido,
        pedido.tipo_item_nome,
        pedido.setor_destino,
        pedido.responsavel_setor,
        pedido.criado_por,
        pedido.status,
        pedido.compras_motivo_negado
      ]
        .some(valor => (valor || '').toString().toLowerCase().includes(termo));

      return correspondeStatus && correspondeGrupo && correspondeBusca;
    });
  }

  get gruposDisponiveis(): string[] {
    return [...new Set(
      this.pedidos
        .map(pedido => pedido.tipo_item_nome || 'Sem grupo')
        .filter((grupo: string) => !!grupo)
    )].sort((a, b) => a.localeCompare(b));
  }

  limparFiltros(): void {
    this.filtroStatus = this.isCompras ? 'todos' : 'pendente';
    this.filtroGrupo = 'todos';
    this.termoBusca = '';
  }

  private aplicarFiltroPadraoPorPerfil(): void {
    if (this.isCompras && this.filtroStatus === 'pendente') {
      this.filtroStatus = 'todos';
    }
  }

  imprimirPedido(pedido: any) {
    this.pedidoSelecionadoParaImpressao = pedido;
    this.currentDate = new Date();
    this.cdr.detectChanges();

    const origem = window.location.origin;
    const conteudo = document.getElementById('conteudo-impressao')?.innerHTML
      ?.replaceAll('src="/assets/', `src="${origem}/assets/`);
    if (!conteudo) return;

    const janela = window.open('', '_blank');
    if (!janela) return;

    janela.document.write(`
      <html>
        <head>
          <title>Impressao do Pedido</title>
          <link rel="stylesheet" href="${origem}/assets/print.css" />
        </head>
        <body>
          ${conteudo}
          <script>
            var imprimiu = false;
            function imprimirQuandoPronto() {
              if (imprimiu) return;
              imprimiu = true;
              window.focus();
              window.print();
              window.close();
            }
            window.addEventListener('load', function() {
              setTimeout(imprimirQuandoPronto, 250);
            });
            setTimeout(imprimirQuandoPronto, 1500);
          </script>
        </body>
      </html>
    `);
    janela.document.close();
    this.pedidoSelecionadoParaImpressao = null;
    this.cdr.detectChanges();
  }

  atualizarPedido(pedido: any): void {
    this.pedidoParaEditar = {
      ...pedido,
      novoItemId: null,
      novaQuantidade: 1,
      itens: (pedido.itens ?? []).map((item: any) => ({
        ...item,
        quantidade_pedida: Number(item.quantidade_pedida)
      }))
    };
  }

  resumoMetricaReposicao(item: any): string {
    const metrica = item?.metrica_reposicao;
    if (!metrica || !Object.keys(metrica).length) {
      return item?.adicionado_automaticamente
        ? 'Automatico - calculo sera exibido no proximo recalculo'
        : 'Manual - quantidade definida pelo usuario';
    }

    const temCalculoNovo = (
      metrica.quantidade_consumida !== undefined ||
      metrica.dias_analisados !== undefined ||
      metrica.ultima_entrada_utilizada !== undefined ||
      metrica.quantidade_sugerida !== undefined
    );

    if (temCalculoNovo) {
      const partes = [];
      const ultimaEntrada = this.formatarDataMetrica(metrica.ultima_entrada_utilizada);
      const consumido = this.formatarNumeroMetrica(metrica.quantidade_consumida);
      const diasAnalisados = metrica.dias_analisados;
      const media = this.formatarNumeroMetrica(metrica.consumo_medio ?? metrica.consumo_ponderado);
      const cobertura = metrica.dias_cobertura;
      const sugerido = this.formatarNumeroMetrica(metrica.quantidade_sugerida ?? item?.quantidade_pedida);

      if (ultimaEntrada !== '-') partes.push(`ultima entrada ${ultimaEntrada}`);
      if (consumido !== '-' && diasAnalisados) partes.push(`consumo ${consumido} em ${diasAnalisados}d`);
      if (media !== '-') partes.push(`media ${media}/dia`);
      if (cobertura) partes.push(`cobertura ${cobertura}d`);
      if (sugerido !== '-') partes.push(`sugerido ${sugerido}`);

      if (!partes.length && metrica.motivo) {
        return metrica.motivo;
      }

      return partes.join(' - ') || 'Calculo automatico sem dados suficientes';
    }

    const consumo = this.formatarNumeroMetrica(metrica.consumo_ponderado ?? metrica.consumo_medio);
    const cobertura = metrica.dias_cobertura;
    const partes = ['Metrica antiga'];
    if (consumo !== '-') partes.push(`cons. ${consumo}/dia`);
    if (cobertura) partes.push(`cobertura ${cobertura}d`);
    if (metrica.motivo) partes.push(metrica.motivo);

    return partes.join(' - ');
  }

  private formatarNumeroMetrica(valor: any): string {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) {
      return '-';
    }

    return numero.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }

  private formatarDataMetrica(valor: any): string {
    if (!valor) {
      return '-';
    }

    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) {
      return '-';
    }

    return data.toLocaleDateString('pt-BR');
  }

  alterarStatusPedido(pedido: any) {
    this.pedidoSelecionado = pedido;
    this.novoStatus = pedido.status === 'pendente' ? 'enviado' : 'cancelado';
    this.motivoRecusado = '';
    this.erroMotivo = false;
  }

  abrirNegativaCompras(pedido: any): void {
    this.pedidoComprasSelecionado = pedido;
    this.motivoNegadoCompras = '';
    this.erroMotivoCompras = false;
  }

  fecharModal() {
    this.pedidoSelecionado = null;
    this.novoStatus = '';
    this.motivoRecusado = '';
    this.erroMotivo = false;
  }

  fecharModalCompras(): void {
    this.pedidoComprasSelecionado = null;
    this.motivoNegadoCompras = '';
    this.erroMotivoCompras = false;
  }

  fecharModalEdicaoPedido() {
    this.pedidoParaEditar = null;
  }

  getItensDisponiveisParaEdicao(): Item[] {
    if (!this.pedidoParaEditar) {
      return [];
    }

    const idsSelecionados = new Set(
      (this.pedidoParaEditar.itens ?? []).map((item: any) => Number(item.item))
    );

    return this.itensDisponiveis.filter((item) =>
      item.tipo_item?.id === this.pedidoParaEditar.tipo_item &&
      !idsSelecionados.has(item.id)
    );
  }

  adicionarItemNaEdicao() {
    if (!this.pedidoParaEditar) {
      return;
    }

    const itemId = Number(this.pedidoParaEditar.novoItemId);
    const quantidade = Number(this.pedidoParaEditar.novaQuantidade);

    if (!itemId || quantidade <= 0) {
      this.snackBar.show('Selecione um item e informe uma quantidade valida.', 'error');
      return;
    }

    const itemSelecionado = this.itensDisponiveis.find((item) => item.id === itemId);
    if (!itemSelecionado) {
      this.snackBar.show('Item não encontrado para adicionar ao pedido.', 'error');
      return;
    }

    this.pedidoParaEditar.itens.push({
      item: itemSelecionado.id,
      item_codigo: itemSelecionado.codigo,
      item_nome: itemSelecionado.nome,
      quantidade_pedida: quantidade,
      ultima_entrada_estoque: null
    });

    this.pedidoParaEditar.novoItemId = null;
    this.pedidoParaEditar.novaQuantidade = 1;
    this.snackBar.show('Item adicionado ao pedido.', 'success');
  }

  removerItemDaEdicao(index: number) {
    if (!this.pedidoParaEditar) {
      return;
    }

    this.pedidoParaEditar.itens.splice(index, 1);
  }

  salvarEdicaoPedido() {
    if (!this.pedidoParaEditar) return;

    if (!this.pedidoParaEditar.itens.length) {
      this.snackBar.show('O pedido precisa ter pelo menos um item ou ser cancelado.', 'error');
      return;
    }

    const itensInvalidos = this.pedidoParaEditar.itens.some((item: any) => !item.quantidade_pedida || Number(item.quantidade_pedida) <= 0);
    if (itensInvalidos) {
      this.snackBar.show('Informe quantidades válidas para todos os itens.', 'error');
      return;
    }

    const body = {
      solicitante: this.pedidoParaEditar.solicitante,
      setor_destino: this.pedidoParaEditar.setor_destino,
      responsavel_setor: this.pedidoParaEditar.responsavel_setor,
      itens: this.pedidoParaEditar.itens.map((item: any) => ({
        item: item.item,
        quantidade_pedida: Number(item.quantidade_pedida),
        ultima_entrada_estoque: item.ultima_entrada_estoque ?? null
      }))
    };

    this.pedidoService.atualizarPedido(this.pedidoParaEditar.id, body).subscribe({
      next: () => {
        this.snackBar.show('Pedido atualizado com sucesso.', 'success');
        this.fecharModalEdicaoPedido();
        this.carregarPedidos();
      },
      error: (err) => {
        console.error('Erro ao atualizar pedido:', err);
        this.snackBar.show('Não foi possível atualizar o pedido.', 'error');
      }
    });
  }

  confirmarAlteracaoStatus() {
    if (this.novoStatus === 'cancelado' && !this.motivoRecusado.trim()) {
      this.erroMotivo = true;
      return;
    }

    const id = this.pedidoSelecionado.id;

    this.pedidoService.atualizarStatusPedido(id, this.novoStatus, this.motivoRecusado).subscribe({
      next: () => {
        this.snackBar.show('Status do pedido atualizado com sucesso.', 'success');
        this.fecharModal();
        this.carregarPedidos();
      },
      error: (err) => {
        console.error('Erro ao atualizar status:', err);
        this.snackBar.show(err?.error?.detail || 'Não foi possível atualizar o status do pedido.', 'error');
      }
    });
  }

  marcarVistoCompras(pedido: any): void {
    this.pedidoService.atualizarStatusComprasPedido(pedido.id, 'visto').subscribe({
      next: () => {
        this.snackBar.show('Pedido marcado como visto por compras.', 'success');
        this.carregarPedidos();
      },
      error: (err) => {
        console.error('Erro ao marcar ciência de compras:', err);
        this.snackBar.show(err?.error?.detail || 'Não foi possível marcar ciência de compras.', 'error');
      }
    });
  }

  confirmarNegativaCompras(): void {
    if (!this.pedidoComprasSelecionado) return;

    if (!this.motivoNegadoCompras.trim()) {
      this.erroMotivoCompras = true;
      return;
    }

    this.pedidoService
      .atualizarStatusComprasPedido(this.pedidoComprasSelecionado.id, 'negado', this.motivoNegadoCompras)
      .subscribe({
        next: () => {
          this.snackBar.show('Pedido negado por compras.', 'success');
          this.fecharModalCompras();
          this.carregarPedidos();
        },
        error: (err) => {
          console.error('Erro ao negar pedido por compras:', err);
          this.snackBar.show(err?.error?.detail || 'Não foi possível negar o pedido por compras.', 'error');
        }
      });
  }
}
