import { PedidoResumo, ModalConfirmarPedidoComponent } from './../modal-confirmar-pedido/modal-confirmar-pedido.component';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { PedidoService } from '../../../services/pedido.service';
import { ItemService, Item } from '../../../services/item.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { PedidoComponent } from '../pedido.component';
import { AutocompleteSelectComponent } from '../../../shared/autocomplete-select/autocomplete-select.component';
import { ControleService } from '../../../services/controle.service';

@Component({
  selector: 'app-criar-pedido',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ModalConfirmarPedidoComponent, AutocompleteSelectComponent],
  templateUrl: './criar-pedido.component.html',
  styleUrl: './criar-pedido.component.scss'
})
export class CriarPedidoComponent implements OnInit {
  pedidoForm!: FormGroup;
  itensDisponiveis: Item[] = [];
  itensSelecionados: number[] = [];
  pedidosExistentes: any[] = [];
  movimentacoesEstoque: { entradas: any[]; saidas: any[] } = { entradas: [], saidas: [] };
  itemHistoricoSelecionadoId: number | null = null;
  filtroTipoMovimentacao: 'todos' | 'entrada' | 'saida' = 'todos';
  modalConfirmacaoAberto = false;
  modalApoioEstoqueAberto = false;
  pedidoResumo!: PedidoResumo;
  itemLabel = (item: Item) => item ? `${item.nome} - ${item.codigo}` : '';
  itemSecondary = (item: Item) => item ? `${item.tipo_item?.nome || 'Sem grupo'} | Estoque ${item.quantidade_atual} | Minimo ${item.quantidade_minima}` : '';

  constructor(
    private fb: FormBuilder,
    private pedidoService: PedidoService,
    private itemService: ItemService,
    private controleService: ControleService,
    private router: Router,
    private snackBar: SnackbarService,
    private pedidoComponent: PedidoComponent
  ) {}

  ngOnInit() {
    this.pedidoForm = this.fb.group({
      solicitante: ['', Validators.required],
      setor_destino: ['', Validators.required],
      responsavel_setor: ['', Validators.required],
      itens: this.fb.array([])
    });

    this.itemService.listarItens().subscribe(itens => {
      this.itensDisponiveis = itens;
      this.pedidoComponent.itensDisponiveis = itens;
      this.adicionarItem();
    });

    this.carregarPedidosExistentes();
    this.carregarMovimentacoesEstoque();
  }

  get itens(): FormArray {
    return this.pedidoForm.get('itens') as FormArray;
  }

  getItensDisponiveisParaSelect(indexAtual: number): Item[] {
    const idsSelecionados = this.itensSelecionados.filter((_, i) => i !== indexAtual);
    const grupoBaseId = this.getGrupoBaseId(indexAtual);

    return this.itensDisponiveis.filter(item => {
      const itemAindaDisponivel = !idsSelecionados.includes(item.id);
      const mesmoGrupo = !grupoBaseId || item.tipo_item?.id === grupoBaseId;
      return itemAindaDisponivel && mesmoGrupo;
    });
  }

  adicionarItem() {
    const grupo = this.fb.group({
      item: [null, Validators.required],
      quantidade_pedida: [1, [Validators.required, Validators.min(1)]],
      quantidade_atual_estoque: [{ value: 0, disabled: true }],
      ultima_entrada_estoque: ['']
    });

    this.itens.push(grupo);
    const indexDoGrupo = this.itens.length - 1;

    grupo.get('item')?.valueChanges.subscribe(itemId => {
      if (!itemId) {
        grupo.patchValue({ quantidade_atual_estoque: 0, ultima_entrada_estoque: '' });
        this.atualizarItensSelecionados();
        return;
      }

      if (!this.validarGrupoDoItem(+itemId, indexDoGrupo)) {
        grupo.patchValue(
          {
            item: null,
            quantidade_atual_estoque: 0,
            ultima_entrada_estoque: ''
          },
          { emitEvent: false }
        );
        this.atualizarItensSelecionados();
        return;
      }

      this.pedidoComponent.atualizarEstoqueEEntrada(grupo, +itemId);
      this.atualizarItensSelecionados();
      if (!this.itemHistoricoSelecionadoId) {
        this.itemHistoricoSelecionadoId = +itemId;
      }
    });

    this.atualizarItensSelecionados();
    this.snackBar.show('Novo item adicionado ao pedido.', 'success');
  }

  removerItem(index: number) {
    this.pedidoComponent.removerItem(
      index,
      this.itens,
      this.itensDisponiveis,
      this.snackBar,
      ids => (this.itensSelecionados = ids)
    );
    this.atualizarItensSelecionados();
  }

