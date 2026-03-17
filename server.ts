import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Database } from '@sqlitecloud/drivers';
import path from 'path';

const db = new Database('sqlitecloud://cmq6frwshz.g4.sqlite.cloud:8860/ChatExecutivo.db?apikey=Dor8OwUECYmrbcS5vWfsdGpjCpdm9ecSDJtywgvRw8k');

async function initDB() {
  try { await db.sql("ALTER TABLE users ADD COLUMN password TEXT DEFAULT '123456'"); } catch (e) {}
  try { await db.sql("ALTER TABLE users ADD COLUMN nickname TEXT"); } catch (e) {}

  await db.sql(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password TEXT DEFAULT '123456',
      nickname TEXT,
      role TEXT DEFAULT 'client',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.sql(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.sql(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    );
  `);

  await db.sql(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES users(id)
    );
  `);

  await db.sql(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  // Seed Admin
  const adminExists = await db.sql("SELECT id FROM users WHERE role = 'admin'");
  if (!adminExists || adminExists.length === 0) {
    await db.sql("INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)", ['Admin', '31990780959', '3003', 'admin']);
  } else {
    await db.sql("UPDATE users SET phone = ?, password = ? WHERE role = 'admin'", ['31990780959', '3003']);
  }
}

async function startServer() {
  console.log("Iniciando o servidor...");
  
  try {
    console.log("Conectando ao banco de dados SQLiteCloud...");
    await initDB();
    console.log("Banco de dados sincronizado com sucesso!");
  } catch (error) {
    console.error("ERRO CRÍTICO: Falha ao conectar ou inicializar o banco de dados:", error);
  }

  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: '*' }
  });
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // --- API Routes ---

  // Auth
  app.post('/api/check-user', async (req, res) => {
    const { phone } = req.body;
    const users = await db.sql('SELECT id, name, role FROM users WHERE phone = ?', [phone]);
    const user = users && users.length > 0 ? users[0] : null;
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    
    res.json(user);
  });

  app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    const users = await db.sql('SELECT * FROM users WHERE phone = ? AND password = ?', [phone, password]);
    const user = users && users.length > 0 ? users[0] : null;
    
    if (!user) {
      return res.status(401).json({ error: 'Acesso negado. Telefone ou senha incorretos.' });
    }
    if (user.status === 'blocked') {
      return res.status(403).json({ error: 'Acesso bloqueado. Contate o suporte.' });
    }
    
    res.json(user);
  });

  // Admin: Clients
  app.get('/api/clients', async (req, res) => {
    const clients = await db.sql("SELECT * FROM users WHERE role = 'client' ORDER BY created_at DESC");
    res.json(clients || []);
  });

  app.post('/api/clients', async (req, res) => {
    const { name, phone, password, nickname } = req.body;
    try {
      const info = await db.sql('INSERT INTO users (name, phone, password, nickname) VALUES (?, ?, ?, ?) RETURNING *', [name, phone, password || '123456', nickname || null]);
      res.json(info[0]);
    } catch (error: any) {
      if (error.message && error.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ error: 'Telefone já cadastrado.' });
      } else {
        res.status(500).json({ error: 'Erro ao cadastrar cliente.' });
      }
    }
  });

  app.put('/api/clients/:id/status', async (req, res) => {
    const { status } = req.body;
    await db.sql('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  });

  app.put('/api/clients/:id/nickname', async (req, res) => {
    const { nickname } = req.body;
    await db.sql('UPDATE users SET nickname = ? WHERE id = ?', [nickname, req.params.id]);
    res.json({ success: true });
  });

  app.put('/api/users/:id', async (req, res) => {
    const { name, password } = req.body;
    const updatedUser = await db.sql('UPDATE users SET name = ?, password = ? WHERE id = ? RETURNING *', [name, password, req.params.id]);
    res.json(updatedUser[0]);
  });

  // Catalog
  app.get('/api/products', async (req, res) => {
    const products = await db.sql('SELECT * FROM products ORDER BY created_at DESC');
    res.json(products || []);
  });

  app.post('/api/products', async (req, res) => {
    const { name, price, description, image_url } = req.body;
    const newProduct = await db.sql('INSERT INTO products (name, price, description, image_url) VALUES (?, ?, ?, ?) RETURNING *', [name, price, description, image_url]);
    res.json(newProduct[0]);
  });

  // Orders
  app.post('/api/orders', async (req, res) => {
    const { client_id, total, items } = req.body;
    
    try {
      await db.sql('BEGIN TRANSACTION');
      const orderRes = await db.sql('INSERT INTO orders (client_id, total) VALUES (?, ?) RETURNING id', [client_id, total]);
      const orderId = orderRes[0].id;

      for (const item of items) {
        await db.sql('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [orderId, item.product_id, item.quantity, item.price]);
      }
      await db.sql('COMMIT');
      
      // Notify admin
      const orderData = await db.sql(`
        SELECT o.*, u.name as client_name 
        FROM orders o 
        JOIN users u ON o.client_id = u.id 
        WHERE o.id = ?
      `, [orderId]);
      
      const adminData = await db.sql("SELECT id FROM users WHERE role = 'admin'");
      if (adminData && adminData.length > 0) {
        io.to(`user_${adminData[0].id}`).emit('new_order', orderData[0]);
      }

      res.json({ success: true, orderId });
    } catch (error) {
      await db.sql('ROLLBACK');
      res.status(500).json({ error: 'Erro ao criar pedido.' });
    }
  });

  app.get('/api/orders', async (req, res) => {
    const orders = await db.sql(`
      SELECT o.*, u.name as client_name 
      FROM orders o 
      JOIN users u ON o.client_id = u.id 
      ORDER BY o.created_at DESC
    `);
    
    if (!orders) return res.json([]);

    const ordersWithItems = [];
    for (const order of orders) {
      const items = await db.sql(`
        SELECT oi.*, p.name as product_name 
        FROM order_items oi 
        JOIN products p ON oi.product_id = p.id 
        WHERE oi.order_id = ?
      `, [order.id]);
      ordersWithItems.push({ ...order, items: items || [] });
    }
    
    res.json(ordersWithItems);
  });

  app.put('/api/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    await db.sql('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    
    // Notify client
    const orderData = await db.sql('SELECT client_id FROM orders WHERE id = ?', [req.params.id]);
    if (orderData && orderData.length > 0) {
      io.to(`user_${orderData[0].client_id}`).emit('order_status_update', { orderId: req.params.id, status });
    }
    
    res.json({ success: true });
  });

  // Messages
  app.get('/api/messages/:userId', async (req, res) => {
    const { userId } = req.params;
    const adminData = await db.sql("SELECT id FROM users WHERE role = 'admin'");
    
    if (!adminData || adminData.length === 0) return res.json([]);
    const admin = adminData[0];

    const messages = await db.sql(`
      SELECT * FROM messages 
      WHERE (sender_id = ? AND receiver_id = ?) 
         OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at ASC
    `, [userId, admin.id, admin.id, userId]);
    
    res.json(messages || []);
  });

  // Active Chats (For Admin)
  app.get('/api/chats', async (req, res) => {
    const adminData = await db.sql("SELECT id FROM users WHERE role = 'admin'");
    if (!adminData || adminData.length === 0) return res.json([]);

    const chats = await db.sql(`
      SELECT u.id, u.name, u.phone, u.nickname, MAX(m.created_at) as last_message_time,
             (SELECT content FROM messages WHERE (sender_id = u.id OR receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_message
      FROM users u
      JOIN messages m ON (m.sender_id = u.id OR m.receiver_id = u.id)
      WHERE u.role = 'client'
      GROUP BY u.id
      ORDER BY last_message_time DESC
    `);
    
    // Filter out nulls if no messages exist
    const validChats = (chats || []).filter((c: any) => c.id !== null);
    
    res.json(validChats);
  });

  // --- Socket.IO ---
  io.on('connection', (socket) => {
    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
    });

    socket.on('send_message', async (data) => {
      const { senderId, receiverId, content } = data;
      const msgData = await db.sql('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?) RETURNING *', [senderId, receiverId, content]);
      
      if (msgData && msgData.length > 0) {
        const msg = msgData[0];
        io.to(`user_${receiverId}`).emit('receive_message', msg);
        io.to(`user_${senderId}`).emit('receive_message', msg);
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch(error => {
  console.error("Erro fatal ao iniciar o servidor:", error);
  process.exit(1);
});
