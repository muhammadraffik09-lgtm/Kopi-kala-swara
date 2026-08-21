const { createApp, ref, reactive, computed, onMounted, onUnmounted, onUpdated, nextTick, watch } = Vue;

createApp({
  setup() {
    /* ---------------------------------------------------------
       ICONS — re-render lucide icons after every DOM update
    --------------------------------------------------------- */
    const refreshIcons = () => nextTick(() => { if (window.lucide) lucide.createIcons(); });
    onMounted(refreshIcons);
    onUpdated(refreshIcons);

    /* ---------------------------------------------------------
       AUTH / ROLE
    --------------------------------------------------------- */
    const currentUser = ref(null); // null | 'customer' | 'waiter'
    const customerProfile = { name: 'Budi', table: '05' };
    const waiterProfile = { name: 'Rian', role: 'Waiter / Kasir' };

    const loginAs = (role) => { currentUser.value = role; activeCustomerTab.value = 'menu'; };
    const logout = () => { currentUser.value = null; };

    /* ---------------------------------------------------------
       MENU DATA
    --------------------------------------------------------- */
    const menuItems = reactive([
      // Coffee
      { id: 1, category: 'coffee', name: 'Kopi Susu Gula Aren', price: 22000, desc: 'Espresso creamy dipadu gula aren asli, manis alami khas nusantara.', icon: 'coffee', tone: 'coffee' },
      { id: 2, category: 'coffee', name: 'Americano', price: 18000, desc: 'Racikan espresso klasik, tegas, bersih, tanpa embel-embel.', icon: 'flame', tone: 'coffee' },
      { id: 3, category: 'coffee', name: 'Cappuccino', price: 25000, desc: 'Espresso dengan foam susu lembut bertekstur, seimbang.', icon: 'circle-dot', tone: 'coffee' },
      { id: 4, category: 'coffee', name: 'Kopi Tubruk', price: 15000, desc: 'Kopi hitam tradisional, diseduh langsung bersama gula.', icon: 'flame', tone: 'coffee' },
      { id: 5, category: 'coffee', name: 'Vietnam Drip', price: 23000, desc: 'Robusta pekat menetes perlahan dengan susu kental manis.', icon: 'droplets', tone: 'coffee' },
      // Non-Coffee
      { id: 6, category: 'noncoffee', name: 'Matcha Latte', price: 27000, desc: 'Bubuk matcha grade ceremonial, susu creamy, pahit lembut.', icon: 'leaf', tone: 'green' },
      { id: 7, category: 'noncoffee', name: 'Chocolate Malt', price: 24000, desc: 'Cokelat kental dengan malt gurih, favorit segala usia.', icon: 'candy', tone: 'brown' },
      { id: 8, category: 'noncoffee', name: 'Taro Latte', price: 26000, desc: 'Krim taro ungu yang lembut dengan sentuhan vanila.', icon: 'sparkles', tone: 'purple' },
      { id: 9, category: 'noncoffee', name: 'Lemon Tea Sereh', price: 18000, desc: 'Teh segar dengan perasan lemon dan aroma sereh alami.', icon: 'citrus', tone: 'green' },
      { id: 10, category: 'noncoffee', name: 'Wedang Jahe Susu', price: 20000, desc: 'Jahe merah hangat berpadu susu, penghangat sore hari.', icon: 'flame', tone: 'brown' },
      // Pastry / Snack
      { id: 11, category: 'pastry', name: 'Croissant Butter', price: 20000, desc: 'Berlapis mentega, renyah di luar, lembut berongga di dalam.', icon: 'croissant', tone: 'amber' },
      { id: 12, category: 'pastry', name: 'Pisang Goreng Karamel', price: 16000, desc: 'Pisang goreng crispy disiram saus karamel gula aren.', icon: 'wheat', tone: 'amber' },
      { id: 13, category: 'pastry', name: 'Roti Bakar Cokelat Keju', price: 18000, desc: 'Roti bakar isi cokelat leleh dan taburan keju parut.', icon: 'sandwich', tone: 'amber' },
      { id: 14, category: 'pastry', name: 'Banana Bread Slice', price: 17000, desc: 'Bantat pisang lembap dengan aroma kayu manis hangat.', icon: 'cake-slice', tone: 'amber' },
      { id: 15, category: 'pastry', name: 'Kentang Goreng', price: 15000, desc: 'Kentang goreng renyah, disajikan dengan saus sambal madu.', icon: 'utensils', tone: 'amber' },
    ]);

    const categories = [
      { key: 'coffee', label: 'Coffee' },
      { key: 'noncoffee', label: 'Non-Coffee' },
      { key: 'pastry', label: 'Pastry & Snack' },
    ];
    const activeCategory = ref('coffee');
    const menuByCategory = computed(() => menuItems.filter(m => m.category === activeCategory.value));

    const toneClasses = (tone) => ({
      coffee: 'bg-coffee-800 text-amber-100',
      green:  'bg-emerald-700 text-emerald-50',
      brown:  'bg-coffee-600 text-amber-50',
      purple: 'bg-[#6B4A6B] text-amber-50',
      amber:  'bg-amber-600 text-amber-50',
    }[tone] || 'bg-coffee-800 text-amber-100');

    /* ---------------------------------------------------------
       CART (customer side)
    --------------------------------------------------------- */
    const cart = ref([]); // { menuId, name, price, qty, note }
    const cartOpen = ref(false);

    const addToCart = (item) => {
      const existing = cart.value.find(c => c.menuId === item.id && c.note === '');
      if (existing) { existing.qty++; }
      else { cart.value.push({ menuId: item.id, name: item.name, price: item.price, qty: 1, note: '' }); }
      cartOpen.value = true;
    };
    const incQty = (line) => line.qty++;
    const decQty = (line) => { line.qty--; if (line.qty <= 0) removeFromCart(line); };
    const removeFromCart = (line) => { cart.value = cart.value.filter(c => c !== line); };
    const cartTotal = computed(() => cart.value.reduce((s, l) => s + l.price * l.qty, 0));
    const cartCount = computed(() => cart.value.reduce((s, l) => s + l.qty, 0));

    /* ---------------------------------------------------------
       ORDERS — persisted in a real SQLite database on the server,
       fetched over HTTP. No localStorage involved.
    --------------------------------------------------------- */
    const orders = reactive([]);
    const isSyncing = ref(false);
    const syncError = ref('');
    const API_BASE = '/api/orders';

    // Server returns createdAt/completedAt as ISO strings — convert to Date
    // objects locally so the rest of the app (formatTime, isToday, sort) can
    // keep working with real Date instances.
    const hydrate = (o) => ({
      ...o,
      createdAt: new Date(o.createdAt),
      completedAt: o.completedAt ? new Date(o.completedAt) : undefined,
    });

    const fetchOrders = async () => {
      try {
        const res = await fetch(API_BASE);
        if (!res.ok) throw new Error('Gagal mengambil data pesanan');
        const data = await res.json();
        const hydrated = data.map(hydrate);
        // Replace in place so Vue reactivity / v-for keys stay stable
        orders.splice(0, orders.length, ...hydrated);
        syncError.value = '';
      } catch (e) {
        syncError.value = 'Tidak dapat terhubung ke server. Pastikan "node server.js" sedang berjalan.';
      }
    };

    const patchOrder = async (id, payload) => {
      try {
        const res = await fetch(`${API_BASE}/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Gagal memperbarui pesanan');
        const updated = await res.json();
        const idx = orders.findIndex(o => o.id === id);
        if (idx !== -1) orders[idx] = hydrate(updated);
      } catch (e) {
        syncError.value = 'Gagal menyimpan perubahan ke server. Coba lagi.';
      }
    };

    // Initial load + polling every 2.5s so the customer & waiter dashboards
    // (potentially on different devices) stay in sync via the database.
    let pollTimer = null;
    onMounted(() => {
      fetchOrders();
      pollTimer = setInterval(fetchOrders, 2500);
    });
    onUnmounted(() => { if (pollTimer) clearInterval(pollTimer); });

    const statusMeta = {
      'Menunggu Konfirmasi': { badge: 'bg-amber-100 text-amber-700 border-amber-300', dot: 'bg-amber-500' },
      'Sedang Diproses':     { badge: 'bg-coffee-100 text-coffee-700 border-coffee-300', dot: 'bg-coffee-600' },
      'Siap Diantar':        { badge: 'bg-emerald-100 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500' },
      'Selesai':             { badge: 'bg-char-800/10 text-char-800 border-char-800/20', dot: 'bg-char-800' },
      'Dibatalkan':          { badge: 'bg-red-100 text-red-600 border-red-300', dot: 'bg-red-500' },
    };

    const submitOrder = async () => {
      if (cart.value.length === 0) return;
      isSyncing.value = true;
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: customerProfile.table,
            customerName: customerProfile.name,
            items: cart.value.map(l => ({ ...l })),
            total: cartTotal.value,
          }),
        });
        if (!res.ok) throw new Error('Gagal membuat pesanan');
        const created = await res.json();
        orders.unshift(hydrate(created));
        cart.value = [];
        cartOpen.value = false;
        activeCustomerTab.value = 'orders';
        syncError.value = '';
      } catch (e) {
        syncError.value = 'Gagal mengirim pesanan ke server. Pastikan server menyala, lalu coba lagi.';
      } finally {
        isSyncing.value = false;
      }
    };

    const cancelOrderByCustomer = (order) => {
      if (order.status !== 'Menunggu Konfirmasi') return;
      patchOrder(order.id, { status: 'Dibatalkan' });
    };

    // Waiter actions — each one writes straight to the server database
    const confirmOrder = (order) => patchOrder(order.id, { status: 'Sedang Diproses' });
    const markReady = (order) => patchOrder(order.id, { status: 'Siap Diantar' });
    const markDone = (order) => patchOrder(order.id, { status: 'Selesai' });
    const rejectOrder = (order) => patchOrder(order.id, { status: 'Dibatalkan', rejectReason: 'Stok habis' });

    // Views into shared order list
    const myOrders = computed(() =>
      orders.filter(o => o.table === customerProfile.table)
    );
    const activeMyOrders = computed(() =>
      myOrders.value.filter(o => o.status !== 'Selesai' && o.status !== 'Dibatalkan')
    );
    const pastMyOrders = computed(() =>
      myOrders.value.filter(o => o.status === 'Selesai' || o.status === 'Dibatalkan')
    );

    const queueColumns = ['Menunggu Konfirmasi', 'Sedang Diproses', 'Siap Diantar', 'Selesai'];
    const ordersByStatus = (status) => orders.filter(o => o.status === status)
      .sort((a,b) => b.createdAt - a.createdAt);

    const isToday = (d) => {
      const now = new Date();
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    };
    const todayOrdersCount = computed(() => orders.filter(o => isToday(o.createdAt)).length);
    const todayRevenue = computed(() => orders
      .filter(o => o.status === 'Selesai' && isToday(o.createdAt))
      .reduce((s, o) => s + o.total, 0));
    const activeQueueCount = computed(() => orders
      .filter(o => o.status === 'Menunggu Konfirmasi' || o.status === 'Sedang Diproses').length);

    /* ---------------------------------------------------------
       FORMATTERS
    --------------------------------------------------------- */
    const formatIDR = (n) => 'Rp ' + n.toLocaleString('id-ID');
    const formatTime = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    /* ---------------------------------------------------------
       UI STATE
    --------------------------------------------------------- */
    const activeCustomerTab = ref('menu'); // 'menu' | 'orders'
    const mobileNavOpen = ref(false);

    return {
      currentUser, customerProfile, waiterProfile, loginAs, logout,
      menuItems, categories, activeCategory, menuByCategory, toneClasses,
      cart, cartOpen, addToCart, incQty, decQty, removeFromCart, cartTotal, cartCount,
      orders, statusMeta, submitOrder, cancelOrderByCustomer,
      confirmOrder, markReady, markDone, rejectOrder,
      myOrders, activeMyOrders, pastMyOrders,
      queueColumns, ordersByStatus,
      todayOrdersCount, todayRevenue, activeQueueCount,
      formatIDR, formatTime,
      activeCustomerTab, mobileNavOpen,
      isSyncing, syncError,
    };
  },
  template: `
  <div class="min-h-screen flex flex-col">

    <!-- ============ LOGIN / ROLE SELECT ============ -->
    <div v-if="!currentUser" class="min-h-screen flex items-center justify-center bean-field bg-cream-50 px-4 py-12">
      <div class="w-full max-w-4xl animate-[popin_.4s_ease_both]">
        <div class="text-center mb-10">
          <div class="inline-flex items-center gap-2 mb-5">
            <div class="w-11 h-11 rounded-2xl bg-coffee-800 flex items-center justify-center shadow-soft">
              <i data-lucide="coffee" class="w-5 h-5 text-amber-200"></i>
            </div>
            <span class="font-display italic text-2xl text-coffee-800">Kopi Kala Swara</span>
          </div>
          <h1 class="font-display text-3xl md:text-4xl text-coffee-900 mb-3">Selamat datang, silakan masuk</h1>
          <p class="text-coffee-500 max-w-md mx-auto">Pilih peran untuk mensimulasikan alur pemesanan — dari meja pelanggan hingga meja kasir.</p>
        </div>

        <div class="grid sm:grid-cols-2 gap-6">
          <button @click="loginAs('customer')" class="group text-left bg-white rounded-2xl p-7 shadow-soft hover:shadow-lift transition-all duration-300 border border-coffee-100 hover:-translate-y-1">
            <div class="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-5 group-hover:bg-amber-500 transition-colors">
              <i data-lucide="user-round" class="w-6 h-6 text-amber-600 group-hover:text-white transition-colors"></i>
            </div>
            <h3 class="font-display text-xl text-coffee-900 mb-1">Pelanggan</h3>
            <p class="font-mono text-xs text-coffee-400 mb-4 tracking-wide">MEJA 05 &middot; BUDI</p>
            <p class="text-sm text-coffee-500 leading-relaxed">Lihat menu, buat pesanan, dan pantau status pesanan secara langsung.</p>
            <div class="mt-5 inline-flex items-center gap-1.5 text-amber-600 text-sm font-semibold">
              Masuk sebagai Pelanggan <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
            </div>
          </button>

          <button @click="loginAs('waiter')" class="group text-left bg-coffee-900 rounded-2xl p-7 shadow-soft hover:shadow-lift transition-all duration-300 border border-coffee-800 hover:-translate-y-1">
            <div class="w-12 h-12 rounded-xl bg-coffee-700 flex items-center justify-center mb-5 group-hover:bg-amber-500 transition-colors">
              <i data-lucide="chef-hat" class="w-6 h-6 text-amber-200 group-hover:text-white transition-colors"></i>
            </div>
            <h3 class="font-display text-xl text-cream-50 mb-1">Staff Waiter / Kasir</h3>
            <p class="font-mono text-xs text-amber-200/70 mb-4 tracking-wide">STAFF &middot; RIAN</p>
            <p class="text-sm text-coffee-200 leading-relaxed">Kelola antrean pesanan masuk dan pantau pendapatan hari ini.</p>
            <div class="mt-5 inline-flex items-center gap-1.5 text-amber-300 text-sm font-semibold">
              Masuk sebagai Staff <i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- ============ APP SHELL (logged in) ============ -->
    <template v-else>

      <!-- CONNECTION BANNER -->
      <div v-if="syncError" class="sticky top-0 z-40 bg-red-600 text-white text-xs md:text-sm px-4 py-2 flex items-center justify-center gap-2 text-center">
        <i data-lucide="wifi-off" class="w-3.5 h-3.5 shrink-0" style="width:14px;height:14px"></i>
        {{ syncError }}
      </div>

      <!-- NAVBAR -->
      <header class="sticky top-0 z-30 bg-cream-50/90 backdrop-blur border-b border-coffee-100">
        <div class="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-coffee-800 flex items-center justify-center">
              <i data-lucide="coffee" class="w-4.5 h-4.5 text-amber-200" style="width:18px;height:18px"></i>
            </div>
            <span class="font-display italic text-lg text-coffee-800 hidden sm:block">Kopi Kala Swara</span>
          </div>

          <!-- customer tabs -->
          <nav v-if="currentUser === 'customer'" class="hidden md:flex items-center gap-1 bg-white rounded-full p-1 border border-coffee-100 shadow-softer">
            <button @click="activeCustomerTab = 'menu'" :class="activeCustomerTab==='menu' ? 'bg-coffee-800 text-cream-50' : 'text-coffee-500 hover:text-coffee-800'" class="px-4 py-1.5 rounded-full text-sm font-semibold transition-colors">Menu</button>
            <button @click="activeCustomerTab = 'orders'" :class="activeCustomerTab==='orders' ? 'bg-coffee-800 text-cream-50' : 'text-coffee-500 hover:text-coffee-800'" class="relative px-4 py-1.5 rounded-full text-sm font-semibold transition-colors">
              Pesanan Saya
              <span v-if="activeMyOrders.length" class="absolute -top-1 -right-1 w-4.5 h-4.5 text-[10px] flex items-center justify-center bg-amber-500 text-white rounded-full" style="width:18px;height:18px">{{ activeMyOrders.length }}</span>
            </button>
          </nav>

          <div class="flex items-center gap-3">
            <!-- cart button (customer, menu tab) -->
            <button v-if="currentUser === 'customer'" @click="cartOpen = true" class="relative w-10 h-10 rounded-full bg-white border border-coffee-100 shadow-softer flex items-center justify-center hover:border-amber-400 transition-colors">
              <i data-lucide="shopping-bag" class="w-4.5 h-4.5 text-coffee-700" style="width:18px;height:18px"></i>
              <span v-if="cartCount" class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold flex items-center justify-center bg-amber-500 text-white rounded-full">{{ cartCount }}</span>
            </button>

            <!-- status pill -->
            <div class="flex items-center gap-2 pl-3 pr-1.5 py-1.5 bg-white rounded-full border border-coffee-100 shadow-softer">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <div class="text-right hidden sm:block leading-tight">
                <p class="text-xs font-bold text-coffee-900">{{ currentUser === 'customer' ? customerProfile.name : waiterProfile.name }}</p>
                <p class="text-[10px] text-coffee-400 font-mono">{{ currentUser === 'customer' ? 'MEJA ' + customerProfile.table : waiterProfile.role.toUpperCase() }}</p>
              </div>
              <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" :class="currentUser === 'customer' ? 'bg-amber-100 text-amber-700' : 'bg-coffee-800 text-amber-100'">
                {{ (currentUser === 'customer' ? customerProfile.name : waiterProfile.name).charAt(0) }}
              </div>
              <button @click="logout" title="Keluar" class="w-7 h-7 rounded-full flex items-center justify-center text-coffee-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <i data-lucide="log-out" class="w-3.5 h-3.5" style="width:14px;height:14px"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- mobile tabs for customer -->
        <div v-if="currentUser === 'customer'" class="md:hidden flex border-t border-coffee-100 bg-cream-50">
          <button @click="activeCustomerTab = 'menu'" :class="activeCustomerTab==='menu' ? 'text-coffee-900 border-coffee-800' : 'text-coffee-400 border-transparent'" class="flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors">Menu</button>
          <button @click="activeCustomerTab = 'orders'" :class="activeCustomerTab==='orders' ? 'text-coffee-900 border-coffee-800' : 'text-coffee-400 border-transparent'" class="flex-1 py-2.5 text-sm font-semibold border-b-2 transition-colors relative">
            Pesanan Saya
            <span v-if="activeMyOrders.length" class="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-amber-500 text-white rounded-full align-middle">{{ activeMyOrders.length }}</span>
          </button>
        </div>
      </header>

      <!-- ============ CUSTOMER: MENU TAB ============ -->
      <main v-if="currentUser === 'customer' && activeCustomerTab === 'menu'" class="flex-1 max-w-6xl w-full mx-auto px-4 md:px-6 py-8">
        <div class="mb-8">
          <p class="font-mono text-xs tracking-widest text-amber-600 mb-2">MEJA {{ customerProfile.table }} &middot; SELAMAT DATANG {{ customerProfile.name.toUpperCase() }}</p>
          <h1 class="font-display text-3xl md:text-4xl text-coffee-900">Apa yang ingin kamu seduh hari ini?</h1>
        </div>

        <!-- category tabs -->
        <div class="flex items-center gap-2 mb-7 overflow-x-auto scrollbar-thin pb-1">
          <button v-for="c in categories" :key="c.key" @click="activeCategory = c.key"
            :class="activeCategory === c.key ? 'bg-coffee-800 text-cream-50 border-coffee-800' : 'bg-white text-coffee-600 border-coffee-100 hover:border-coffee-300'"
            class="whitespace-nowrap px-5 py-2 rounded-full text-sm font-semibold border transition-colors">
            {{ c.label }}
          </button>
        </div>

        <!-- menu grid -->
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div v-for="item in menuByCategory" :key="item.id" class="bg-white rounded-2xl border border-coffee-100 shadow-softer hover:shadow-soft transition-shadow p-5 flex flex-col">
            <div class="flex items-start justify-between mb-4">
              <div class="w-14 h-14 rounded-2xl flex items-center justify-center" :class="toneClasses(item.tone)">
                <i :data-lucide="item.icon" class="w-6 h-6"></i>
              </div>
              <span class="font-mono text-sm font-semibold text-coffee-800">{{ formatIDR(item.price) }}</span>
            </div>
            <h3 class="font-display text-lg text-coffee-900 mb-1.5">{{ item.name }}</h3>
            <p class="text-sm text-coffee-500 leading-relaxed flex-1">{{ item.desc }}</p>
            <button @click="addToCart(item)" class="mt-4 w-full py-2.5 rounded-xl bg-coffee-800 text-cream-50 text-sm font-semibold hover:bg-amber-600 transition-colors flex items-center justify-center gap-1.5">
              <i data-lucide="plus" class="w-4 h-4"></i> Tambah ke Pesanan
            </button>
          </div>
        </div>
      </main>

      <!-- ============ CUSTOMER: ORDERS TAB ============ -->
      <main v-else-if="currentUser === 'customer' && activeCustomerTab === 'orders'" class="flex-1 max-w-3xl w-full mx-auto px-4 md:px-6 py-8">
        <h1 class="font-display text-3xl text-coffee-900 mb-1">Pesanan Saya</h1>
        <p class="text-coffee-500 mb-7 text-sm">Status pesanan diperbarui langsung oleh staff waiter.</p>

        <div v-if="myOrders.length === 0" class="bg-white rounded-2xl border border-dashed border-coffee-200 p-12 text-center">
          <i data-lucide="coffee" class="w-8 h-8 text-coffee-300 mx-auto mb-3"></i>
          <p class="text-coffee-400 text-sm">Belum ada pesanan. Yuk pilih menu favoritmu.</p>
          <button @click="activeCustomerTab = 'menu'" class="mt-4 text-amber-600 font-semibold text-sm hover:underline">Lihat Menu &rarr;</button>
        </div>

        <div class="space-y-4">
          <div v-for="order in activeMyOrders" :key="order.id" class="bg-white rounded-2xl border border-coffee-100 shadow-soft overflow-hidden animate-popin">
            <div class="p-5">
              <div class="flex items-start justify-between mb-4">
                <div>
                  <p class="font-mono text-xs text-coffee-400 tracking-wide">ORDER #{{ order.id }} &middot; {{ formatTime(order.createdAt) }}</p>
                  <span class="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full text-xs font-bold border" :class="statusMeta[order.status].badge">
                    <span class="w-1.5 h-1.5 rounded-full" :class="statusMeta[order.status].dot"></span>
                    {{ order.status }}
                  </span>
                </div>
                <p class="font-mono text-sm font-bold text-coffee-900">{{ formatIDR(order.total) }}</p>
              </div>

              <ul class="space-y-1.5 mb-4">
                <li v-for="l in order.items" :key="l.menuId + l.note" class="flex justify-between text-sm text-coffee-600">
                  <span>{{ l.qty }}&times; {{ l.name }} <span v-if="l.note" class="text-amber-600 italic">({{ l.note }})</span></span>
                  <span class="font-mono">{{ formatIDR(l.price * l.qty) }}</span>
                </li>
              </ul>

              <!-- Sedang Diproses animation -->
              <div v-if="order.status === 'Sedang Diproses'" class="flex items-center gap-2.5 bg-coffee-50 rounded-xl px-4 py-3 mb-3">
                <div class="relative w-5 h-5 flex items-end justify-center">
                  <i data-lucide="coffee" class="w-4 h-4 text-coffee-600"></i>
                  <span class="absolute -top-1 left-0.5 w-0.5 h-2 bg-coffee-400 rounded-full animate-steam1"></span>
                  <span class="absolute -top-1 left-2 w-0.5 h-2 bg-coffee-400 rounded-full animate-steam2"></span>
                  <span class="absolute -top-1 left-3.5 w-0.5 h-2 bg-coffee-400 rounded-full animate-steam3"></span>
                </div>
                <p class="text-sm text-coffee-700 font-semibold">Pesanan sedang dibuat barista ☕</p>
              </div>
              <div v-else-if="order.status === 'Siap Diantar'" class="flex items-center gap-2.5 bg-emerald-50 rounded-xl px-4 py-3 mb-3">
                <i data-lucide="bell-ring" class="w-4 h-4 text-emerald-600"></i>
                <p class="text-sm text-emerald-700 font-semibold">Pesanan siap! Segera diantar ke meja {{ order.table }}.</p>
              </div>

              <button v-if="order.status === 'Menunggu Konfirmasi'" @click="cancelOrderByCustomer(order)"
                class="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
                <i data-lucide="x" class="w-4 h-4"></i> Batalkan Pesanan
              </button>
              <p v-else-if="order.status === 'Sedang Diproses' || order.status === 'Siap Diantar'" class="text-center text-xs text-coffee-400">
                Pesanan sudah diproses dapur, tidak dapat dibatalkan lagi.
              </p>
            </div>
          </div>

          <!-- history -->
          <div v-if="pastMyOrders.length" class="pt-4">
            <p class="text-xs font-bold text-coffee-400 tracking-widest mb-3">RIWAYAT</p>
            <div class="space-y-2">
              <div v-for="order in pastMyOrders" :key="order.id" class="bg-white/60 rounded-xl border border-coffee-100 px-4 py-3 flex items-center justify-between opacity-80">
                <div>
                  <p class="font-mono text-xs text-coffee-400">#{{ order.id }} &middot; {{ formatTime(order.createdAt) }}</p>
                  <span class="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-[11px] font-bold border" :class="statusMeta[order.status].badge">{{ order.status }}</span>
                </div>
                <p class="font-mono text-sm text-coffee-700">{{ formatIDR(order.total) }}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- ============ WAITER DASHBOARD ============ -->
      <main v-else-if="currentUser === 'waiter'" class="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-8">
        <div class="flex flex-wrap items-end justify-between gap-4 mb-7">
          <div>
            <p class="font-mono text-xs tracking-widest text-amber-600 mb-2">KITCHEN &amp; CASHIER BOARD</p>
            <h1 class="font-display text-3xl md:text-4xl text-coffee-900">Antrean Pesanan</h1>
          </div>
        </div>

        <!-- summary cards -->
        <div class="grid sm:grid-cols-3 gap-4 mb-8">
          <div class="bg-white rounded-2xl border border-coffee-100 shadow-softer p-5 flex items-center gap-4">
            <div class="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0"><i data-lucide="receipt" class="w-5 h-5 text-amber-600"></i></div>
            <div>
              <p class="text-2xl font-display font-semibold text-coffee-900 leading-none">{{ todayOrdersCount }}</p>
              <p class="text-xs text-coffee-400 mt-1">Total Pesanan Masuk Hari Ini</p>
            </div>
          </div>
          <div class="bg-white rounded-2xl border border-coffee-100 shadow-softer p-5 flex items-center gap-4">
            <div class="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0"><i data-lucide="wallet" class="w-5 h-5 text-emerald-600"></i></div>
            <div>
              <p class="text-2xl font-display font-semibold text-coffee-900 leading-none">{{ formatIDR(todayRevenue) }}</p>
              <p class="text-xs text-coffee-400 mt-1">Pendapatan Hari Ini (Selesai)</p>
            </div>
          </div>
          <div class="bg-white rounded-2xl border border-coffee-100 shadow-softer p-5 flex items-center gap-4">
            <div class="w-11 h-11 rounded-xl bg-coffee-100 flex items-center justify-center shrink-0"><i data-lucide="timer" class="w-5 h-5 text-coffee-700"></i></div>
            <div>
              <p class="text-2xl font-display font-semibold text-coffee-900 leading-none">{{ activeQueueCount }}</p>
              <p class="text-xs text-coffee-400 mt-1">Pesanan Aktif Dalam Antrean</p>
            </div>
          </div>
        </div>

        <!-- kanban -->
        <div v-if="orders.length === 0" class="bg-white rounded-2xl border border-dashed border-coffee-200 p-12 text-center">
          <i data-lucide="inbox" class="w-8 h-8 text-coffee-300 mx-auto mb-3"></i>
          <p class="text-coffee-400 text-sm">Belum ada pesanan masuk dari pelanggan.</p>
        </div>

        <div v-else class="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
          <div v-for="col in queueColumns" :key="col" class="min-w-0">
            <div class="flex items-center gap-2 mb-3 px-1">
              <span class="w-2 h-2 rounded-full" :class="statusMeta[col].dot"></span>
              <h2 class="text-sm font-bold text-coffee-800">{{ col }}</h2>
              <span class="ml-auto text-xs font-mono text-coffee-400">{{ ordersByStatus(col).length }}</span>
            </div>

            <div class="space-y-3 md:max-h-[70vh] md:overflow-y-auto scrollbar-thin pr-0.5 pb-1">
              <div v-for="order in ordersByStatus(col)" :key="order.id" class="ticket bg-white rounded-2xl border border-coffee-100 shadow-softer pt-4 px-4 pb-4">
                <div class="flex items-start justify-between mb-3">
                  <div>
                    <p class="font-mono text-xs font-bold text-coffee-800">#{{ order.id }}</p>
                    <p class="text-xs text-coffee-400">Meja {{ order.table }} &middot; {{ order.customerName }}</p>
                  </div>
                  <p class="font-mono text-[11px] text-coffee-400">{{ formatTime(order.createdAt) }}</p>
                </div>

                <ul class="space-y-1 mb-3 border-t border-dashed border-coffee-200 pt-3">
                  <li v-for="l in order.items" :key="l.menuId + l.note" class="text-xs text-coffee-600 flex justify-between gap-2">
                    <span>{{ l.qty }}&times; {{ l.name }}<span v-if="l.note" class="text-amber-600 italic"> — {{ l.note }}</span></span>
                  </li>
                </ul>

                <div class="flex items-center justify-between border-t border-dashed border-coffee-200 pt-3 mb-3">
                  <span class="text-xs text-coffee-400">Total</span>
                  <span class="font-mono text-sm font-bold text-coffee-900">{{ formatIDR(order.total) }}</span>
                </div>

                <!-- actions per status -->
                <div v-if="col === 'Menunggu Konfirmasi'" class="flex gap-2">
                  <button @click="confirmOrder(order)" class="flex-1 py-2 rounded-lg bg-coffee-800 text-cream-50 text-xs font-bold hover:bg-amber-600 transition-colors">Konfirmasi</button>
                  <button @click="rejectOrder(order)" title="Tolak — stok habis" class="w-9 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center">
                    <i data-lucide="ban" class="w-3.5 h-3.5" style="width:14px;height:14px"></i>
                  </button>
                </div>
                <button v-else-if="col === 'Sedang Diproses'" @click="markReady(order)" class="w-full py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">Tandai Siap Diantar</button>
                <button v-else-if="col === 'Siap Diantar'" @click="markDone(order)" class="w-full py-2 rounded-lg bg-char-800 text-white text-xs font-bold hover:bg-char-900 transition-colors">Tandai Selesai</button>
                <p v-else-if="col === 'Selesai'" class="text-center text-[11px] text-emerald-600 font-semibold flex items-center justify-center gap-1">
                  <i data-lucide="check-check" class="w-3.5 h-3.5" style="width:14px;height:14px"></i> Pesanan tuntas
                </p>
              </div>

              <p v-if="ordersByStatus(col).length === 0" class="text-xs text-coffee-300 italic px-1">Tidak ada pesanan.</p>
            </div>
          </div>
        </div>

        <!-- rejected orders (collapsed strip) -->
        <div v-if="ordersByStatus('Dibatalkan').length" class="mt-8">
          <p class="text-xs font-bold text-coffee-400 tracking-widest mb-3">DIBATALKAN / DITOLAK</p>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div v-for="order in ordersByStatus('Dibatalkan')" :key="order.id" class="bg-white/60 rounded-xl border border-red-100 px-4 py-3 flex items-center justify-between">
              <div>
                <p class="font-mono text-xs text-coffee-500">#{{ order.id }} &middot; Meja {{ order.table }}</p>
                <p class="text-[11px] text-red-500">{{ order.rejectReason || 'Dibatalkan pelanggan' }}</p>
              </div>
              <p class="font-mono text-xs text-coffee-400">{{ formatIDR(order.total) }}</p>
            </div>
          </div>
        </div>
      </main>

      <footer class="border-t border-coffee-100 py-6 text-center">
        <p class="text-xs text-coffee-400">Kopi Kala Swara — dibuat untuk pengalaman meja yang lebih tenang.</p>
      </footer>
    </template>

    <!-- ============ CART DRAWER ============ -->
    <template v-if="currentUser === 'customer'">
      <div v-if="cartOpen" @click="cartOpen = false" class="fixed inset-0 bg-coffee-900/40 backdrop-blur-[2px] z-40"></div>
      <aside v-if="cartOpen" class="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-cream-50 z-50 shadow-lift flex flex-col animate-slidein">
        <div class="flex items-center justify-between px-5 py-4 border-b border-coffee-100">
          <h2 class="font-display text-xl text-coffee-900">Keranjang Pesanan</h2>
          <button @click="cartOpen = false" class="w-8 h-8 rounded-full hover:bg-coffee-100 flex items-center justify-center text-coffee-500">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
          <div v-if="cart.length === 0" class="text-center py-16">
            <i data-lucide="shopping-bag" class="w-8 h-8 text-coffee-300 mx-auto mb-3"></i>
            <p class="text-coffee-400 text-sm">Keranjang masih kosong.</p>
          </div>

          <div v-for="line in cart" :key="line.menuId + '-' + line.note" class="bg-white rounded-xl border border-coffee-100 p-4 mb-3">
            <div class="flex items-start justify-between mb-2">
              <p class="font-semibold text-coffee-900 text-sm pr-2">{{ line.name }}</p>
              <button @click="removeFromCart(line)" class="text-coffee-300 hover:text-red-500 shrink-0"><i data-lucide="trash-2" class="w-3.5 h-3.5" style="width:14px;height:14px"></i></button>
            </div>
            <p class="font-mono text-xs text-coffee-400 mb-3">{{ formatIDR(line.price) }}</p>

            <input v-model="line.note" type="text" placeholder="Catatan khusus (mis. less sugar, extra ice)"
              class="w-full text-xs bg-cream-100 border border-coffee-100 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-amber-400/40 placeholder:text-coffee-300" />

            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3 bg-cream-100 rounded-full px-1 py-1">
                <button @click="decQty(line)" class="w-6 h-6 rounded-full bg-white shadow-softer flex items-center justify-center text-coffee-700"><i data-lucide="minus" class="w-3 h-3" style="width:12px;height:12px"></i></button>
                <span class="text-sm font-bold text-coffee-900 w-4 text-center">{{ line.qty }}</span>
                <button @click="incQty(line)" class="w-6 h-6 rounded-full bg-white shadow-softer flex items-center justify-center text-coffee-700"><i data-lucide="plus" class="w-3 h-3" style="width:12px;height:12px"></i></button>
              </div>
              <p class="font-mono text-sm font-bold text-coffee-900">{{ formatIDR(line.price * line.qty) }}</p>
            </div>
          </div>
        </div>

        <div v-if="cart.length" class="border-t border-coffee-100 px-5 py-4 bg-white">
          <div class="flex items-center justify-between mb-4">
            <span class="text-sm text-coffee-500">Total Pesanan</span>
            <span class="font-display text-xl text-coffee-900">{{ formatIDR(cartTotal) }}</span>
          </div>
          <button @click="submitOrder" :disabled="isSyncing" class="w-full py-3 rounded-xl bg-coffee-800 text-cream-50 font-semibold hover:bg-amber-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
            <i :data-lucide="isSyncing ? 'loader-2' : 'send'" :class="['w-4 h-4', isSyncing && 'animate-spin']"></i>
            {{ isSyncing ? 'Mengirim...' : 'Buat Pesanan' }}
          </button>
        </div>
      </aside>
    </template>

  </div>
  `,
}).mount('#app');
