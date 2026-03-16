import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Users, MessageSquare, Store, ShoppingBag, Plus, Ban, CheckCircle2, XCircle, Clock, Menu, X, BellRing } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('chats');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Data states
  const [clients, setClients] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  // Chat state
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // Forms
  const [newClient, setNewClient] = useState({ name: '', phone: '', password: '', nickname: '' });
  const [newProduct, setNewProduct] = useState({ name: '', price: '', description: '', image_url: '' });

  useEffect(() => {
    const storedAdmin = localStorage.getItem('admin');
    if (!storedAdmin) {
      navigate('/admin/login');
      return;
    }
    const parsedAdmin = JSON.parse(storedAdmin);
    setAdmin(parsedAdmin);

    // Request Notification Permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    fetchData();

    const newSocket = io();
    setSocket(newSocket);
    newSocket.emit('join', parsedAdmin.id);

    newSocket.on('receive_message', (msg) => {
      fetchChats();
      setMessages(prev => [...prev, msg]);
      
      if (msg.sender_id !== parsedAdmin.id) {
        playNotificationSound();
        showBrowserNotification("Nova Mensagem", msg.content);
      }
    });

    newSocket.on('new_order', (order) => {
      const msgText = `Pedido de ${order.client_name} no valor de R$ ${order.total.toFixed(2)}`;
      playNotificationSound();
      showBrowserNotification("Novo Pedido!", msgText);
      
      setToastMessage(msgText);
      setTimeout(() => setToastMessage(null), 5000);
      
      fetchOrders();
    });

    return () => newSocket.disconnect();
  }, [navigate]);

  useEffect(() => {
    if (selectedChat) {
      fetch(`/api/messages/\${selectedChat.id}`)
        .then(res => res.json())
        .then(data => setMessages(data));
    }
  }, [selectedChat]);

  const fetchData = () => {
    fetchClients();
    fetchChats();
    fetchProducts();
    fetchOrders();
  };

  const fetchClients = () => fetch('/api/clients').then(res => res.json()).then(setClients);
  const fetchChats = () => fetch('/api/chats').then(res => res.json()).then(setChats);
  const fetchProducts = () => fetch('/api/products').then(res => res.json()).then(setProducts);
  const fetchOrders = () => fetch('/api/orders').then(res => res.json()).then(setOrders);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient)
      });
      if (res.ok) {
        setNewClient({ name: '', phone: '', password: '', nickname: '' });
        fetchClients();
        alert('Cliente cadastrado com sucesso!');
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newProduct, price: parseFloat(newProduct.price) })
      });
      if (res.ok) {
        setNewProduct({ name: '', price: '', description: '', image_url: '' });
        fetchProducts();
        alert('Produto cadastrado com sucesso!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateOrderStatus = async (orderId: number, status: string) => {
    await fetch(`/api/orders/\${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchOrders();
  };

  const toggleClientStatus = async (clientId: number, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    await fetch(`/api/clients/\${clientId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    fetchClients();
  };

  const editNickname = async (client: any) => {
    const newNickname = prompt(`Digite o novo apelido para ${client.name}`, client.nickname || '');
    if (newNickname !== null) {
      await fetch(`/api/clients/${client.id}/nickname`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: newNickname })
      });
      fetchClients();
    }
  };

  const sendAdminMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !selectedChat) return;

    socket.emit('send_message', {
      senderId: admin.id,
      receiverId: selectedChat.id,
      content: newMessage
    });

    setNewMessage('');
  };

  if (!admin) return null;

  return (
    <div className="flex h-screen bg-zinc-100 font-sans relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-zinc-900 text-zinc-300 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-500" />
            Admin Panel
          </h1>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-zinc-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {[
            { id: 'chats', icon: MessageSquare, label: 'Chats Ativos' },
            { id: 'orders', icon: ShoppingBag, label: 'Pedidos' },
            { id: 'clients', icon: Users, label: 'Clientes' },
            { id: 'catalog', icon: Store, label: 'Catálogo' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSelectedChat(null); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === item.id ? 'bg-emerald-600 text-white' : 'hover:bg-zinc-800'}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-zinc-800">
          <button 
            onClick={() => { localStorage.removeItem('admin'); navigate('/admin/login'); }}
            className="w-full text-left px-4 py-2 text-sm text-zinc-500 hover:text-white transition-colors"
          >
            Sair do sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-zinc-200 px-4 lg:px-8 py-4 lg:py-5 flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-zinc-600 hover:bg-zinc-100 rounded-lg">
            <Menu className="w-6 h-6" />
          </button>
          <h2 className="text-xl lg:text-2xl font-bold text-zinc-800 capitalize truncate">
            {activeTab === 'chats' && 'Conversas em Andamento'}
            {activeTab === 'orders' && 'Gerenciamento de Pedidos'}
            {activeTab === 'clients' && 'Controle de Clientes'}
            {activeTab === 'catalog' && 'Catálogo de Produtos'}
          </h2>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8">
          
          {/* CHATS TAB */}
          {activeTab === 'chats' && (
            <div className="flex flex-col lg:flex-row h-full gap-4 lg:gap-6">
              <div className={`w-full lg:w-1/3 bg-white rounded-2xl border border-zinc-200 overflow-hidden flex flex-col ${selectedChat ? 'hidden lg:flex' : 'flex'}`}>
                <div className="p-4 border-b border-zinc-100 bg-zinc-50 font-semibold text-zinc-700">
                  Clientes
                </div>
                <div className="flex-1 overflow-y-auto">
                  {chats.map(chat => (
                    <button
                      key={chat.id}
                      onClick={() => setSelectedChat(chat)}
                      className={`w-full text-left p-4 border-b border-zinc-100 hover:bg-zinc-50 transition-colors ${selectedChat?.id === chat.id ? 'bg-emerald-50 border-l-4 border-l-emerald-500' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-zinc-900">{chat.nickname || chat.name}</span>
                        <span className="text-xs text-zinc-400">{format(new Date(chat.last_message_time), 'HH:mm')}</span>
                      </div>
                      <p className="text-sm text-zinc-500 truncate">{chat.last_message}</p>
                    </button>
                  ))}
                  {chats.length === 0 && <p className="p-4 text-zinc-500 text-center">Nenhuma conversa ativa.</p>}
                </div>
              </div>

              <div className={`flex-1 bg-white rounded-2xl border border-zinc-200 overflow-hidden flex flex-col ${!selectedChat ? 'hidden lg:flex' : 'flex'}`}>
                {selectedChat ? (
                  <>
                    <div className="p-4 border-b border-zinc-100 bg-zinc-50 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedChat(null)} className="lg:hidden p-2 -ml-2 text-zinc-500 hover:bg-zinc-200 rounded-lg">
                          <X className="w-5 h-5" />
                        </button>
                        <div>
                          <h3 className="font-bold text-zinc-900">{selectedChat.nickname || selectedChat.name}</h3>
                          <p className="text-xs text-zinc-500">{selectedChat.phone}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/50">
                      {messages.filter(m => m.sender_id === selectedChat.id || m.receiver_id === selectedChat.id).map((msg, idx) => {
                        const isAdmin = msg.sender_id === admin.id;
                        return (
                          <div key={idx} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${isAdmin ? 'bg-zinc-900 text-white rounded-br-sm' : 'bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm shadow-sm'}`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              <span className={`text-[10px] mt-1 block ${isAdmin ? 'text-zinc-400' : 'text-zinc-400'}`}>
                                {format(new Date(msg.created_at), 'HH:mm')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="p-4 bg-white border-t border-zinc-100">
                      <form onSubmit={sendAdminMessage} className="flex gap-2">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder="Mensagem para o cliente..."
                          className="flex-1 bg-zinc-100 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-xl px-4 py-3 outline-none transition-all"
                        />
                        <button type="submit" className="bg-zinc-900 hover:bg-zinc-800 text-white px-6 rounded-xl font-medium transition-colors">
                          Enviar
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-zinc-400 flex-col gap-4">
                    <MessageSquare className="w-12 h-12 opacity-20" />
                    <p>Selecione um chat para visualizar.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              {orders.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-zinc-200 text-center">
                  <p className="text-zinc-500">Nenhum pedido recebido ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {orders.map(order => (
                    <div key={order.id} className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <h3 className="text-lg font-bold text-zinc-900">Pedido #{order.id}</h3>
                          <p className="text-sm text-zinc-500">Cliente: <span className="font-medium text-zinc-700">{order.client_name}</span></p>
                          <p className="text-xs text-zinc-400 mt-1">{format(new Date(order.created_at), 'dd/MM/yyyy HH:mm')}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                            ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                            ${order.status === 'preparing' ? 'bg-blue-100 text-blue-700' : ''}
                            ${order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : ''}
                            ${order.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
                          `}>
                            {order.status === 'pending' && <Clock className="w-3 h-3" />}
                            {order.status === 'completed' && <CheckCircle2 className="w-3 h-3" />}
                            {order.status === 'cancelled' && <XCircle className="w-3 h-3" />}
                            {order.status}
                          </span>
                          <p className="text-xl font-bold text-zinc-900 mt-2">R$ {order.total.toFixed(2)}</p>
                        </div>
                      </div>
                      
                      <div className="bg-zinc-50 rounded-xl p-4 mb-6">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Itens do Pedido</h4>
                        <ul className="space-y-2">
                          {order.items.map((item: any) => (
                            <li key={item.id} className="flex justify-between text-sm">
                              <span className="text-zinc-700">{item.quantity}x {item.product_name}</span>
                              <span className="text-zinc-500">R$ {(item.price * item.quantity).toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex gap-2 justify-end">
                        {order.status === 'pending' && (
                          <>
                            <button onClick={() => updateOrderStatus(order.id, 'preparing')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Aprovar (Em preparo)</button>
                            <button onClick={() => updateOrderStatus(order.id, 'cancelled')} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200">Cancelar</button>
                          </>
                        )}
                        {order.status === 'preparing' && (
                          <button onClick={() => updateOrderStatus(order.id, 'completed')} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Marcar Concluído</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CLIENTS TAB */}
          {activeTab === 'clients' && (
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
              <div className="w-full lg:w-1/3">
                <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm lg:sticky lg:top-0">
                  <h3 className="text-lg font-bold text-zinc-900 mb-4">Cadastrar Cliente</h3>
                  <form onSubmit={handleAddClient} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Nome</label>
                      <input type="text" required value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Telefone</label>
                      <input type="tel" required value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="(00) 00000-0000" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Senha</label>
                      <input type="password" required value={newClient.password} onChange={e => setNewClient({...newClient, password: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Senha do cliente" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Apelido (Opcional)</label>
                      <input type="text" value={newClient.nickname} onChange={e => setNewClient({...newClient, nickname: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Apelido interno" />
                    </div>
                    <button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Cadastrar
                    </button>
                  </form>
                </div>
              </div>
              <div className="w-full lg:w-2/3">
                <div className="bg-white rounded-2xl border border-zinc-200 overflow-x-auto shadow-sm">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-sm text-zinc-500">
                        <th className="p-4 font-medium">Nome</th>
                        <th className="p-4 font-medium">Apelido</th>
                        <th className="p-4 font-medium">Telefone</th>
                        <th className="p-4 font-medium">Status</th>
                        <th className="p-4 font-medium">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map(client => (
                        <tr key={client.id} className="border-b border-zinc-100 last:border-0">
                          <td className="p-4 font-medium text-zinc-900">{client.name}</td>
                          <td className="p-4 text-zinc-500">
                            {client.nickname || '-'}
                            <button onClick={() => editNickname(client)} className="ml-2 text-xs text-emerald-600 hover:underline">Editar</button>
                          </td>
                          <td className="p-4 text-zinc-500">{client.phone}</td>
                          <td className="p-4">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold uppercase ${client.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {client.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <button 
                              onClick={() => toggleClientStatus(client.id, client.status)}
                              className={`p-2 rounded-lg transition-colors ${client.status === 'active' ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                              title={client.status === 'active' ? 'Bloquear' : 'Desbloquear'}
                            >
                              {client.status === 'active' ? <Ban className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {clients.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-zinc-500">Nenhum cliente cadastrado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CATALOG TAB */}
          {activeTab === 'catalog' && (
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-8">
              <div className="w-full lg:w-1/3">
                <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm lg:sticky lg:top-0">
                  <h3 className="text-lg font-bold text-zinc-900 mb-4">Adicionar Produto</h3>
                  <form onSubmit={handleAddProduct} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Nome do Produto</label>
                      <input type="text" required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Preço (R$)</label>
                      <input type="number" step="0.01" required value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">URL da Imagem (opcional)</label>
                      <input type="url" value={newProduct.image_url} onChange={e => setNewProduct({...newProduct, image_url: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="https://..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Descrição</label>
                      <textarea rows={3} value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none resize-none"></textarea>
                    </div>
                    <button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" /> Adicionar Produto
                    </button>
                  </form>
                </div>
              </div>
              <div className="w-full lg:w-2/3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.map(product => (
                    <div key={product.id} className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col shadow-sm">
                      {product.image_url && (
                        <img src={product.image_url} alt={product.name} className="w-full h-40 object-cover rounded-xl mb-4" />
                      )}
                      <h3 className="font-bold text-zinc-900 text-lg">{product.name}</h3>
                      <p className="text-sm text-zinc-500 line-clamp-2 mt-1 flex-1">{product.description}</p>
                      <div className="mt-4">
                        <span className="font-bold text-emerald-600 text-lg">R$ {product.price.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  {products.length === 0 && (
                    <div className="col-span-2 bg-white p-12 rounded-2xl border border-zinc-200 text-center">
                      <Store className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                      <p className="text-zinc-500">Nenhum produto cadastrado no catálogo.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-zinc-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 border border-zinc-800">
          <div className="bg-emerald-500/20 p-3 rounded-full">
            <BellRing className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h4 className="font-bold text-sm">Novo Pedido!</h4>
            <p className="text-sm text-zinc-300">{toastMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
}

const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio play failed", e);
  }
};

const showBrowserNotification = (title: string, body: string) => {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
};

// Add Shield to lucide-react imports
function Shield(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
}
