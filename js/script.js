// API and Image Configuration
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal ? "http://localhost:3000" : "https://api.slphonehub.com";
const API_URL = `${API_BASE_URL}/api`;

console.log("🚀 API Base URL:", API_BASE_URL);

let allProducts = [];
let activeCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Data Loading
    loadProducts();
    setInterval(loadProducts, 30000); // Auto-refresh every 30s

    // 2. Set up Event Listeners
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }

    // Set up category filters
    const categoryButtons = document.querySelectorAll('.cat-filter');
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.getAttribute('onclick') 
                ? btn.getAttribute('onclick').match(/'([^']+)'/)[1] 
                : btn.innerText.trim();
            
            // Handle both inline onclick and manual listeners
            activeCategory = cat === 'All' ? 'all' : cat;
            
            categoryButtons.forEach(b => {
                b.style.background = 'var(--glass)';
                b.classList.remove('active');
            });
            btn.style.background = 'var(--accent)';
            btn.classList.add('active');
            applyFilters();
        });
    });

    // Close modal on click outside
    window.onclick = function(event) {
        const modal = document.getElementById('productModal');
        if (event.target == modal) closePopup();
    }

    // Load Testimonials
    loadTestimonials();
});

async function loadProducts() {
    try {
        const res = await fetch(`${API_URL}/phones?category=all&limit=500&offset=0`);
        const data = await res.json();
        allProducts = data.items || data; // Handle both {items: []} and []
        
        // Load Trending Section
        renderTrending(allProducts.filter(p => p.category === 'Trending Products' || p.featured === true));
        
        // Populate Condition-based Sections
        renderSection('latestGrid', allProducts.slice(0, 8));
        
        const brandNew = allProducts.filter(p => p.condition === 'Brand New').slice(0, 8);
        renderSection('brandNewGrid', brandNew, 'brandNewSection');
        
        const refurbished = allProducts.filter(p => p.condition === 'Refurbished').slice(0, 8);
        renderSection('refurbishedGrid', refurbished, 'refurbishedSection');
        
        const used = allProducts.filter(p => p.condition === 'Used').slice(0, 8);
        renderSection('usedGrid', used, 'usedSection');

        applyFilters();
    } catch (e) {
        console.error("Failed to load products:", e);
        const grid = document.getElementById('productGrid');
        if (grid) grid.innerHTML = "<p style='color:gray; text-align:center; grid-column:1/-1;'>Could not load products. Please check your connection.</p>";
    }
}

function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const term = searchInput ? searchInput.value.toLowerCase() : "";
    
    const filtered = allProducts.filter(p => {
        const matchesSearch = (p.name || "").toLowerCase().includes(term) || (p.brand || "").toLowerCase().includes(term);
        const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
        return matchesSearch && matchesCategory;
    });
    renderProducts(filtered);
}

function getImageUrl(path) {
    if (!path) return 'https://via.placeholder.com/300';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    
    // Normalize path to ensure it starts with /uploads/
    let normalizedPath = path;
    if (!normalizedPath.startsWith('/')) normalizedPath = '/' + normalizedPath;
    
    if (normalizedPath.startsWith('/uploads/')) {
        return `${API_BASE_URL}${normalizedPath}`;
    }
    
    // Fallback for just filenames
    if (!normalizedPath.includes('/', 1)) {
        return `${API_BASE_URL}/uploads${normalizedPath}`;
    }
    
    return normalizedPath;
}

function renderProducts(products) {
    const grid = document.getElementById('productGrid');
    if(!grid) return;
    
    if (products.length === 0) {
        grid.innerHTML = "<p style='color:gray; text-align:center; grid-column:1/-1;'>No products currently available.</p>";
        return;
    }

    const fragment = document.createDocumentFragment();
    grid.innerHTML = "";

    products.forEach(p => {
        const card = document.createElement('div');
        card.className = "glass-panel product-card";
        card.onclick = () => showPopup(p);

        const imageUrl = getImageUrl(p.cover);
        const stockColor = p.inStock ? '#10b981' : '#ef4444';

        card.innerHTML = `
            <div class="product-card__media">
                <img class="product-card__img" src="${imageUrl}" loading="lazy" alt="${p.name}" onerror="this.src='https://via.placeholder.com/300'">
            </div>
            <div class="product-card__body">
                <span class="product-card__brand">${p.brand}</span>
                <h4 class="product-card__title">${p.name}</h4>
                <p class="product-card__specs">${p.storage} • ${p.condition}</p>
                <div class="product-card__price">Rs. ${Number(p.price).toLocaleString()}</div>
                <div style="font-size: 0.7rem; color: ${stockColor}; margin-top: 5px; font-weight: bold;">
                    ${p.inStock ? 'In Stock' : 'Out of Stock'}
                </div>
            </div>`;
        fragment.appendChild(card);
    });
    grid.appendChild(fragment);
}

