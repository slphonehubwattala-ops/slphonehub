// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyC3z8u0t1NIq90SUQG3U4Dhbh03HgE4zv8",
  authDomain: "slphonehub-61c52.firebaseapp.com",
  projectId: "slphonehub-61c52",
  storageBucket: "slphonehub-61c52.firebasestorage.app",
  messagingSenderId: "222686417598",
  appId: "1:222686417598:web:357de494c2c2f3370e44ef",
  measurementId: "G-213HGB2JZ5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global variable to hold cloud data for searching
let allProducts = [];

document.addEventListener('DOMContentLoaded', () => {
    const productGrid = document.getElementById('productGrid');
    const searchInput = document.getElementById('searchInput');
    
    // 1. REAL-TIME CLOUD DATA LOAD (PHONES)
    db.collection("phones").onSnapshot((snapshot) => {
        allProducts = [];
        snapshot.forEach((doc) => {
            allProducts.push({ id: doc.id, ...doc.data() });
        });
        render(allProducts);
    });

    function render(data) {
        if(!productGrid) return;
        productGrid.innerHTML = data.length ? "" : "<p style='color:gray; text-align:center; grid-column:1/-1;'>No products found.</p>";
        
        data.forEach(p => {
            const stockColor = p.inStock ? '#10b981' : '#ef4444';
            const safeId = btoa(encodeURIComponent(p.id));

            productGrid.innerHTML += `
                <div class="card glass-panel" onclick="viewProduct('${safeId}')">
                    <div class="card-img-wrap">
                        <span class="status-tag" style="background: ${p.condition === 'Used' ? '#4b5563' : '#10b981'}; color:white;">
                            ${p.condition}
                        </span>
                        <img src="${p.cover}" onerror="this.src='https://via.placeholder.com/300'">
                    </div>
                    <div class="card-details">
                        <p style="font-size: 0.75rem; color: #3b82f6; text-transform: uppercase; font-weight: bold; margin-bottom: 5px;">${p.brand}</p>
                        <h3>${p.name}</h3>
                        <p style="font-size: 0.85rem; color: #9ca3af; margin: 5px 0;">${p.description || ''}</p>
                        <div class="price-rating-group">
                            <span class="price-text">Rs. ${Number(p.price).toLocaleString()}</span>
                        </div>
                        <div class="card-meta">
                            <span>${p.storage}</span>
                            <span style="color: ${stockColor}; font-weight: bold;">${p.inStock ? 'In Stock' : 'Out of Stock'}</span>
                        </div>
                    </div>
                    <div class="card-footer">
                        <button class="cart-btn">View Details</button>
                    </div>
                </div>`;
        });
    }

    // 2. LIVE SEARCH LOGIC
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allProducts.filter(p => 
                p.name.toLowerCase().includes(term) || 
                p.brand.toLowerCase().includes(term)
            );
            render(filtered);
        });
    }

    // 3. REAL-TIME CLOUD REVIEWS LOAD
    const track = document.getElementById('reviewTrack');
    if(track) {
        db.collection("reviews").onSnapshot((snapshot) => {
            const cloudReviews = [];
            snapshot.forEach((doc) => {
                cloudReviews.push(doc.data());
            });

            if(cloudReviews.length === 0) {
                track.innerHTML = "<p style='color:gray; padding:20px;'>No reviews available yet.</p>";
                return;
            }

            track.innerHTML = cloudReviews.map(r => `
                <div class="review-card glass-panel" style="min-width:300px; margin-right:20px;">
                    <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
                        ${r.photo ? `<img src="${r.photo}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">` : ''}
                        <div>
                            <h5 style="color:white; margin:0;">${r.name}</h5>
                            <div style="color:#f59e0b;">${'★'.repeat(r.stars || 5)}</div>
                        </div>
                    </div>
                    <p style="font-style:italic; color:#9ca3af; margin:0;">"${r.review || r.text || ''}"</p>
                </div>
            `).join('');

            // Slider Logic
            let index = 0;
            if(cloudReviews.length > 1) {
                clearInterval(window.reviewInterval);
                window.reviewInterval = setInterval(() => {
                    index = (index + 1) % cloudReviews.length;
                    track.style.transform = `translateX(-${index * 320}px)`;
                }, 4000);
            }
        });
    }
});

