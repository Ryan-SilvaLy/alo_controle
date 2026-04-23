import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ControleService } from '../../../services/controle.service';
import { Item, ItemService } from '../../../services/item.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';

@Component({
  selector: 'app-iniciar-produto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './iniciar-produto.component.html',
  styleUrl: './iniciar-produto.component.scss'
})
export class IniciarProdutoComponent {
  itensResumo: any[] = [];
  carregando = true;
  erro: string | null = null;
  termoBusca = '';

  constructor(
    private itemService: ItemService,
    private controleService: ControleService,
    private snackbar: SnackbarService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.carregarResumoItens();
  }

  get itensFiltrados(): any[] {
    const termo = this.termoBusca.trim().toLowerCase();

    return this.itensResumo.filter((item) => {
      if (!termo) {
        return true;
      }

      return [
        item.codigo,
        item.nome,
        item.grupo,
        item.prateleira,
        item.situacao
      ].some((valor) => (valor || '').toString().toLowerCase().includes(termo));
    });
  }

  get totalItens(): number {
    return this.itensResumo.length;
  }

  get totalEntradas(): number {
    return this.itensResumo.reduce((acc, item) => acc + item.quantidadeEntrada, 0);
  }

  get totalSaidas(): number {
    return this.itensResumo.reduce((acc, item) => acc + item.quantidadeSaida, 0);
  }

  get itensComMovimentacao(): number {
    return this.itensResumo.filter((item) => item.totalMovimentacoes > 0).length;
  }

  limparBusca() {
    this.termoBusca = '';
  }

  abrirFornecedores() {
    this.router.navigate(['/produto/criar']);
  }

  abrirDashboard() {
    this.router.navigate(['/produto/dashboard']);
  }

  private carregarResumoItens() {
    this.carregando = true;
    this.erro = null;

    forkJoin({
      itens: this.itemService.listarItens(),
      entradas: this.controleService.listarEntradasEstoque(),
      saidas: this.controleService.listarSaidasEstoque()
    }).subscribe({
      next: ({ itens, entradas, saidas }) => {
        this.itensResumo = this.montarResumoItens(itens, entradas, saidas);
        this.carregando = false;
      },
      error: (err) => {
        console.error(err);
        this.erro = 'Erro ao carregar o resumo de movimentacoes por item.';
        this.snackbar.show(this.erro, 'error');
        this.carregando = false;
      }
    });
  }

  private montarResumoItens(itens: Item[], entradas: any[], saidas: any[]): any[] {
    const mapaResumo = new Map<number, any>();

    itens.forEach((item) => {
      mapaResumo.set(item.id, {
        id: item.id,
        codigo: item.codigo,
        nome: item.nome,
        grupo: item.tipo_item?.nome || 'Sem grupo',
        prateleira: item.prateleira_estoque || '-',
        estoqueAtual: item.quantidade_atual || 0,
        quantidadeMinima: item.quantidade_minima || 0,
        unidadeMedida: item.unidade_medida || '-',
        situacao: item.situacao || '-',
        quantidadeEntrada: 0,
        quantidadeSaida: 0,
        movimentacoesEntrada: 0,
        movimentacoesSaida: 0,
        totalMovimentacoes: 0,
        ultimaEntrada: null,
        ultimaSaida: null
      });
    });

    entradas.forEach((entrada) => {
      (entrada.itens || []).forEach((itemMov: any) => {
        const resumo = mapaResumo.get(itemMov.item);
        if (!resumo) return;

        resumo.quantidadeEntrada += Number(itemMov.quantidade || 0);
        resumo.movimentacoesEntrada += 1;
        resumo.totalMovimentacoes += 1;

        const dataEntrada = entrada.data_entrada || entrada.criado_em || null;
        if (dataEntrada && (!resumo.ultimaEntrada || new Date(dataEntrada) > new Date(resumo.ultimaEntrada))) {
          resumo.ultimaEntrada = dataEntrada;
        }
      });
    });

    saidas.forEach((saida) => {
      (saida.itens || []).forEach((itemMov: any) => {
        const resumo = mapaResumo.get(itemMov.item);
        if (!resumo) return;

        resumo.quantidadeSaida += Number(itemMov.quantidade || 0);
        resumo.movimentacoesSaida += 1;
        resumo.totalMovimentacoes += 1;

        const dataSaida = saida.data_saida || saida.criado_em || null;
        if (dataSaida && (!resumo.ultimaSaida || new Date(dataSaida) > new Date(resumo.ultimaSaida))) {
          resumo.ultimaSaida = dataSaida;
        }
      });
    });

    return Array.from(mapaResumo.values()).sort((a, b) => {
      if (a.totalMovimentacoes !== b.totalMovimentacoes) {
        return b.totalMovimentacoes - a.totalMovimentacoes;
      }

      return a.nome.localeCompare(b.nome);
    });
  }
}
