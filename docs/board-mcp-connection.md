# PMO Board MCP

Arquivo compartilhado para outros projetos conectarem no MCP do PMO Board.

## Localizacao na VPS

```text
/opt/shared/mcp/board_pmo.md
```

## Servidor MCP em producao

O MCP roda como servico privado `mcp-board` na rede Compose do Board, sem porta publica:

```text
http://mcp-board:8011/mcp
```

Health check interno:

```bash
docker compose -f /opt/board_pmo/docker-compose.yml exec mcp-board wget -qO- http://127.0.0.1:8011/health
```

Deploy isolado:

```bash
docker compose -f /opt/board_pmo/docker-compose.yml up -d --build mcp-board
```

## Rollback via stdio

O MCP tambem continua disponivel via `stdio` dentro do container `api` do Board. O projeto precisa estar publicado em:

```text
/opt/board_pmo
```

Comando para clientes MCP:

```bash
docker compose -f /opt/board_pmo/docker-compose.yml exec -T api node apps/api/dist/mcp/server.js
```

Exemplo de configuracao:

```json
{
  "mcpServers": {
    "pmo-board": {
      "command": "docker",
      "args": [
        "compose",
        "-f",
        "/opt/board_pmo/docker-compose.yml",
        "exec",
        "-T",
        "api",
        "node",
        "apps/api/dist/mcp/server.js"
      ]
    }
  }
}
```

## Ferramentas disponiveis

```text
board_search_tasks
board_get_task
board_create_task
board_update_task
board_move_task
board_add_comment
board_get_project_status
board_list_blockers
board_list_my_tasks
```

## Usuario ator

As ferramentas que criam, atualizam, movem ou comentam tarefas registram historico em nome de um usuario.

A chamada pode informar:

```json
{
  "actorEmail": "rogerio@pmo.local"
}
```

Ou:

```json
{
  "actorUserId": "uuid-do-usuario"
}
```

Se nenhum ator for informado, o servidor tenta usar `BOARD_MCP_DEFAULT_USER_ID`, depois `BOARD_MCP_DEFAULT_USER_EMAIL`, e por fim o primeiro usuario cadastrado.

## Status validado

Health check do Board:

```bash
curl -fsS http://127.0.0.1:80/api/health
```

Resposta esperada:

```json
{"status":"ok","app":"PMO Board API"}
```
