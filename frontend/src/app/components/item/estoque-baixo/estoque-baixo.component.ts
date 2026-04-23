import { ItemService, Item } from './../../../services/item.service';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuantidadeFormatPipe } from '../../../pipe/quantidade-format.pipe';
import { UnidadeNomePipe } from '../../../pipe/unidade-nome.pipe';
import { PdfService } from '../../../shared/pdf/pdf.service';
import { FormsModule } from '@angular/forms';
import { FiltroTipoPipe } from '../../../pipe/filtro-tipo-item.pipe';

@Component({
  selector: 'app-estoque-baixo',
  standalone: true,
  imports: [CommonModule, QuantidadeFormatPipe, UnidadeNomePipe, FormsModule, FiltroTipoPipe],
  templateUrl: './estoque-baixo.component.html',
  styleUrl: './estoque-baixo.component.scss'
})

export class EstoqueBaixoComponent implements OnInit {
  itensAgrupados: { tipo: string; itens: Item[] }[] = [];
  tiposDisponiveis: string[] = [];
  tipoSelecionado = '';
  carregando = true;

  constructor(
    public itemService: ItemService,
    private pdfService: PdfService

  ) {}

  ngOnInit() {
    this.itemService.listarItensEmBaixaPorTipo().subscribe((itens: Item[]) => {
      const mapTipos = new Map<string, Item[]>();

      itens.forEach(item => {
        if (!mapTipos.has(item.tipo_item.nome)) {
          mapTipos.set(item.tipo_item.nome, []);
        }
        mapTipos.get(item.tipo_item.nome)?.push(item);
      });

      this.itensAgrupados = Array.from(mapTipos.entries()).map(([tipo, itens]) => ({ tipo, itens }));
      this.tiposDisponiveis = Array.from(mapTipos.keys());
      this.carregando = false;
    });
  }

  gerarPedido(tipo: string) {
    this.pdfService.gerarPdfItensEmBaixaPorTipo(this.itensAgrupados.flatMap(g => g.itens), tipo);
  }

}