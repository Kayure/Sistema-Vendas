# Loja: API de Vendas (Node.js + Express + mysql2)

API para a aula de **Banco de Dados**. Não usa ORM: cada rota executa um comando SQL escrito à mão no `server.js`, para o aluno ver exatamente o SQL por trás de cada botão do front-end.

```
api-loja/
├── banco.sql        <- cria o banco, as tabelas e os dados de teste
├── server.js        <- toda a API (rotas + SQL)
├── package.json
├── README.md
└── public/index.html  <- front-end (HTML + CSS + JS puro)
```

## Modelo de dados

```
usuarios ──< vendas >── clientes ──< enderecos
               │
        ┌──────┴───────┐
   itens_venda     pagamentos
        │
     produtos
```

| Tabela | Para que serve | Relacionamentos |
|---|---|---|
| `usuarios` | Login (senha guardada como hash) | 1 usuário faz N vendas |
| `clientes` | Quem compra | 1 cliente tem N endereços e N vendas |
| `enderecos` | Endereços do cliente | FK `id_cliente` (com `ON DELETE CASCADE`) |
| `produtos` | Catálogo, com preço e estoque | 1 produto aparece em N itens |
| `vendas` | Cabeçalho: cliente, vendedor, data e total | FKs `id_cliente` e `id_usuario` |
| `itens_venda` | Quais produtos e quantos em cada venda | FKs `id_venda` e `id_produto` |
| `pagamentos` | Forma (PIX, Cartão, Boleto), valor e status | FK `id_venda` |

**Por que existe `itens_venda`?** Uma venda tem vários produtos, e um produto está em várias vendas (relação N:N). A tabela do meio guarda a **quantidade** e o **preço no momento da venda**. Assim, se o preço do produto mudar depois, as vendas antigas não mudam.

## Como rodar

1. Instale o Node.js 18 ou superior e deixe o MySQL rodando.
2. No MySQL Workbench, abra e execute o `banco.sql` inteiro.
3. No `server.js`, coloque a senha do seu MySQL no `createPool`.
4. No terminal, dentro da pasta do projeto:

```bash
npm install
npm start
```

5. Abra **http://localhost:3000** e entre com `admin@escola.com` / `123456` (o usuário é criado na primeira execução).

## Como funciona

```
Front-end (fetch)  ->  Rota Express  ->  Comando SQL (mysql2)  ->  MySQL
```

- Os `?` nos comandos SQL são **parâmetros**: o mysql2 coloca os valores com segurança (evita **SQL Injection**).
- `SELECT` devolve `[linhas]`. `INSERT`, `UPDATE` e `DELETE` devolvem `insertId` e `affectedRows`.
- **Login:** `POST /login` compara a senha digitada com o hash do banco (bcrypt) e devolve um **token JWT**. O front envia o token no cabeçalho `Authorization` em todas as outras chamadas.

### Registrar uma venda = transação

`POST /vendas` executa vários comandos que precisam dar certo **juntos**:

1. `INSERT` em `vendas`
2. para cada item: `SELECT ... FOR UPDATE` (confere preço e estoque), `INSERT` em `itens_venda` e `UPDATE` do estoque
3. `UPDATE` do total da venda
4. `INSERT` em `pagamentos`

Tudo roda entre `beginTransaction()` e `commit()`. Se qualquer passo falhar (por exemplo, estoque insuficiente), o `rollback()` desfaz tudo e nada fica pela metade no banco. Experimente vender mais unidades do que o estoque.

## Rotas

| Método | Rota | SQL principal |
|---|---|---|
| POST | `/registrar` | `INSERT INTO usuarios` |
| POST | `/login` | `SELECT ... FROM usuarios WHERE email = ?` |
| GET, POST | `/clientes` | `SELECT`, `INSERT` |
| PUT, DELETE | `/clientes/:id` | `UPDATE`, `DELETE` |
| GET, POST | `/clientes/:id/enderecos` | `SELECT ... WHERE id_cliente`, `INSERT` |
| GET, POST | `/produtos` | `SELECT`, `INSERT` |
| PUT, DELETE | `/produtos/:id` | `UPDATE`, `DELETE` |
| GET | `/vendas` | `INNER JOIN` (clientes, usuarios) + `LEFT JOIN` (pagamentos) |
| GET | `/vendas/:id/itens` | `INNER JOIN` com produtos |
| POST | `/vendas` | transação (veja acima) |
| PUT | `/pagamentos/:id` | `UPDATE pagamentos SET status` |

Todas, exceto `/login` e `/registrar`, exigem o token.


## Erros que você vai ver (de propósito)

- **CPF repetido:** viola `UNIQUE`.
- **Remover um cliente que já comprou:** a chave estrangeira bloqueia.
- **Vender além do estoque:** a transação sofre rollback.
- **Acessar sem login:** a API responde 401.

## Problemas comuns

- **"Failed to fetch" no navegador:** a API não está rodando. Rode `npm start` e confira o terminal.
- `ER_ACCESS_DENIED_ERROR`: usuário ou senha do MySQL errados no `createPool`.
- `ER_BAD_DB_ERROR`: o `banco.sql` ainda não foi executado.
- `ECONNREFUSED`: o serviço MySQL não está rodando.

## Desafios para os alunos

- Criar a rota `DELETE /vendas/:id` (lembre de apagar itens e pagamentos, e devolver o estoque).
- Criar um relatório com `GROUP BY`: total vendido por cliente ou por produto.
- Mostrar a cidade do cliente na tela de vendas (mais um `JOIN`).
