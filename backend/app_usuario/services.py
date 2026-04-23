from app_usuario.models import Log  # evita import circular


def registrar_log(usuario, acao):
    Log.objects.create(usuario=usuario, acao=acao)
