import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PedidoService } from '../../../services/pedido.service';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { HasPermissionDirective } from '../../../directives/has-permission.directive';
import { ItemService, Item } from '../../../services/item.service';

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
  erroMotivo = false;
  pedidoParaImprimir: any = null;
  currentDate: Date = new Date();
  pedidoSelecionadoParaImpressao: any = null;

  constructor(
    private pedidoService: PedidoService,
    private itemService: ItemService,
    private router: Router,
    private snackBar: SnackbarService
  ) {}

  ngOnInit(): void {
    this.carregarPedidos();
    this.carregarItens();
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
        pedido.status
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
    this.filtroStatus = 'pendente';
    this.filtroGrupo = 'todos';
    this.termoBusca = '';
  }

  imprimirPedido(pedido: any) {
    this.pedidoSelecionadoParaImpressao = pedido;
    this.currentDate = new Date();

    const conteudo = document.getElementById('conteudo-impressao')?.innerHTML;
    if (!conteudo) return;

    const janela = window.open('', '_blank');
    if (!janela) return;

    janela.document.write(`
      <html>
        <head>
          <title>Impressão do Pedido</title>
          <link rel="stylesheet" href="/assets/print.scss" />
        </head>
        <body>
          ${conteudo}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    janela.document.close();
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

  alterarStatusPedido(pedido: any) {
    this.pedidoSelecionado = pedido;
    this.novoStatus = pedido.status === 'pendente' ? 'enviado' : 'finalizado';
    this.motivoRecusado = '';
    this.erroMotivo = false;
  }

  fecharModal() {
    this.pedidoSelecionado = null;
    this.novoStatus = '';
    this.motivoRecusado = '';
    this.erroMotivo = false;
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
      this.snackBar.show('Item nao encontrado para adicionar ao pedido.', 'error');
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
        this.snackBar.show('Erro ao atualizar pedido.', 'error');
      }
    });
  }

  confirmarAlteracaoStatus() {
    if (this.novoStatus === 'finalizado' && !this.motivoRecusado.trim()) {
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
        this.snackBar.show(err?.error?.detail || 'Erro ao atualizar status do pedido.', 'error');
      }
    });
  }
}
