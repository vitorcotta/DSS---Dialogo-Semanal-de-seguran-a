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
- Ao habilitar um cartaz, ele entra automaticamente como o **primeiro** da galeria (topo da
  lista). Use as setas ▲▼ no painel para reordenar manualmente depois, se quiser.
- No painel, cartazes desabilitados sempre aparecem primeiro na lista, para facilitar a
  organizacao dos que ainda estao "na fila".
- O estado de habilitado/desabilitado e a ordem de cada cartaz sao persistidos em
  `data/state.json`.

---

## Votacao para o proximo assunto

No painel, marque o checkbox "Votacao" de 2 a 4 cartazes **desabilitados** e clique em "Criar
votacao". Isso gera um link (`/votar/<id>`) que pode ser compartilhado com qualquer pessoa —
não é preciso login para votar.

- Enquanto a votacao esta **aberta**, os numeros de votos ficam escondidos (inclusive do
  admin), para nao influenciar quem ainda vai votar. Cada pessoa so ve se ja votou ou nao.
- O controle de "ja votou" e feito por um cookie no navegador — evita voto duplicado por
  engano (recarregar a pagina, clicar duas vezes), mas nao impede alguem de votar de novo
  usando outro navegador ou aba anonima. Suficiente para uso interno, nao e a prova de fraude.
- O admin encerra a votacao manualmente pelo botao "Encerrar votacao". So entao o resultado
  (votos por opcao) fica visivel.
- Com a votacao encerrada, aparece um botao **"Habilitar <cartaz vencedor>"** que publica o
  cartaz vencedor na galeria (mesmo comportamento de habilitar manualmente: ele vai para o
  topo da lista).
- Em caso de empate, o botao de habilitar fica desativado — habilite manualmente pela lista
  normal de cartazes.
- Se um cartaz candidato for renomeado ou excluido depois da votacao criada, ele aparece como
  "removido" na votacao (sem quebrar nada), mas nao pode mais ser habilitado automaticamente.
- Dados das votacoes ficam em `data/polls.json` (mesmo tratamento de `data/state.json`: nao
  versionado no Git).

---

## Imagens nao ficam versionadas no Git

A pasta `imagens/` esta no `.gitignore` (exceto por um `.gitkeep` que mantem a pasta no
repositorio). Isso evita que cada upload/renomeacao feita pelo painel gere commits enormes de
binarios. Os cartazes passam a ser gerenciados **apenas pelo painel administrativo** e ficam
guardados diretamente no disco do servidor (e no volume Docker `./imagens`).

**Atencao ao atualizar um servidor que ja tinha as imagens versionadas:** apos o commit que
remove `imagens/` do controle de versao, um `git pull` comum tentaria apagar do disco os
arquivos que deixaram de ser rastreados. Para evitar isso, no servidor, **antes** de rodar
`git pull` pela primeira vez apos essa mudanca:

```bash
cd /opt/dss-cartazes
git rm -r --cached imagens   # remove do indice do git, mantem os arquivos no disco
git commit -m "Parar de versionar imagens (mantidas no disco)"
git pull
```

Assim o servidor "esquece" as imagens no git antes de puxar a mudanca remota, e o `git pull`
nao encontra motivo para apagar nada — os arquivos continuam no disco, agora ignorados pelo
Git e gerenciados só pelo painel.

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
