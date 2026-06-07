import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Item, ItemService } from '../../../services/item.service';
import { ControleService } from '../../../services/controle.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { ProdutoService } from '../../../services/produto.service';
import { AutocompleteSelectComponent } from '../../../shared/autocomplete-select/autocomplete-select.component';

const MENSAGEM_ITEM_INATIVO = 'Este produto está inativo e não pode ser utilizado em novas operações.';

@Component({
  selector: 'app-registrar-saida',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AutocompleteSelectComponent],
  templateUrl: './registrar-saida.component.html',
  styleUrl: './registrar-saida.component.scss'
})
export class RegistrarSaidaComponent {
  @ViewChild('campoCodigoBarras') campoCodigoBarras?: ElementRef<HTMLInputElement>;

  form: FormGroup;
  itensDisponiveis: Item[] = [];
  itensSelecionados: number[] = [];
  mostrarModalConfirmacao = false;
  patrimonios: any[] = [];
  modoEdicao = false;
  registroId: number | null = null;
  carregandoRegistro = false;
  setoresOptions: string[] = [];
  responsaveisOptions: string[] = [];
  solicitantesOptions: string[] = [];
  patrimoniosOptions: string[] = [];
  patrimoniosHistoricosOptions: string[] = [];
  caFeedbackPorLinha: Record<number, string> = {};
  codigoBarrasLeitura = '';
  buscandoCodigoBarras = false;
  textoLabel = (value: string) => value || '';
  textoValue = (value: string) => value || '';
  itemLabel = (item: Item) => item ? `${item.codigo} - ${item.nome}` : '';
  itemSecondary = (item: Item) => {
    const grupo = item?.tipo_item?.nome ? `Grupo: ${item.tipo_item.nome}` : 'Sem grupo';
    const estoque = `Estoque: ${item?.quantidade_atual ?? 0} ${item?.unidade_medida ?? ''}`.trim();
    const prateleira = item?.prateleira_estoque ? `Prateleira: ${item.prateleira_estoque}` : '';
    return [grupo, estoque, prateleira].filter(Boolean).join(' | ');
  };