  onItemSelecionado(index: number) {
    if (index < 0 || index >= this.itens.length) return;

    const grupo = this.itens.at(index) as FormGroup;
    const itemId = grupo.get('item')?.value;
    if (!itemId) {
      this.atualizarItensSelecionados();
      return;
    }

    if (!this.validarGrupoDoItem(+itemId, index)) {
      grupo.patchValue({
        item: null,
        quantidade_atual_estoque: 0,
        ultima_entrada_estoque: ''
      });
      this.atualizarItensSelecionados();
      return;
    }

    this.pedidoComponent.atualizarEstoqueEEntrada(grupo, +itemId);
    this.atualizarItensSelecionados();

    if (!this.itemHistoricoSelecionadoId) {
      this.itemHistoricoSelecionadoId = +itemId;
    }
  }

  enviarPedido() {
    this.pedidoForm.markAllAsTouched();

    if (this.pedidoForm.invalid) {
      this.snackBar.show('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    if (this.itens.length === 0) {
      this.snackBar.show('Adicione ao menos um item ao pedido.', 'error');
      return;
    }

    if (this.getQuantidadeTiposSelecionados() > 1) {
      this.snackBar.show('Todos os itens do pedido devem pertencer ao mesmo grupo.', 'error');
      return;
    }

    const pedidoAutomatico = this.getPedidoAutomaticoAbertoGrupo();
    if (pedidoAutomatico) {
      this.snackBar.show(
        `Ja existe o pedido automatico ${pedidoAutomatico.codigo_pedido} ativo para este grupo.`,
        'error'
      );
      return;
    }

    const pedido = this.pedidoForm.getRawValue();
    this.pedidoService.criarPedido(pedido).subscribe({
      next: res => {
        this.snackBar.show(`Pedido criado com sucesso. Código: ${res.codigo_pedido}`, 'success');
        this.router.navigate(['/pedido/listar']);
      },
      error: err => {
        const mensagem =
          err?.error?.non_field_errors?.[0] ||
          (Array.isArray(err?.error) ? err.error[0] : null) ||
          err?.error?.detail ||
          'Não foi possível criar o pedido.';
        this.snackBar.show(mensagem, 'error');
        console.error(err);
      }
    });
  }

  abrirModalConfirmacao() {
    const itensResumo = this.itens.controls.map(ctrl => ({
      nome: this.itensDisponiveis.find(i => i.id === +ctrl.get('item')?.value)?.nome ?? '',
      codigo: this.itensDisponiveis.find(i => i.id === +ctrl.get('item')?.value)?.codigo ?? '',
      quantidade_pedida: ctrl.get('quantidade_pedida')?.value ?? 0,
      quantidade_atual: ctrl.get('quantidade_atual_estoque')?.value ?? 0,
      ultima_entrada_estoque: ctrl.get('ultima_entrada_estoque')?.value
    }));

    this.pedidoResumo = {
      solicitante: this.pedidoForm.get('solicitante')?.value,
      setor_destino: this.pedidoForm.get('setor_destino')?.value,
      responsavel_setor: this.pedidoForm.get('responsavel_setor')?.value,
      itens: itensResumo
    };

    this.modalConfirmacaoAberto = true;
  }

  getItemSelecionado(index: number): Item | undefined {
    const itemId = +(this.itens.at(index)?.get('item')?.value ?? 0);
    return this.itensDisponiveis.find(item => item.id === itemId);
  }

  getNomeItemSelecionado(index: number): string {
    const item = this.getItemSelecionado(index);
    if (!item) {
      return 'Selecione um item';
    }

    return item.nome;
  }

  getQuantidadeTotalPedida(): number {
    return this.itens.controls.reduce((total, ctrl) => {
      const quantidade = Number(ctrl.get('quantidade_pedida')?.value ?? 0);
      return total + (Number.isFinite(quantidade) ? quantidade : 0);
    }, 0);
  }

  getItensEmBaixaSelecionados(): number {
    return this.itens.controls.reduce((total, _, index) => {
      const item = this.getItemSelecionado(index);
      return total + (item?.situacao === 'baixo' ? 1 : 0);
    }, 0);
  }

  getQuantidadeTiposSelecionados(): number {
    const tipos = new Set(
      this.itens.controls
        .map((_, index) => this.getItemSelecionado(index)?.tipo_item?.nome)
        .filter((tipo): tipo is string => !!tipo)
    );
    return tipos.size;
  }

  getUnidadeMedidaLabel(unidade: string | undefined): string {
    if (!unidade) {
      return 'Unidade não informada';
    }

    const encontrada = this.itemService.UNIDADE_MEDIDA_CHOICES.find(([valor]) => valor === unidade);
    return encontrada?.[1] ?? unidade;
  }

  getResumoItensSelecionados() {
    return this.itens.controls
      .map((ctrl, index) => {
        const item = this.getItemSelecionado(index);
        if (!item) {
          return null;
        }

        return {
          nome: item.nome,
          codigo: item.codigo,
          tipo: item.tipo_item?.nome || 'Sem grupo',
          quantidade: Number(ctrl.get('quantidade_pedida')?.value ?? 0)
        };
      })
      .filter((item): item is { nome: string; codigo: string; tipo: string; quantidade: number } => item !== null);
  }

  getItemMovimentacaoSelecionado(): Item | undefined {
    if (this.itemHistoricoSelecionadoId) {
      const itemHistorico = this.itensDisponiveis.find(item => item.id === this.itemHistoricoSelecionadoId);
      if (itemHistorico) {
        return itemHistorico;
      }
    }

    for (let index = 0; index < this.itens.length; index++) {
      const item = this.getItemSelecionado(index);
      if (item) {
        return item;
      }
    }

    return undefined;
  }

  onItemHistoricoSelecionado(item: Item | undefined) {
    this.itemHistoricoSelecionadoId = item?.id ?? null;
  }

  getItensHistoricoDisponiveis(): Item[] {
    const itens = this.temGrupoDefinido() ? this.getItensDoGrupoSelecionado() : this.itensDisponiveis;
    return [...itens].sort((a, b) => a.nome.localeCompare(b.nome));
  }

  getMovimentacoesItemSelecionado() {
    const item = this.getItemMovimentacaoSelecionado();
    if (!item) {
      return [];
    }

    const entradas = this.movimentacoesEstoque.entradas.flatMap((entrada: any) =>
      (entrada?.itens || [])
        .filter((itemMov: any) => this.movimentacaoPertenceAoItem(itemMov, item))
        .map((itemMov: any) => ({
          tipo: 'entrada',
          data: entrada?.data_movimentacao || entrada?.data_entrada || entrada?.criado_em,
          quantidade: Number(itemMov?.quantidade || 0),
          referencia: entrada?.nota_fiscal_detalhe?.numero_nota || `Entrada #${entrada?.id ?? '-'}`,
          detalhe: entrada?.nota_fiscal_detalhe?.nome_fornecedor || entrada?.recebido_por || 'Entrada de estoque'
        }))
    );

    const saidas = this.movimentacoesEstoque.saidas.flatMap((saida: any) =>
      (saida?.itens || [])
        .filter((itemMov: any) => this.movimentacaoPertenceAoItem(itemMov, item))
        .map((itemMov: any) => ({
          tipo: 'saida',
          data: saida?.data_movimentacao || saida?.data_saida || saida?.criado_em,
          quantidade: Number(itemMov?.quantidade || 0),
          referencia: saida?.bloco_requisicao || `Saida #${saida?.id ?? '-'}`,
          detalhe: itemMov?.solicitante || saida?.responsavel || saida?.setor || 'Saida de estoque'
        }))
    );

    return [...entradas, ...saidas]
      .filter(movimentacao => !!movimentacao.data || movimentacao.quantidade !== null)
      .filter(movimentacao => this.filtroTipoMovimentacao === 'todos' || movimentacao.tipo === this.filtroTipoMovimentacao)
      .sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime())
  }

