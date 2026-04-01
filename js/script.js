// API and Image Configuration
const API_URL = "https://api.slphonehub.com/api";
const IMAGE_BASE_URL = "https://api.slphonehub.com";

let allProducts = [];
let currentCategory = 'All'; 

document.addEventListener('DOMContentLoaded', () => {
    const productGrid = document.getElementById('productGrid');
    const searchInput = document.getElementById('searchInput');
    const categoryButtons = document.querySelectorAll('.cat-filter');
   
    // Fetch products from your Ubuntu Server via Cloudflare Tunnel
    fetch(`${API_URL}/phones`)
      .then(response => response.json())
      .then(data => {
        allProducts = data.items || data; // Handle both {items: []} and []
        applyFilters();
      })
      .catch(err => console.error("Error fetching products:", err));

    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.innerText.replace(/[^a-zA-Z ]/g, "").trim();
            applyFilters();
        });
    });

    if(searchInput) searchInput.addEventListener('input', applyFilters);

    function applyFilters() {
        const term = searchInput ? searchInput.value.toLowerCase() : "";
        const filtered = allProducts.filter(p => {
            const matchesSearch = (p.name || "").toLowerCase().includes(term) || (p.brand || "").toLowerCase().includes(term);
            const matchesCategory = (currentCategory === 'All') || (p.category === currentCategory);
            return matchesSearch && matchesCategory;
        });
        render(filtered);
    }

    function render(data) {
        if(!productGrid) return;
        const fragment = document.createDocumentFragment();
        productGrid.innerHTML = data.length ? "" : "<p style='color:gray; text-align:center; grid-column:1/-1;'>No products found.</p>";
       
        data.forEach(p => {
            const stockColor = p.inStock ? '#10b981' : '#ef4444';
            const safeId = btoa(encodeURIComponent(p.id));
            const card = document.createElement('div');
            card.className = "card glass-panel";
            card.setAttribute("onclick", `viewProduct('${safeId}')`);

            // Corrected Image URL Logic
            const imageUrl = p.cover && p.cover.startsWith('/uploads/') 
                ? `${IMAGE_BASE_URL}${p.cover}` 
                : (p.cover || 'https://via.placeholder.com/300');
            
            card.innerHTML = `
                <div class="card-img-wrap">
                    <span class="status-tag" style="background: ${p.condition === 'Used' ? '#4b5563' : '#10b981'}; color:white;">${p.condition}</span>
                    <img src="${imageUrl}" loading="lazy" decoding="async" onerror="this.src='https://via.placeholder.com/300'">
                </div>
                <div class="card-details">
                    <p style="font-size: 0.75rem; color: #3b82f6; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">${p.brand}</p>
                    <h3>${p.name}</h3>
                    <div class="price-rating-group">
                        <span class="price-text">Rs. ${Number(p.price).toLocaleString()}</span>
                    </div>
                    <div class="card-meta">
                        <span>${p.storage}</span>
                        <span style="color: ${stockColor}; font-weight: bold;">${p.inStock ? 'In Stock' : 'Out of Stock'}</span>
                    </div>
                </div>
                <div class="card-footer"><button class="cart-btn">View Details</button></div>`;
            fragment.appendChild(card);
        });
        productGrid.appendChild(fragment);
    }
});

function viewProduct(encodedId) {
    const id = decodeURIComponent(atob(encodedId));
    const p = allProducts.find(item => item.id == id);
    if(!p) return;
    const overlay = document.createElement('div');
    overlay.id = "detailOverlay";
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); backdrop-filter:blur(12px); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; overflow-y:auto;";
    
    // Corrected Image URL Logic for Popup
    const imageUrl = p.cover && p.cover.startsWith('/uploads/') 
        ? `${IMAGE_BASE_URL}${p.cover}` 
        : (p.cover || 'https://via.placeholder.com/300');

    overlay.innerHTML = `
        <div class="glass-panel" style="max-width:1000px; width:100%; padding:40px; position:relative; display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:40px; color:white; background:#0a0a0a; border:1px solid rgba(255,255,255,0.1); border-radius:24px;">
            <button onclick="this.parentElement.parentElement.remove()" style="position:absolute; top:20px; right:20px; background:none; border:none; color:white; font-size:3rem; cursor:pointer;">&times;</button>
            <div>
                <img id="mainPopupImg" src="${imageUrl}" style="width:100%; aspect-ratio:1/1; object-fit:contain; border-radius:15px; background:#111;">
            </div>
            <div style="display:flex; flex-direction:column;">
                <p style="color:#3b82f6; font-weight:bold;">${p.brand} | ${p.condition}</p>
                <h2 style="font-size:2.8rem;">${p.name}</h2>
                <div style="font-size:2rem; color:#3b82f6; font-weight:bold; margin:15px 0;">Rs. ${Number(p.price).toLocaleString()}</div>
                <p style="color:#9ca3af;">${p.description || ''}</p>
                <button onclick="buy('${p.name}', '${p.price}')" style="width:100%; padding:22px; border-radius:15px; background:#3b82f6; color:white; font-weight:bold; cursor:pointer; margin-top:20px;">Order via WhatsApp</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

function buy(name, price) {
    window.open(`https://wa.me/94752500097?text=${encodeURIComponent(`Hi SL Phone Hub, I want to buy ${name} (Rs. ${Number(price).toLocaleString()}).`)}`);
}
