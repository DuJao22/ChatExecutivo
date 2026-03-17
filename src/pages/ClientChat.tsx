import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { ShoppingBag, Send, Store, X, Plus, Minus, CheckCircle2, User } from 'lucide-react';
import { format } from 'date-fns';

export default function ClientChat() {
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedClient = localStorage.getItem('client');
    if (!storedClient) {
      navigate('/');
      return;
    }
    const parsedClient = JSON.parse(storedClient);
    setClient(parsedClient);
    setEditName(parsedClient.name);
    setEditPassword(parsedClient.password || '');

    // Fetch initial messages
    fetch(`/api/messages/${parsedClient.id}`)
      .then(res => res.json())
      .then(data => setMessages(data));

    // Fetch catalog
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data));

    // Setup Socket
    const newSocket = io();
    setSocket(newSocket);

    newSocket.emit('join', parsedClient.id);

    newSocket.on('receive_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('order_status_update', (data) => {
      // Could show a toast here
      alert(`Status do pedido #${data.orderId} atualizado para: ${data.status}`);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !client) return;

    // Assuming admin ID is 1 for simplicity, or we can fetch it.
    // In our seed, admin is the first user, so ID 1.
    socket.emit('send_message', {
      senderId: client.id,
      receiverId: 1, // Admin ID
      content: newMessage
    });

    setNewMessage('');
  };

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    
    setToastMessage(`${product.name} adicionado ao carrinho!`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/users/${client.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, password: editPassword })
      });
      if (res.ok) {
        const updated = await res.json();
        setClient(updated);
        localStorage.setItem('client', JSON.stringify(updated));
        setShowProfile(false);
        alert('Perfil atualizado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil', error);
    }
  };

  const [paymentMethod, setPaymentMethod] = useState<'na_hora' | 'no_prazo'>('na_hora');
  const [paymentDate, setPaymentDate] = useState('');

  const submitOrder = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === 'no_prazo' && !paymentDate) {
      alert('Por favor, selecione a data de pagamento.');
      return;
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          total: cartTotal,
          items: cart.map(item => ({ product_id: item.id, quantity: item.quantity, price: item.price })),
          payment_method: paymentMethod,
          payment_date: paymentMethod === 'no_prazo' ? paymentDate : null
        })
      });

      if (res.ok) {
        // Format detailed message
        let orderDetails = `📦 *Novo Pedido Enviado*\n\n`;
        cart.forEach(item => {
          orderDetails += `${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}\n`;
        });
        orderDetails += `\n*Total: R$ ${cartTotal.toFixed(2)}*`;
        orderDetails += `\n*Pagamento: ${paymentMethod === 'na_hora' ? 'Na hora' : `No prazo (Data: ${paymentDate})` }*`;

        setCart([]);
        setShowCart(false);
        
        // Send a message to chat automatically
        socket?.emit('send_message', {
          senderId: client.id,
          receiverId: 1,
          content: orderDetails
        });
      }
    } catch (error) {
      console.error('Erro ao enviar pedido', error);
    }
  };

  if (!client) return null;

  return (
    <div className="flex flex-col h-screen bg-zinc-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setShowProfile(true)} className="w-10 h-10 bg-emerald-100 hover:bg-emerald-200 transition-colors rounded-full flex items-center justify-center text-emerald-700 font-bold">
            <User className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-zinc-900">Atendimento Exclusivo</h1>
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
              Online
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowCatalog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-full text-sm font-medium transition-colors"
          >
            <Store className="w-4 h-4" />
            Catálogo
          </button>
          <button 
            onClick={() => setShowCart(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full text-sm font-medium transition-colors relative"
          >
            <ShoppingBag className="w-4 h-4" />
            Pedido
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                {cart.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-zinc-800">Bem-vindo, {client.nickname || client.name} 👋</h2>
          <p className="text-sm text-zinc-500 mt-1">Veja nosso catálogo ou envie uma mensagem.</p>
        </div>

        {messages.map((msg, idx) => {
          const isMe = msg.sender_id === client.id;
          return (
            <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${isMe ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm shadow-sm'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <span className={`text-[10px] mt-1 block ${isMe ? 'text-emerald-200' : 'text-zinc-400'}`}>
                  {format(new Date(msg.created_at), 'HH:mm')}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t border-zinc-200 p-4">
        <form onSubmit={sendMessage} className="flex gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-zinc-100 border-transparent focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 rounded-full px-6 py-3 outline-none transition-all"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white w-12 h-12 rounded-full flex items-center justify-center transition-colors"
          >
            <Send className="w-5 h-5 ml-1" />
          </button>
        </form>
      </footer>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-zinc-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Catalog Modal */}
      {showCatalog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-white sticky top-0">
              <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                <Store className="w-6 h-6 text-emerald-600" />
                Catálogo de Produtos
              </h2>
              <button onClick={() => setShowCatalog(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-zinc-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {products.length === 0 ? (
                  <p className="text-zinc-500 col-span-2 text-center py-8">Nenhum produto cadastrado.</p>
                ) : (
                  products.map(product => (
                    <div key={product.id} className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow">
                      {product.image_url && (
                        <img src={product.image_url} alt={product.name} className="w-full h-40 object-cover rounded-xl mb-4" />
                      )}
                      <h3 className="font-bold text-zinc-900 text-lg">{product.name}</h3>
                      <p className="text-sm text-zinc-500 line-clamp-2 mt-1 flex-1">{product.description}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="font-bold text-emerald-600 text-lg">R$ {product.price.toFixed(2)}</span>
                        <button 
                          onClick={() => addToCart(product)}
                          className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-medium rounded-xl transition-colors"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-white sticky top-0">
              <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-emerald-600" />
                Seu Pedido
              </h2>
              <button onClick={() => setShowCart(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-zinc-50">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
                  <p className="text-zinc-500 font-medium">Seu pedido está vazio.</p>
                  <button onClick={() => { setShowCart(false); setShowCatalog(true); }} className="mt-4 text-emerald-600 font-medium hover:underline">
                    Ver catálogo
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
                      <div className="flex-1">
                        <h4 className="font-bold text-zinc-900">{item.name}</h4>
                        <p className="text-emerald-600 font-medium text-sm">R$ {(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-zinc-100 rounded-lg p-1">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-white rounded-md transition-colors text-zinc-600">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-medium text-sm w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-white rounded-md transition-colors text-zinc-600">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
                    <h4 className="font-bold text-zinc-900">Método de Pagamento</h4>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setPaymentMethod('na_hora')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium ${paymentMethod === 'na_hora' ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-700'}`}
                      >
                        Na hora
                      </button>
                      <button 
                        onClick={() => setPaymentMethod('no_prazo')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium ${paymentMethod === 'no_prazo' ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-700'}`}
                      >
                        No prazo
                      </button>
                    </div>
                    {paymentMethod === 'no_prazo' && (
                      <input 
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
            {cart.length > 0 && (
              <div className="p-6 bg-white border-t border-zinc-100">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-zinc-500 font-medium">Total</span>
                  <span className="text-2xl font-bold text-zinc-900">R$ {cartTotal.toFixed(2)}</span>
                </div>
                <button 
                  onClick={submitOrder}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Enviar Pedido
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md flex flex-col overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-white">
              <h2 className="text-2xl font-bold text-zinc-900 flex items-center gap-2">
                <User className="w-6 h-6 text-emerald-600" />
                Meu Perfil
              </h2>
              <button onClick={() => setShowProfile(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 bg-zinc-50">
              <form onSubmit={updateProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Celular (Não editável)</label>
                  <input type="text" value={client.phone} disabled className="w-full px-4 py-2 rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-500 outline-none cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Nome</label>
                  <input type="text" required value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Senha</label>
                  <input type="password" required value={editPassword} onChange={e => setEditPassword(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl transition-colors mt-4">
                  Salvar Alterações
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