  getTotalEntradaHistorico(): number {
    return this.getMovimentacoesItemSelecionado()
      .filter(movimentacao => movimentacao.tipo === 'entrada')
      .reduce((total, movimentacao) => total + Number(movimentacao.quantidade || 0), 0);
  }

  getTotalSaidaHistorico(): number {
    return this.getMovimentacoesItemSelecionado()
      .filter(movimentacao => movimentacao.tipo === 'saida')
      .reduce((total, movimentacao) => total + Number(movimentacao.quantidade || 0), 0);
  }

  getSaldoHistorico(): number {
    return this.getTotalEntradaHistorico() - this.getTotalSaidaHistorico();
  }

  setFiltroTipoMovimentacao(tipo: 'todos' | 'entrada' | 'saida') {
    this.filtroTipoMovimentacao = tipo;
  }

  getUltimaEntradaItemSelecionado(): any {
    const item = this.getItemMovimentacaoSelecionado();
    if (!item) {
      return null;
    }

    const controle = this.itens.controls.find(ctrl => Number(ctrl.get('item')?.value) === item.id);
    const data = controle?.get('ultima_entrada_estoque')?.value;
    if (!data) {
      return null;
    }

    return {
      tipo: 'entrada',
      data,
      quantidade: null,
      referencia: 'Ultima entrada'
    };
  }

  getGrupoSelecionadoNome(): string {
    const grupoBaseId = this.getGrupoBaseId();
    if (!grupoBaseId) {
      return 'Definido pelo primeiro item selecionado';
    }

    const item = this.itensDisponiveis.find(itemDisponivel => itemDisponivel.tipo_item?.id === grupoBaseId);
    return item?.tipo_item?.nome || 'Grupo não identificado';
  }

