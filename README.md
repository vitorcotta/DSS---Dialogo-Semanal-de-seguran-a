# DSS - Painel de Cartazes

Aplicacao web simples para exibir os cartazes do Dialogo Semanal de Seguranca em uma galeria corporativa.

## O que este projeto faz

- Exibe automaticamente as imagens habilitadas da pasta `imagens/`
- Atualiza a galeria periodicamente (sem precisar reiniciar a pagina)
- Mantem todas as imagens com o mesmo tamanho visual
- Possui um painel administrativo (`/admin`) protegido por usuario e senha, onde e possivel
  fazer upload de novos cartazes, habilitar/desabilitar cada um (controlando o que aparece
  na galeria principal) e excluir cartazes
- Roda em container Docker

Formatos suportados: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`.

---

## Painel administrativo

Acesse `http://SEU_IP_OU_HOST:8050/login.html` (ou clique em "Administracao" no rodape da
galeria) para entrar no painel.

- Usuario e senha sao definidos pelas variaveis de ambiente `ADMIN_USERNAME` e `ADMIN_PASSWORD`
  (veja `docker-compose.yml`). **Troque os valores padrao antes de publicar em producao.**
- Cartazes enviados pelo painel entram **desabilitados** por padrao — ficam guardados e so
  aparecem na galeria principal quando voce marcar "Habilitado" na semana de uso.
- O estado de habilitado/desabilitado de cada cartaz e persistido em `data/state.json`.

---

## Estrutura esperada

```text
.
|-- Dockerfile
|-- docker-compose.yml
|-- server.js
|-- admin/
|-- data/
|-- public/
`-- imagens/
```

Coloque seus cartazes dentro da pasta `imagens/` (ou envie pelo painel administrativo).

---

## Como executar localmente com Docker

Na raiz do projeto:

```bash
docker compose up --build -d
```

Acesse:

```text
http://SEU_IP_OU_HOST:8050
```

Para acompanhar logs:

```bash
docker compose logs -f
```

Para parar:

```bash
docker compose down
```

---

## Publicacao em servidor RedHat com Docker

### 1) Instalar Docker no RedHat

No servidor RedHat (RHEL 8/9), execute:

```bash
sudo dnf -y update
sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

Depois, faca logout/login para aplicar o grupo `docker`.

Valide:

```bash
docker --version
docker compose version
```

### 2) Copiar o projeto para o servidor

Exemplo com `scp`:

```bash
scp -r "./DSS - Dialogo Semanal de segurança" usuario@IP_DO_SERVIDOR:/opt/dss-cartazes
```

### 3) Subir o container

No servidor:

```bash
cd /opt/dss-cartazes
docker compose up --build -d
```

### 4) Liberar porta no firewall (se necessario)

```bash
sudo firewall-cmd --permanent --add-port=8050/tcp
sudo firewall-cmd --reload
```

### 5) Operacao diaria

Para adicionar novos cartazes:

1. Copie a nova imagem para `/opt/dss-cartazes/imagens/`
2. Atualize a pagina no navegador (ou aguarde a atualizacao automatica)

Nao e necessario rebuild para novas imagens.

---

## Comandos uteis

Reiniciar servico:

```bash
docker compose restart
```

Atualizar aplicacao apos alterar codigo:

```bash
docker compose up --build -d
```

Remover containers e imagens locais do projeto:

```bash
docker compose down --rmi local
```
