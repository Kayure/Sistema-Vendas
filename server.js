const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(express.static('public')); // front-end em http://localhost:3000

app.use((req, res, next) => {      // CORS: permite o front rodar em outro endereço
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ---------- CONEXÃO COM O MYSQL ----------
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',          // <- coloque a senha do seu MySQL
  database: 'kayure',   // criado pelo script banco.sql
  decimalNumbers: true,  // DECIMAL volta como número
  dateStrings: true,     // datas voltam como texto
});

const SEGREDO = 'troque-este-segredo'; // assina o token de login (JWT)

// Os "?" são parâmetros: o mysql2 troca pelos valores com segurança
// (evita SQL Injection). Nunca concatene valores na string SQL!

// ================= LOGIN (rotas públicas) =================

// INSERT: criar usuário. A senha é transformada em hash antes de ir para o banco.
app.post('/registrar', async (req, res) => {
  const { nome, email, senha } = req.body;
  const hash = await bcrypt.hash(senha, 10);
  const [r] = await db.query(
    'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
    [nome, email, hash]
  );
  res.status(201).json({ id_usuario: r.insertId, nome, email });
});

// SELECT: busca o usuário pelo e-mail e compara a senha com o hash
app.post('/login', async (req, res) => {
  const { email, senha } = req.body;
  const [linhas] = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);
  const usuario = linhas[0];
  if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
  }
  const token = jwt.sign({ id: usuario.id_usuario, nome: usuario.nome }, SEGREDO, { expiresIn: '8h' });
  res.json({ token, nome: usuario.nome });
});

// Daqui para baixo, todas as rotas exigem o token no cabeçalho Authorization
app.use((req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.usuario = jwt.verify(token, SEGREDO);
    next();
  } catch {
    res.status(401).json({ erro: 'Faça login para continuar' });
  }
});

// ================= CLIENTES =================

app.get('/clientes', async (req, res) => {
  const [clientes] = await db.query('SELECT * FROM clientes ORDER BY nome');
  res.json(clientes);
});

app.post('/clientes', async (req, res) => {
  const { nome, cpf, email } = req.body;
  const [r] = await db.query(
    'INSERT INTO clientes (nome, cpf, email) VALUES (?, ?, ?)',
    [nome, cpf, email]
  );
  res.status(201).json({ id_cliente: r.insertId, nome, cpf, email });
});

app.put('/clientes/:id', async (req, res) => {
  const { nome, cpf, email } = req.body;
  const [r] = await db.query(
    'UPDATE clientes SET nome = ?, cpf = ?, email = ? WHERE id_cliente = ?',
    [nome, cpf, email, req.params.id]
  );
  if (r.affectedRows === 0) return res.status(404).json({ erro: 'Cliente não encontrado' });
  res.json({ mensagem: 'Cliente atualizado' });
});

// Falha se o cliente tiver vendas (chave estrangeira). Os endereços são apagados junto (CASCADE).
app.delete('/clientes/:id', async (req, res) => {
  const [r] = await db.query('DELETE FROM clientes WHERE id_cliente = ?', [req.params.id]);
  if (r.affectedRows === 0) return res.status(404).json({ erro: 'Cliente não encontrado' });
  res.json({ mensagem: 'Cliente removido' });
});

// ---- Endereços do cliente ----
app.get('/clientes/:id/enderecos', async (req, res) => {
  const [enderecos] = await db.query('SELECT * FROM enderecos WHERE id_cliente = ?', [req.params.id]);
  res.json(enderecos);
});

app.post('/clientes/:id/enderecos', async (req, res) => {
  const { rua, numero, bairro, cidade, cep } = req.body;
  const [r] = await db.query(
    'INSERT INTO enderecos (id_cliente, rua, numero, bairro, cidade, cep) VALUES (?, ?, ?, ?, ?, ?)',
    [req.params.id, rua, numero, bairro, cidade, cep]
  );
  res.status(201).json({ id_endereco: r.insertId });
});

// ================= PRODUTOS =================

app.get('/produtos', async (req, res) => {
  const [produtos] = await db.query('SELECT * FROM produtos ORDER BY nome_produto');
  res.json(produtos);
});

app.post('/produtos', async (req, res) => {
  const { nome_produto, preco, estoque } = req.body;
  const [r] = await db.query(
    'INSERT INTO produtos (nome_produto, preco, estoque) VALUES (?, ?, ?)',
    [nome_produto, preco, estoque]
  );
  res.status(201).json({ id_produto: r.insertId, nome_produto, preco, estoque });
});

app.put('/produtos/:id', async (req, res) => {
  const { nome_produto, preco, estoque } = req.body;
  const [r] = await db.query(
    'UPDATE produtos SET nome_produto = ?, preco = ?, estoque = ? WHERE id_produto = ?',
    [nome_produto, preco, estoque, req.params.id]
  );
  if (r.affectedRows === 0) return res.status(404).json({ erro: 'Produto não encontrado' });
  res.json({ mensagem: 'Produto atualizado' });
});

app.delete('/produtos/:id', async (req, res) => {
  const [r] = await db.query('DELETE FROM produtos WHERE id_produto = ?', [req.params.id]);
  if (r.affectedRows === 0) return res.status(404).json({ erro: 'Produto não encontrado' });
  res.json({ mensagem: 'Produto removido' });
});

// ================= VENDAS =================