  temGrupoDefinido(): boolean {
    return !!this.getGrupoBaseId();
  }

  podeAdicionarMaisItens(): boolean {
    return !this.temGrupoDefinido() || this.getItensDisponiveisParaSelect(this.itens.length).length > 0;
  }

  abrirModalApoioEstoque() {
    if (!this.temGrupoDefinido()) {
      this.snackBar.show('Selecione um item para definir o grupo primeiro.', 'info');
      return;
    }

    this.modalApoioEstoqueAberto = true;
  }

  fecharModalApoioEstoque() {
    this.modalApoioEstoqueAberto = false;
  }

  getItensDoGrupoSelecionado(): Item[] {
    const grupoBaseId = this.getGrupoBaseId();
    if (!grupoBaseId) {
      return [];
    }

    return this.itensDisponiveis
      .filter(item => item.tipo_item?.id === grupoBaseId)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  getPedidoAutomaticoAbertoGrupo(): any | null {
    const grupoBaseId = this.getGrupoBaseId();
    if (!grupoBaseId) {
      return null;
    }

    return this.pedidosExistentes.find(pedido =>
      pedido?.gerado_automaticamente === true &&
      Number(pedido?.tipo_item) === grupoBaseId &&
      pedido?.status !== 'cancelado'
    ) || null;
  }

  temPedidoAutomaticoAbertoNoGrupo(): boolean {
    return !!this.getPedidoAutomaticoAbertoGrupo();
  }

  getStatusEstoqueItem(item: Item): string {
    const atual = Number(item.quantidade_atual ?? 0);
    const minimo = Number(item.quantidade_minima ?? 0);

    return atual <= minimo ? 'Baixo' : 'OK';
  }

  getClasseEstoqueItem(item: Item): string {
    return this.getStatusEstoqueItem(item) === 'Baixo' ? 'stock-status-low' : 'stock-status-ok';
  }

  getValorUnitarioFormatado(item: Item): string {
    const valor = Number(item.valor_unitario ?? 0);
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private atualizarItensSelecionados() {
    this.itensSelecionados = this.itens.controls
      .map(ctrl => Number(ctrl.get('item')?.value))
      .filter(itemId => !Number.isNaN(itemId) && itemId > 0);
  }

  private carregarPedidosExistentes() {
    this.pedidoService.listarPedidos().subscribe({
      next: pedidos => {
        this.pedidosExistentes = Array.isArray(pedidos) ? pedidos : [];
      },
      error: err => {
        console.error(err);
        this.pedidosExistentes = [];
      }
    });
  }

  private carregarMovimentacoesEstoque() {
    forkJoin({
      entradas: this.controleService.listarEntradasEstoque(),
      saidas: this.controleService.listarSaidasEstoque()
    }).subscribe({
      next: movimentacoes => {
        this.movimentacoesEstoque = {
          entradas: movimentacoes?.entradas || [],
          saidas: movimentacoes?.saidas || []
        };
      },
      error: err => {
        console.error(err);
        this.movimentacoesEstoque = { entradas: [], saidas: [] };
      }
    });
  }

  private movimentacaoPertenceAoItem(itemMov: any, item: Item): boolean {
    const itemMovId = Number(typeof itemMov?.item === 'object' ? itemMov?.item?.id : itemMov?.item || 0);
    if (itemMovId && itemMovId === item.id) {
      return true;
    }

    const codigo = String(itemMov?.item_codigo || '').trim();
    if (codigo && codigo === item.codigo) {
      return true;
    }

    const nome = String(itemMov?.item_nome || itemMov?.produto_nome || '').trim();
    return !!nome && nome === item.nome;
  }

  private getGrupoBaseId(indexIgnorado?: number): number | null {
    for (let index = 0; index < this.itens.length; index++) {
      if (index === indexIgnorado) {
        continue;
      }

      const itemSelecionado = this.getItemSelecionado(index);
      if (itemSelecionado?.tipo_item?.id) {
        return itemSelecionado.tipo_item.id;
      }
    }

    return null;
  }

  private validarGrupoDoItem(itemId: number, indexAtual: number): boolean {
    const itemSelecionado = this.itensDisponiveis.find(item => item.id === itemId);
    const grupoBaseId = this.getGrupoBaseId(indexAtual);

    if (!itemSelecionado?.tipo_item?.id) {
      this.snackBar.show('Esse item não possui grupo vinculado e não pode entrar no pedido.', 'error');
      return false;
    }

    if (!grupoBaseId || itemSelecionado.tipo_item.id === grupoBaseId) {
      return true;
    }

    this.snackBar.show('Todos os itens do pedido precisam ser do mesmo grupo.', 'error');
    return false;
  }
}
