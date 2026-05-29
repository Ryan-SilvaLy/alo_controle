export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000'
};


// command to create a superuser in Django: railwai
// python manage.py shell -c 'from app_usuario.models import Usuario; username="ryan"; password="123456"; defaults={"nome":"Ryan","cargo":"Usuario","nivel_permissao":"administrador","setor":"TI","is_staff":True,"is_superuser":True}; u, created = Usuario.objects.get_or_create(username=username, defaults=defaults); u.nome="Ryan"; u.cargo="Usuario"; u.nivel_permissao="administrador"; u.setor="TI"; u.is_staff=True; u.is_superuser=True; u.set_password(password); u.save(); print("created=", created, "id=", u.id)'