import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'unidadeNome'
})
export class UnidadeNomePipe implements PipeTransform {

  transform(codigo: string, choices: [string, string][]): string {
    if (!codigo || !choices) return '';
    const unidade = choices.find(u => u[0] === codigo);
    return unidade ? unidade[1] : codigo;
  }
}
