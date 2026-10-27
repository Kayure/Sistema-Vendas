-- ============================================================
-- Banco do Sistema de Vendas (Loja)
-- Execute este script inteiro no MySQL Workbench (Ctrl+Shift+Enter)
-- ============================================================
CREATE DATABASE IF NOT EXISTS db_loja;
USE db_loja;

-- Quem usa o sistema (login). A senha é guardada como hash, nunca em texto.
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(100) NOT NULL,
  email      VARCHAR(100) NOT NULL UNIQUE,
  senha_hash VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS clientes (
  id_cliente    INT AUTO_INCREMENT PRIMARY KEY,
  nome          VARCHAR(100) NOT NULL,
  cpf           VARCHAR(14)  NOT NULL UNIQUE,
  email         VARCHAR(100),
  data_cadastro DATE DEFAULT (CURRENT_DATE)
);

-- Um cliente pode ter vários endereços (1:N)
CREATE TABLE IF NOT EXISTS enderecos (
  id_endereco INT AUTO_INCREMENT PRIMARY KEY,
  id_cliente  INT NOT NULL,
  rua         VARCHAR(100) NOT NULL,
  numero      VARCHAR(10),
  bairro      VARCHAR(60),
  cidade      VARCHAR(60)  NOT NULL,
  cep         VARCHAR(9),
  FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS produtos (
  id_produto   INT AUTO_INCREMENT PRIMARY KEY,
  nome_produto VARCHAR(100) NOT NULL,
  preco        DECIMAL(10,2) NOT NULL,
  estoque      INT NOT NULL DEFAULT 0
);

-- Cabeçalho da venda: quem comprou e quem vendeu
CREATE TABLE IF NOT EXISTS vendas (
  id_venda    INT AUTO_INCREMENT PRIMARY KEY,
  id_cliente  INT NOT NULL,
  id_usuario  INT NOT NULL,
  data_venda  DATETIME DEFAULT CURRENT_TIMESTAMP,
  valor_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- Itens da venda: liga vendas e produtos (N:N) e guarda a quantidade.
-- O preço é copiado para cá: se o produto mudar de preço depois,
-- a venda antiga continua com o valor que foi cobrado na época.
CREATE TABLE IF NOT EXISTS itens_venda (
  id_item        INT AUTO_INCREMENT PRIMARY KEY,
  id_venda       INT NOT NULL,
  id_produto     INT NOT NULL,
  quantidade     INT NOT NULL,
  preco_unitario DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (id_venda)   REFERENCES vendas(id_venda),
  FOREIGN KEY (id_produto) REFERENCES produtos(id_produto)
);

CREATE TABLE IF NOT EXISTS pagamentos (
  id_pagamento    INT AUTO_INCREMENT PRIMARY KEY,
  id_venda        INT NOT NULL,
  forma_pagamento ENUM('PIX','Cartão','Boleto') NOT NULL,
  valor           DECIMAL(10,2) NOT NULL,
  status          ENUM('Pendente','Pago','Cancelado') NOT NULL DEFAULT 'Pendente',
  FOREIGN KEY (id_venda) REFERENCES vendas(id_venda)
);

-- ---------- Dados de teste ----------
-- (o usuário admin é criado pela API na primeira execução)
INSERT INTO clientes (nome, cpf, email) VALUES
  ('Ana Silva',       '111.222.333-44', 'ana.silva@email.com'),
  ('Carlos Oliveira', '222.333.444-55', 'carlos@email.com'),
  ('Mariana Santos',  '333.444.555-66', 'mariana@email.com');

INSERT INTO enderecos (id_cliente, rua, numero, bairro, cidade, cep) VALUES
  (1, 'Rua das Flores', '120', 'Centro',    'Paranaguá', '83203-000'),
  (2, 'Av. Beira Mar',  '45',  'Costeira',  'Paranaguá', '83203-100'),
  (3, 'Rua do Porto',   '300', 'Itiberê',   'Pontal do Paraná', '83255-000');

INSERT INTO produtos (nome_produto, preco, estoque) VALUES
  ('Notebook Core i5',     3500.00, 10),
  ('Mouse Sem Fio',          89.90, 50),
  ('Teclado Mecânico',      249.00, 25),
  ('Monitor 24 Polegadas',  899.90, 15);
