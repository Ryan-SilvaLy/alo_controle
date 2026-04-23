import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { authGuard, permissionGuard } from './guards/auth.guard';

// Importação do componente standalone
import { ItemComponent } from './components/item/item.component';
import { AdminComponent } from './components/admin/admin.component';
import { PedidoComponent } from './components/pedido/pedido.component';
import { ControleComponent } from './components/controle/controle.component';
import { ProdutoComponent } from './components/produto/produto.component';
import { LogsComponent } from './components/logs/logs.component';


export const routes: Routes = [
    {
        path: 'login',
        component: LoginComponent,
    },
    {
        path: 'admin',
        component: AdminComponent,
        canActivate: [authGuard, permissionGuard], 
        data: { permissoes: ['administrador', 'moderador'] },
        children: [
            {
                path: 'iniciar',
                loadComponent: () => import('./components/admin/iniciar-admin/iniciar-admin.component').then(m => m.IniciarAdminComponent)
            },
            {
                path: 'criar-usuario',
                loadComponent: () => import('./components/admin/criar-usuario/criar-usuario.component').then(m => m.CriarUsuarioComponent)
            },
            {
                path: 'atualizar-usuario',
                loadComponent: () => import('./components/admin/atualizar-usuario/atualizar-usuario.component').then(m => m.AtualizarUsuarioComponent)
            }
        ]
    },
    // {
    //     path: 'home',
    //     component: HomeComponent,
    //     canActivate: [authGuard] // Impede acesso sem estar autenticado.
    // },
    {
        path: 'item',
        component: ItemComponent,
        canActivate: [authGuard],
        children: [
            {
                path: 'iniciar',
                loadComponent: () =>
                    import('./components/item/iniciar-item/iniciar-item.component').then(m => m.IniciarItemComponent)
            },
            {
                path: 'criar',
                loadComponent: () =>
                    import('./components/item/criar-item/criar-item.component').then(m => m.CriarItemComponent),
                    canActivate: [permissionGuard],
                    data: { permissoes: ['administrador', 'almoxarifado'] }
            },
            {
                path: 'atualizar',
                loadComponent: () =>
                    import('./components/item/atualizar-item/atualizar-item.component').then(m => m.AtualizarItemComponent),
                canActivate: [permissionGuard],
                data: { permissoes: ['administrador', 'almoxarifado'] }
            },
            {
                path: 'iniciar-tipo-item',
                loadComponent: () =>
                    import('./components/item/iniciar-tipo-item/iniciar-tipo-item.component').then(m => m.IniciarTipoItemComponent),
                canActivate: [permissionGuard],
                data: { permissoes: ['administrador', 'moderador', 'almoxarifado'] }
            },
            {
                path: 'estoque-baixo',
                loadComponent: () =>
                    import('./components/item/estoque-baixo/estoque-baixo.component').then(m => m.EstoqueBaixoComponent),
                canActivate: [permissionGuard],
                data: { permissoes: ['administrador', 'almoxarifado'] }
            }
        ]
    },
    {
        path: 'pedido',
        component: PedidoComponent,
        canActivate: [authGuard],
        children: [
            {
                path: 'atualizar',
                loadComponent: () =>
                    import('./components/pedido/atualizar-pedido/atualizar-pedido.component').then(m => m.AtualizarPedidoComponent),
                canActivate: [permissionGuard],
                data: { permissoes: ['administrador', 'moderador', 'almoxarifado', 'compra'] }
            },
            {
                path: 'listar',
                loadComponent: () =>
                    import('./components/pedido/iniciar-pedido/iniciar-pedido.component').then(m => m.IniciarPedidoComponent ),
            },
            {
                path: 'criar',
                loadComponent: () =>
                    import('./components/pedido/criar-pedido/criar-pedido.component').then(m => m.CriarPedidoComponent),
                canActivate: [permissionGuard],
                data: { permissoes: ['administrador', 'moderador', 'almoxarifado', 'compra'] }
            },
        ]
    },
    {
        path: 'controle',
        component: ControleComponent,
        canActivate: [authGuard, permissionGuard],
        data: { permissoes: ['administrador', 'moderador', 'almoxarifado'] },
        children: [
            {
                path: 'iniciar',
                loadComponent: () =>
                    import('./components/controle/iniciar-controle/iniciar-controle.component').then(m => m.IniciarControleComponent)
            },
            {
                path: 'registrar-entrada',
                loadComponent: () =>
                    import('./components/controle/registrar-entrada/registrar-entrada.component').then(m => m.RegistrarEntradaComponent)
            },
            {
                path: 'editar-entrada/:id',
                loadComponent: () =>
                    import('./components/controle/registrar-entrada/registrar-entrada.component').then(m => m.RegistrarEntradaComponent)
            },
            {
                path: 'registrar-saida',
                loadComponent: () =>
                    import('./components/controle/registrar-saida/registrar-saida.component').then(m => m.RegistrarSaidaComponent)
            },
            {
                path: 'editar-saida/:id',
                loadComponent: () =>
                    import('./components/controle/registrar-saida/registrar-saida.component').then(m => m.RegistrarSaidaComponent)
            }
        ]
    },
    {
        path: 'assinatura-epi',
        canActivate: [authGuard, permissionGuard],
        data: { permissoes: ['administrador', 'moderador', 'almoxarifado'] },
        children: [
            {
                path: '',
                pathMatch: 'full',
                redirectTo: 'iniciar'
            },
            {
                path: 'iniciar',
                loadComponent: () =>
                    import('./components/assinatura-epi/iniciar-assinatura-epi/iniciar-assinatura-epi.component').then(m => m.IniciarAssinaturaEpiComponent)
            },
            {
                path: 'detalhe/:id',
                loadComponent: () =>
                    import('./components/assinatura-epi/detalhe-assinatura-epi/detalhe-assinatura-epi.component').then(m => m.DetalheAssinaturaEpiComponent)
            },
            {
                path: 'historico/:id',
                loadComponent: () =>
                    import('./components/assinatura-epi/historico-relatorio/historico-relatorio.component').then(m => m.HistoricoRelatorioComponent)
            }
        ]
    },


    {
        path: 'produto',
        component: ProdutoComponent,
        canActivate: [authGuard, permissionGuard],
        data: { permissoes: ['administrador', 'moderador', 'almoxarifado'] },
        children: [
            {
                path: 'iniciar',
                loadComponent: () =>
                    import('./components/produto/iniciar-produto/iniciar-produto.component').then(m => m.IniciarProdutoComponent)
            },
            {
                path: 'criar',
                loadComponent: () =>
                    import('./components/produto/fornecedor-produto/fornecedor-produto.component').then(m => m.FornecedorProdutoComponent),
                    canActivate: [permissionGuard],
                    data: { permissoes: ['administrador', 'moderador', 'almoxarifado'] }
            },
            {
                path: 'dashboard',
                loadComponent: () =>
                    import('./components/produto/dashboard-produto/dashboard-produto.component').then(m => m.DashboardProdutoComponent),
                    canActivate: [permissionGuard],
                    data: { permissoes: ['administrador', 'moderador', 'almoxarifado'] }
            },
            {
                path: 'atualizar/:id',
                loadComponent: () =>
                    import('./components/produto/dashboard-produto/dashboard-produto.component').then(m => m.DashboardProdutoComponent),
                    canActivate: [permissionGuard],
                    data: { permissoes: ['administrador', 'moderador', 'almoxarifado'] }
            },
        ]
    },

    {
        path: 'logs',
        component: LogsComponent,
        canActivate: [authGuard, permissionGuard],
        data: { permissoes: ['administrador', 'moderador'] },
    }
];