  constructor(
    private fb: FormBuilder,
    private itemService: ItemService,
    private controleService: ControleService,
    private snackbar: SnackbarService,
    private router: Router,
    private produtoService: ProdutoService,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      bloco_requisicao: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
      data_movimentacao: [this.getDataAtualInput(), Validators.required],
      setor: ['', Validators.required],
      responsavel: ['', Validators.required],
      observacao: [''],
      itens: this.fb.array([])
    });

    this.itemService.listarItens().subscribe(itens => {
      this.itensDisponiveis = itens.filter(item => item.status !== 'inativo');
      this.inicializarModoFormulario();
    });

    this.produtoService.listarProdutos().subscribe(patrimonios => {
      this.patrimonios = patrimonios;
      this.atualizarSugestoesPatrimonio();
    });

    this.carregarSugestoesMovimentacao();
  }

  criarItem(): FormGroup {
    return this.fb.group({
      item: [null, Validators.required],
      quantidade: [1, [Validators.required, Validators.min(1)]],
      solicitante: ['', Validators.required],
      patrimonio: ['']
    });
  }

  get itens(): FormArray {
    return this.form.get('itens') as FormArray;
  }

  adicionarItem() {
    this.itens.push(this.criarItem());
  }

  removerItem(index: number) {
    this.itens.removeAt(index);
    delete this.caFeedbackPorLinha[index];
    this.atualizarItensSelecionados();
  }

  onItemSelecionado(index: number) {
    this.atualizarItensSelecionados();
    const grupo = this.itens.at(index);
    grupo.get('patrimonio')?.setValue('');
    this.preencherCaDisponivel(index, true);
  }

  lerCodigoBarras(event?: Event) {
    event?.preventDefault();

    const codigo = this.normalizarCodigoBarras(this.codigoBarrasLeitura);
    if (!codigo || this.buscandoCodigoBarras) {
      return;
    }

    this.buscandoCodigoBarras = true;

    this.itemService.buscarItemPorCodigoBarras(codigo).subscribe({
      next: (item) => {
        if (item.status === 'inativo') {
          this.snackbar.show(MENSAGEM_ITEM_INATIVO, 'error');
          this.codigoBarrasLeitura = '';
          this.buscandoCodigoBarras = false;
          this.focarCampoCodigoBarras();
          return;
        }

        this.adicionarOuSomarItemLido(item);
        this.codigoBarrasLeitura = '';
        this.buscandoCodigoBarras = false;
        this.focarCampoCodigoBarras();
      },
      error: () => {
        this.snackbar.show('Código de barras não encontrado.', 'warning');
        this.codigoBarrasLeitura = '';
        this.buscandoCodigoBarras = false;
        this.focarCampoCodigoBarras();
      }
    });
  }

  atualizarItensSelecionados() {
    this.itensSelecionados = this.itens.controls
      .map(c => +c.get('item')?.value)
      .filter(v => !isNaN(v));
  }

  confirmar() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.itens.length === 0) {
      this.snackbar.show('Adicione ao menos um item à saída.', 'warning');
      return;
    }

    const possuiItemInativo = this.form.value.itens.some((itemForm: any) => {
      const item = this.itensDisponiveis.find(itemDisponivel => itemDisponivel.id === Number(itemForm.item));
      return item?.status === 'inativo';
    });

    if (possuiItemInativo) {
      this.snackbar.show(MENSAGEM_ITEM_INATIVO, 'error');
      return;
    }

    const epiSemCa = this.form.value.itens.some((itemForm: any) =>
      this.itemSelecionadoEhEpi(itemForm.item) && !String(itemForm.patrimonio || '').trim()
    );

    if (epiSemCa) {
      this.form.markAllAsTouched();
      this.snackbar.show('Informe o C.A. para todos os itens do tipo EPI.', 'warning');
      return;
    }

    this.mostrarModalConfirmacao = true;
  }

  cancelarConfirmacao() {
    this.mostrarModalConfirmacao = false;
  }

  confirmarEnvio() {
    this.mostrarModalConfirmacao = false;

    const saidaData = {
      bloco_requisicao: this.form.value.bloco_requisicao,
      data_movimentacao: this.form.value.data_movimentacao,
      setor: this.form.value.setor,
      responsavel: this.form.value.responsavel,
      observacao: this.form.value.observacao,
      itens: this.form.value.itens
    };

    const requisicao = this.modoEdicao && this.registroId
      ? this.controleService.atualizarSaidaEstoque(this.registroId, saidaData)
      : this.controleService.registrarSaidaEstoque(saidaData);
    const possuiItemEpi = this.form.value.itens.some((itemForm: any) => this.itemSelecionadoEhEpi(itemForm.item));

    requisicao.subscribe({
      next: () => {
        this.form.reset();
        this.itens.clear();
        this.adicionarItem();
        this.snackbar.show(this.modoEdicao ? 'Saída atualizada com sucesso.' : 'Saída registrada com sucesso.', 'success');
        if (possuiItemEpi) {
          this.snackbar.show('Retirada de EPI registrada no controle de assinaturas.', 'info');
        }
        this.router.navigate(['/controle/iniciar']);
      },
      error: err => this.exibirErroSaida(err)
    });
  }

  temItemValido(): boolean {
    return this.itens.controls.some(i => i.get('item')?.value && i.get('quantidade')?.value > 0);
  }

  getItemNome(itemId: any): string {
    const id = Number(itemId);
    const item = this.itensDisponiveis.find(i => i.id === id);
    return item ? `${item.codigo} - ${item.nome}` : 'Item desconhecido';
  }

  getPatrimonioNome(patrimonioId: any): string {
    const id = Number(patrimonioId);
    const p = this.patrimonios.find(x => x.id === id);
    return p ? `${p.patrimonio} - ${p.nome}` : 'Patrimônio não encontrado';
  }

  itemSelecionadoEhEpi(itemId: any): boolean {
    const itemSelecionado = this.itensDisponiveis.find(item => item.id === Number(itemId));
    return itemSelecionado?.tipo_item?.nome?.trim().toUpperCase() === 'EPI';
  }

  getPatrimonioCaLabel(itemId: any): string {
    return this.itemSelecionadoEhEpi(itemId) ? 'C.A.' : 'Patrimonio';
  }

  getPatrimonioCaPlaceholder(itemId: any): string {
    return this.itemSelecionadoEhEpi(itemId) ? 'C.A. do EPI' : 'Patrimonio';
  }

  getCaFeedback(index: number): string {
    return this.caFeedbackPorLinha[index] || '';
  }

  private adicionarOuSomarItemLido(item: Item) {
    if (!this.itensDisponiveis.some(itemDisponivel => itemDisponivel.id === item.id)) {
      this.itensDisponiveis = [...this.itensDisponiveis, item];
    }

    const itemExistente = this.itens.controls.find(control => Number(control.get('item')?.value) === item.id);

    if (itemExistente) {
      const quantidadeAtual = Number(itemExistente.get('quantidade')?.value || 0);
      itemExistente.patchValue({ quantidade: quantidadeAtual + 1 });
      this.snackbar.show(`Quantidade somada: ${item.codigo} - ${item.nome}`, 'success');
      const index = this.itens.controls.indexOf(itemExistente);
      this.preencherCaDisponivel(index);
      return;
    }

    const linhaVazia = this.itens.controls.find(control => !control.get('item')?.value);
    const grupo = linhaVazia || this.criarItem();

    grupo.patchValue({
      item: item.id,
      quantidade: 1
    });

    if (!linhaVazia) {
      this.itens.push(grupo);
    }

    this.atualizarItensSelecionados();
    const index = this.itens.controls.indexOf(grupo);
    this.preencherCaDisponivel(index, true);
    this.snackbar.show(`Item adicionado: ${item.codigo} - ${item.nome}`, 'success');
  }

  private normalizarCodigoBarras(codigo: string): string {
    return String(codigo || '').replace(/\D/g, '');
  }

  private getDataAtualInput(): string {
    return this.formatarDataInput(new Date());
  }

  private formatarDataInput(data: string | Date): string {
    if (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}/.test(data)) {
      return data.slice(0, 10);
    }

    const dataObj = data instanceof Date ? data : new Date(data);
    if (Number.isNaN(dataObj.getTime())) {
      return this.formatarDataInput(new Date());
    }

    const ano = dataObj.getFullYear();
    const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
    const dia = String(dataObj.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  private focarCampoCodigoBarras() {
    setTimeout(() => this.campoCodigoBarras?.nativeElement.focus(), 0);
  }

  private preencherCaDisponivel(index: number, substituir = false) {
    const grupo = this.itens.at(index);
    const itemId = Number(grupo?.get('item')?.value);

    if (!itemId || !this.itemSelecionadoEhEpi(itemId)) {
      delete this.caFeedbackPorLinha[index];
      return;
    }

    const valorAtual = String(grupo.get('patrimonio')?.value || '').trim();
    if (valorAtual && !substituir) {
      return;
    }

    this.caFeedbackPorLinha[index] = 'Buscando C.A. disponivel...';

    this.controleService.buscarCaDisponivel(itemId).subscribe({
      next: (resposta) => {
        const ca = String(resposta?.ca || '').trim();
        if (ca) {
          grupo.get('patrimonio')?.setValue(ca);
          this.caFeedbackPorLinha[index] = `C.A. ${ca} preenchido pelo lote mais antigo.`;
          return;
        }

        grupo.get('patrimonio')?.setValue('');
        this.caFeedbackPorLinha[index] = 'Nenhum C.A. encontrado. Informe manualmente.';
      },
      error: () => {
        this.caFeedbackPorLinha[index] = 'Nao foi possivel buscar o C.A. Informe manualmente.';
      }
    });
  }

  private inicializarModoFormulario() {
    const idParam = this.route.snapshot.paramMap.get('id');

    if (idParam) {
      this.modoEdicao = true;
      this.registroId = Number(idParam);
      this.carregarRegistro(this.registroId);
      return;
    }

    this.adicionarItem();
    this.onItemSelecionado(0);
  }

  private carregarRegistro(id: number) {
    this.carregandoRegistro = true;

    this.controleService.obterSaidaEstoque(id).subscribe({
      next: (saida) => {
        this.form.patchValue({
          bloco_requisicao: saida.bloco_requisicao ?? '',
          data_movimentacao: this.formatarDataInput(saida.data_movimentacao || saida.data_saida),
          setor: saida.setor ?? '',
          responsavel: saida.responsavel ?? '',
          observacao: saida.observacao ?? ''
        });

        this.itens.clear();

        const itens = saida.itens?.length ? saida.itens : [null];
        itens.forEach((item: any) => {
          this.itens.push(this.fb.group({
            item: [item?.item ?? null, Validators.required],
            quantidade: [item?.quantidade ?? 1, [Validators.required, Validators.min(1)]],
            solicitante: [item?.solicitante ?? '', Validators.required],
            patrimonio: [item?.patrimonio ?? '']
          }));
        });

        this.atualizarItensSelecionados();
        this.carregandoRegistro = false;
      },
      error: () => {
        this.carregandoRegistro = false;
        this.snackbar.show('Não foi possível carregar a saída para edição.', 'error');
        this.router.navigate(['/controle/iniciar']);
      }
    });
  }

  private carregarSugestoesMovimentacao() {
    this.controleService.listarMovimentacoesEstoque().subscribe({
      next: (movimentacoes) => {
        const saidas = movimentacoes?.saidas || [];
        const itensSaida = saidas.flatMap((saida: any) => saida.itens || []);

        this.setoresOptions = this.getValoresUnicos(saidas.map((saida: any) => saida.setor));
        this.responsaveisOptions = this.getValoresUnicos(saidas.map((saida: any) => saida.responsavel));
        this.solicitantesOptions = this.getValoresUnicos(itensSaida.map((item: any) => item.solicitante));
        this.patrimoniosHistoricosOptions = this.getValoresUnicos(itensSaida.map((item: any) => item.patrimonio));
        this.atualizarSugestoesPatrimonio();
      },
      error: () => {
        this.setoresOptions = [];
        this.responsaveisOptions = [];
        this.solicitantesOptions = [];
        this.patrimoniosHistoricosOptions = [];
        this.atualizarSugestoesPatrimonio();
      }
    });
  }

  private atualizarSugestoesPatrimonio() {
    const patrimoniosProdutos = (this.patrimonios || [])
      .map((produto: any) => produto?.patrimonio);

    this.patrimoniosOptions = this.getValoresUnicos([
      ...this.patrimoniosHistoricosOptions,
      ...patrimoniosProdutos
    ]);
  }

  private getValoresUnicos(valores: any[]): string[] {
    return Array.from(new Set(
      valores
        .map(valor => String(valor || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b));
  }

  private exibirErroSaida(err: any) {
    if (err.status === 400 && err.error && typeof err.error === 'object') {
      const mensagens: string[] = [];

      for (const key in err.error) {
        if (Object.prototype.hasOwnProperty.call(err.error, key)) {
          const msgs = err.error[key];
          if (Array.isArray(msgs)) {
            mensagens.push(...msgs);
          } else if (typeof msgs === 'string') {
            mensagens.push(msgs);
          }
        }
      }

      const mensagemFinal = mensagens.length > 0
        ? mensagens.join(', ')
        : 'Não foi possível validar os dados informados.';

      this.snackbar.show(mensagemFinal, 'error');
      return;
    }

    if (err.error && err.error.detail) {
      this.snackbar.show(err.error.detail, 'error');
      return;
    }

    this.snackbar.show('Não foi possível concluir a operação. Tente novamente.', 'error');
  }
}