// POPUP VIEW
function viewProduct(encodedId) {
    const id = decodeURIComponent(atob(encodedId));
    const p = allProducts.find(item => item.id == id);
    if(!p) return;

    const overlay = document.createElement('div');
    overlay.id = "detailOverlay";
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); backdrop-filter:blur(12px); z-index:10000; display:flex; align-items:center; justify-content:center; padding:20px; overflow-y:auto;";
    
    overlay.innerHTML = `
        <div class="glass-panel" style="max-width:1000px; width:100%; padding:40px; position:relative; display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:40px; color:white; background:#0a0a0a; border:1px solid rgba(255,255,255,0.1); border-radius:24px;">
            <button onclick="this.parentElement.parentElement.remove()" style="position:absolute; top:20px; right:20px; background:none; border:none; color:white; font-size:3rem; cursor:pointer;">&times;</button>
            
            <div>
                <img id="mainPopupImg" src="${p.cover}" style="width:100%; aspect-ratio: 1/1; object-fit: contain; border-radius:15px; background: #111; border:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex; gap:10px; margin-top:15px; overflow-x:auto; padding-bottom:10px;">
                    ${p.allImages ? p.allImages.map(img => `
                        <img src="${img}" style="width:70px; height:70px; object-fit:cover; border-radius:8px; border:1px solid rgba(255,255,255,0.1); cursor:pointer; flex-shrink:0;" 
                        onclick="document.getElementById('mainPopupImg').src='${img}'">
                    `).join('') : ''}
                </div>
            </div>

            <div style="display:flex; flex-direction:column;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <p style="color:#3b82f6; font-weight:bold; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:5px;">${p.brand} | ${p.condition}</p>
                        <h2 style="font-size:2.8rem; margin-bottom:10px; line-height:1.1;">${p.name}</h2>
                    </div>
                    <div style="text-align:right;">
                         <span style="background:${p.inStock ? '#10b98122' : '#ef444422'}; color:${p.inStock ? '#10b981' : '#ef4444'}; padding:5px 12px; border-radius:20px; font-size:0.8rem; font-weight:bold; border:1px solid ${p.inStock ? '#10b981' : '#ef4444'};">
                            ${p.inStock ? 'AVAILABLE' : 'OUT OF STOCK'}
                         </span>
                    </div>
                </div>

                <div style="font-size:2rem; color:#3b82f6; font-weight:bold; margin: 15px 0;">Rs. ${Number(p.price).toLocaleString()}</div>
                
                <p style="color:#9ca3af; font-size:1.1rem; line-height:1.6; margin-bottom:25px; border-left: 3px solid #3b82f6; padding-left: 15px;">
                    ${p.description || 'No description available.'}
                </p>
                
                <div style="background:rgba(255,255,255,0.03); padding:25px; border-radius:18px; border:1px solid rgba(255,255,255,0.05); margin-bottom:30px;">
                    <h4 style="margin-bottom:15px; color:#3b82f6; text-transform:uppercase; font-size:0.9rem; letter-spacing:1px;">Product Specifications</h4>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:15px;">
                        <div><small style="color:#666; font-size:0.75rem;">STORAGE</small><br><strong>${p.storage}</strong></div>
                        <div><small style="color:#666; font-size:0.75rem;">CATEGORY</small><br><strong>${p.category}</strong></div>
                    </div>
                    
                    <div style="margin-top: 10px;">
                        <small style="color:#666; font-size:0.75rem; text-transform:uppercase;">Technical Details</small>
                        <p style="font-size:1rem; white-space:pre-line; color:#d1d5db; line-height:1.7; margin-top:5px;">${p.specs}</p>
                    </div>
                </div>

                <button onclick="buy('${p.name}', '${p.price}')" style="width:100%; padding:22px; border-radius:15px; border:none; background:#3b82f6; color:white; font-size:1.2rem; font-weight:bold; cursor:pointer; transition:0.3s; box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);">
                    Order via WhatsApp
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function buy(name, price) {
    const phoneNumber = "94752500097"; 
    const message = `Hi SL Phone Hub, I want to buy the ${name} (Rs. ${Number(price).toLocaleString()}). Is it still available?`;
    window.open(`https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`);
}