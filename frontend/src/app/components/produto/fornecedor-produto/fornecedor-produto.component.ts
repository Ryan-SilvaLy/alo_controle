import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ControleService } from '../../../services/controle.service';

interface FornecedorResumo {
  chave: string;
  nomeFornecedor: string;
  cnpjCpf: string;
  totalEntregas: number;
  totalNotas: number;
  totalItensRecebidos: number;
  ultimaEntrega: string | null;
  ultimaNota: string;
}

@Component({
  selector: 'app-fornecedor-produto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fornecedor-produto.component.html',
  styleUrl: './fornecedor-produto.component.scss'
})
export class FornecedorProdutoComponent {
  fornecedores: FornecedorResumo[] = [];
  carregando = true;
  erro: string | null = null;
  termoBusca = '';

  constructor(
    private controleService: ControleService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.carregarFornecedores();
  }

  get fornecedoresFiltrados(): FornecedorResumo[] {
    const termo = this.termoBusca.trim().toLowerCase();

    if (!termo) {
      return this.fornecedores;
    }

    return this.fornecedores.filter((fornecedor) =>
      [
        fornecedor.nomeFornecedor,
        fornecedor.cnpjCpf,
        fornecedor.ultimaNota
      ]
        .filter(Boolean)
        .some((valor) => valor.toLowerCase().includes(termo))
    );
  }

  get totalFornecedores(): number {
    return this.fornecedores.length;
  }

  get totalEntregas(): number {
    return this.fornecedores.reduce((total, fornecedor) => total + fornecedor.totalEntregas, 0);
  }

  get totalNotas(): number {
    return this.fornecedores.reduce((total, fornecedor) => total + fornecedor.totalNotas, 0);
  }

  get totalVolumesRecebidos(): number {
    return this.fornecedores.reduce((total, fornecedor) => total + fornecedor.totalItensRecebidos, 0);
  }

  limparBusca(): void {
    this.termoBusca = '';
  }

  voltarParaProdutos(): void {
    this.router.navigate(['/produto/iniciar']);
  }

  private carregarFornecedores(): void {
    this.carregando = true;
    this.erro = null;

    this.controleService.listarEntradasEstoque().subscribe({
      next: (entradas) => {
        this.fornecedores = this.montarResumoFornecedores(entradas);
        this.carregando = false;
      },
      error: (err) => {
        console.error('Erro ao carregar fornecedores:', err);
        this.erro = 'Nao foi possivel carregar os fornecedores vinculados as notas fiscais.';
        this.carregando = false;
      }
    });
  }

  private montarResumoFornecedores(entradas: any[]): FornecedorResumo[] {
    const fornecedoresMap = new Map<string, {
      nomeFornecedor: string;
      cnpjCpf: string;
      totalEntregas: number;
      totalItensRecebidos: number;
      ultimaEntrega: string | null;
      notas: Set<string>;
      ultimaNota: string;
    }>();

    for (const entrada of entradas ?? []) {
      const nota = entrada?.nota_fiscal_detalhe;

      if (!nota?.nome_fornecedor && !nota?.cnpj_cpf) {
        continue;
      }

      const nomeFornecedor = (nota?.nome_fornecedor || 'Fornecedor nao informado').trim();
      const cnpjCpf = (nota?.cnpj_cpf || '').trim();
      const chaveBase = cnpjCpf || nomeFornecedor;
      const chave = chaveBase.toLowerCase();
      const numeroNota = String(nota?.numero_nota || '-').trim();
      const dataEntrada = entrada?.data_entrada || null;
      const quantidadeEntrada = (entrada?.itens || []).reduce(
        (total: number, item: any) => total + Number(item?.quantidade || 0),
        0
      );

      if (!fornecedoresMap.has(chave)) {
        fornecedoresMap.set(chave, {
          nomeFornecedor,
          cnpjCpf: cnpjCpf || '-',
          totalEntregas: 0,
          totalItensRecebidos: 0,
          ultimaEntrega: dataEntrada,
          notas: new Set<string>(),
          ultimaNota: numeroNota
        });
      }

      const fornecedor = fornecedoresMap.get(chave)!;
      fornecedor.totalEntregas += 1;
      fornecedor.totalItensRecebidos += quantidadeEntrada;
      fornecedor.notas.add(numeroNota);

      if (dataEntrada && (!fornecedor.ultimaEntrega || new Date(dataEntrada) > new Date(fornecedor.ultimaEntrega))) {
        fornecedor.ultimaEntrega = dataEntrada;
        fornecedor.ultimaNota = numeroNota;
      }
    }

    return Array.from(fornecedoresMap.entries())
      .map(([chave, fornecedor]) => ({
        chave,
        nomeFornecedor: fornecedor.nomeFornecedor,
        cnpjCpf: fornecedor.cnpjCpf,
        totalEntregas: fornecedor.totalEntregas,
        totalNotas: fornecedor.notas.size,
        totalItensRecebidos: fornecedor.totalItensRecebidos,
        ultimaEntrega: fornecedor.ultimaEntrega,
        ultimaNota: fornecedor.ultimaNota
      }))
      .sort((a, b) => {
        const dataA = a.ultimaEntrega ? new Date(a.ultimaEntrega).getTime() : 0;
        const dataB = b.ultimaEntrega ? new Date(b.ultimaEntrega).getTime() : 0;
        return dataB - dataA;
      });
  }
}