function renderSection(gridId, products, sectionId = null) {
    const grid = document.getElementById(gridId);
    const section = sectionId ? document.getElementById(sectionId) : null;
    if (!grid) return;

    if (products.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }

    if (section) section.style.display = 'block';

    grid.innerHTML = products.map(p => {
        const imageUrl = getImageUrl(p.cover);
        const stockColor = p.inStock ? '#10b981' : '#ef4444';
        const pData = JSON.stringify(p).replace(/'/g, "\\'");
        return `
        <div class="glass-panel product-card" onclick='showPopup(${pData})'>
            <div class="product-card__media">
                <img class="product-card__img" src="${imageUrl}" loading="lazy" alt="${p.name}" onerror="this.src='https://via.placeholder.com/300'">
            </div>
            <div class="product-card__body">
                <span class="product-card__brand">${p.brand}</span>
                <h4 class="product-card__title">${p.name}</h4>
                <p class="product-card__specs">${p.storage} • ${p.condition}</p>
                <div class="product-card__price">Rs. ${Number(p.price).toLocaleString()}</div>
                <div style="font-size: 0.7rem; color: ${stockColor}; margin-top: 5px; font-weight: bold;">
                    ${p.inStock ? 'In Stock' : 'Out of Stock'}
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderTrending(products) {
    const section = document.getElementById('trending');
    const track = document.getElementById('trendingTrack');
    if (!section || !track) return;

    if (products.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    
    // Duplicate products for infinite scroll effect (similar to reviews)
    const displayProducts = products.length < 5 ? [...products, ...products, ...products] : [...products, ...products];
    
    track.innerHTML = displayProducts.map(p => {
        const imageUrl = getImageUrl(p.cover);
        return `
            <div class="trending-card" onclick='showPopup(${JSON.stringify(p).replace(/'/g, "\\'")})'>
                <div class="trending-badge">HOT</div>
                <div class="trending-img-wrap">
                    <img class="trending-img" src="${imageUrl}" loading="lazy" alt="${p.name}" onerror="this.src='https://via.placeholder.com/300'">
                </div>
                <div class="trending-body">
                    <span style="color:var(--accent); font-size:0.65rem; font-weight:700; text-transform:uppercase;">${p.brand}</span>
                    <h4 style="margin: 5px 0; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: white;">${p.name}</h4>
                    <div style="font-weight: 700; color: white; font-size: 1rem;">Rs. ${Number(p.price).toLocaleString()}</div>
                </div>
            </div>`;
    }).join('');
}

function showPopup(p) {
    const modal = document.getElementById('productModal');
    if (!modal) return;

    const mainImg = document.getElementById('modalMainImg');
    const galleryDiv = document.getElementById('modalGallery');
    
    const coverUrl = getImageUrl(p.cover);
    mainImg.src = coverUrl;
    galleryDiv.innerHTML = ""; 
    
    // Add cover to gallery
    const thumbCover = document.createElement('img');
    thumbCover.src = coverUrl;
    thumbCover.className = 'thumb-img';
    thumbCover.onclick = () => { mainImg.src = coverUrl; };
    galleryDiv.appendChild(thumbCover);

    // Add other images
    if (p.allImages) {
        let images = [];
        try {
            images = typeof p.allImages === 'string' ? JSON.parse(p.allImages) : p.allImages;
        } catch (e) {
            images = [];
        }

        if (Array.isArray(images)) {
            images.forEach(imgUrl => {
                const fullUrl = getImageUrl(imgUrl);
                if (fullUrl === coverUrl) return; // Skip if it's the cover
                const thumb = document.createElement('img');
                thumb.src = fullUrl;
                thumb.className = 'thumb-img';
                thumb.onclick = () => { mainImg.src = fullUrl; };
                galleryDiv.appendChild(thumb);
            });
        }
    }

    document.getElementById('modalBrand').innerText = p.brand;
    document.getElementById('modalName').innerText = p.name;
    document.getElementById('modalPrice').innerText = "Rs. " + Number(p.price).toLocaleString();
    document.getElementById('modalCondition').innerText = p.condition;
    document.getElementById('modalStorage').innerText = p.storage;
    document.getElementById('modalDesc').innerText = p.description || "Premium device certified by SL Phone Hub.";
    document.getElementById('modalSpecs').innerText = p.specs || "Contact us for detailed specifications.";
    
    const msg = `Hi SL Phone Hub! 👋 \n\nI'm interested in the ${p.name} (Rs. ${Number(p.price).toLocaleString()}). \n\nIs it still available?`;
    document.getElementById('modalWA').href = `https://wa.me/94752500097?text=${encodeURIComponent(msg)}`;
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closePopup() {
    const modal = document.getElementById('productModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function loadTestimonials() {
    const reviewData = [
        { name: "Sahan P.", text: "Very friendly and reliable service! 🙌 I even got a rare phone I couldn't find anywhere else. Highly recommended! ⭐⭐⭐⭐⭐", style: "style-dark" },
        { name: "Dilshan R.", text: "Received my phone within 20 minutes! ⚡ Super fast delivery and exactly as described! Best in SL! 🇱🇰", style: "style-light" },
        { name: "Inshaf A.", text: "Trusted seller. 🤝 Paid via bank deposit and received the phone quickly. Excellent communication throughout! 📱", style: "style-accent" },
        { name: "Kamal W.", text: "Staff helped me choose the perfect phone without any pressure. 💡 Very knowledgeable and friendly guys! 🔥", style: "style-dark" },
        { name: "Nimal S.", text: "Great customer service and prices are more reasonable than other shops. 💸 Quality is 100% genuine! ✅", style: "style-light" },
        { name: "Ashan M.", text: "Amazing collection of classic phones! 💎 Genuine products and well maintained. A hidden gem! 🏆", style: "style-accent" }
    ];

    const track = document.getElementById('reviewTrack');
    if(track) {
        // Duplicate reviews for seamless infinite scrolling
        track.innerHTML = [...reviewData, ...reviewData].map(r => `
            <div class="review-card ${r.style}">
                <i class="fas fa-quote-right quote-icon"></i>
                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&background=random&color=fff" class="user-img" alt="${r.name}" loading="lazy">
                <div class="review-stars">
                    <i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i>
                </div>
                <p class="review-text">"${r.text}"</p>
                <h4 style="margin: 10px 0 5px 0; color: white;">${r.name}</h4>
            </div>`).join('');
    }
}