// INNER JOIN + LEFT JOIN: venda com cliente, vendedor e pagamento
app.get('/vendas', async (req, res) => {
  const [vendas] = await db.query(`
    SELECT v.id_venda, c.nome AS cliente, u.nome AS vendedor, v.data_venda,
           v.valor_total, p.id_pagamento, p.forma_pagamento, p.status
    FROM vendas v
    INNER JOIN clientes c ON c.id_cliente = v.id_cliente
    INNER JOIN usuarios u ON u.id_usuario = v.id_usuario
    LEFT JOIN pagamentos p ON p.id_venda = v.id_venda
    ORDER BY v.id_venda DESC
  `);
  res.json(vendas);
});

// JOIN: itens de uma venda com o nome do produto
app.get('/vendas/:id/itens', async (req, res) => {
  const [itens] = await db.query(`
    SELECT pr.nome_produto, i.quantidade, i.preco_unitario,
           i.quantidade * i.preco_unitario AS subtotal
    FROM itens_venda i
    INNER JOIN produtos pr ON pr.id_produto = i.id_produto
    WHERE i.id_venda = ?
  `, [req.params.id]);
  res.json(itens);
});

// Registrar venda: vários comandos que precisam dar certo JUNTOS.
// Por isso usamos uma TRANSAÇÃO: se algo falhar, o rollback desfaz tudo.
// Corpo: { id_cliente, forma_pagamento, itens: [{ id_produto, quantidade }] }
app.post('/vendas', async (req, res) => {
  const { id_cliente, forma_pagamento, itens } = req.body;
  if (!itens || itens.length === 0) {
    return res.status(400).json({ erro: 'Adicione ao menos um item à venda' });
  }

  const conn = await db.getConnection();   // uma conexão só para a transação
  try {
    await conn.beginTransaction();

    const [venda] = await conn.query(
      'INSERT INTO vendas (id_cliente, id_usuario) VALUES (?, ?)',
      [id_cliente, req.usuario.id]
    );

    let total = 0;
    for (const item of itens) {
      // FOR UPDATE trava a linha do produto enquanto a transação não termina
      const [[produto]] = await conn.query(
        'SELECT nome_produto, preco, estoque FROM produtos WHERE id_produto = ? FOR UPDATE',
        [item.id_produto]
      );
      if (!produto) throw new Error('Produto não encontrado');
      if (item.quantidade < 1) throw new Error('A quantidade deve ser pelo menos 1');
      if (produto.estoque < item.quantidade) {
        throw new Error(`Estoque insuficiente de ${produto.nome_produto} (restam ${produto.estoque})`);
      }

      await conn.query(
        'INSERT INTO itens_venda (id_venda, id_produto, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
        [venda.insertId, item.id_produto, item.quantidade, produto.preco]
      );
      await conn.query(
        'UPDATE produtos SET estoque = estoque - ? WHERE id_produto = ?',
        [item.quantidade, item.id_produto]
      );
      total += produto.preco * item.quantidade;
    }
    total = Math.round(total * 100) / 100;

    await conn.query('UPDATE vendas SET valor_total = ? WHERE id_venda = ?', [total, venda.insertId]);
    await conn.query(
      'INSERT INTO pagamentos (id_venda, forma_pagamento, valor) VALUES (?, ?, ?)',
      [venda.insertId, forma_pagamento, total]
    );

    await conn.commit();                    // tudo certo: grava de verdade
    res.status(201).json({ id_venda: venda.insertId, valor_total: total });
  } catch (e) {
    await conn.rollback();                  // algo falhou: desfaz tudo
    throw e;
  } finally {
    conn.release();
  }
});

// ================= PAGAMENTOS =================

// UPDATE: mudar o status (Pendente, Pago ou Cancelado)
app.put('/pagamentos/:id', async (req, res) => {
  const [r] = await db.query(
    'UPDATE pagamentos SET status = ? WHERE id_pagamento = ?',
    [req.body.status, req.params.id]
  );
  if (r.affectedRows === 0) return res.status(404).json({ erro: 'Pagamento não encontrado' });
  res.json({ mensagem: 'Pagamento atualizado' });
});

// ---------- TRATAMENTO DE ERROS ----------
// No Express 5, erros dentro de rotas async caem aqui automaticamente.
const mensagens = {
  ER_DUP_ENTRY: 'Já existe um registro com esse valor único (CPF ou e-mail).',
  ER_ROW_IS_REFERENCED_2: 'Não é possível remover: existem registros ligados a este (chave estrangeira).',
  ER_NO_REFERENCED_ROW_2: 'Registro relacionado não existe (chave estrangeira inválida).',
  ER_BAD_NULL_ERROR: 'Um campo obrigatório (NOT NULL) não foi preenchido.',
  ER_WRONG_VALUE_COUNT_ON_ROW: 'Quantidade de valores incorreta.',
  WARN_DATA_TRUNCATED: 'Valor inválido para este campo (ENUM).',
};

app.use((err, req, res, next) => {
  console.error(err.code || '', err.message);
  res.status(400).json({ erro: mensagens[err.code] || err.message });
});

// ---------- INICIAR ----------
async function iniciar() {
  try {
    // Cria o usuário admin na primeira execução (a senha precisa de hash)
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM usuarios');
    if (total === 0) {
      const hash = await bcrypt.hash('123456', 10);
      await db.query(
        'INSERT INTO usuarios (nome, email, senha_hash) VALUES (?, ?, ?)',
        ['Administrador', 'admin@escola.com', hash]
      );
      console.log('Usuário criado: admin@escola.com / 123456');
    }
  } catch (e) {
    console.error('Erro ao conectar no MySQL:', e.message);
    console.error('Confira a senha no createPool e se o banco.sql já foi executado.');
  }
  app.listen(3000, () => console.log('API rodando em http://localhost:3000'));
}
iniciar();
