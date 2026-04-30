# DSS - Painel de Cartazes

Aplicacao web simples para exibir os cartazes do Dialogo Semanal de Seguranca em uma galeria corporativa.

## O que este projeto faz

- Exibe automaticamente todas as imagens da pasta `imagens/`
- Atualiza a galeria periodicamente (sem precisar reiniciar a pagina)
- Mantem todas as imagens com o mesmo tamanho visual
- Roda em container Docker

Formatos suportados: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`.

---

## Estrutura esperada

```text
.
|-- Dockerfile
|-- docker-compose.yml
|-- server.js
|-- public/
`-- imagens/
```

Coloque seus cartazes dentro da pasta `imagens/`.

---

## Como executar localmente com Docker

Na raiz do projeto:

```bash
docker compose up --build -d
```

Acesse:

```text
http://SEU_IP_OU_HOST:5050
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
sudo firewall-cmd --permanent --add-port=5050/tcp
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
