import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filtroTipo'
})
export class FiltroTipoPipe implements PipeTransform {
  transform(itensAgrupados: any[], tipo: string): any[] {
    if (!tipo) return itensAgrupados;
    return itensAgrupados.filter(grupo => grupo.tipo === tipo);
  }
}
