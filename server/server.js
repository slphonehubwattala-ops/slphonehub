const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'slphonehub-secret-key-change-in-production';

// Security middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'https://slphonehub.com', 'https://www.slphonehub.com'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit per file
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Database setup
const db = new sqlite3.Database('./slphonehub.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Initialize database tables
db.serialize(() => {
  // Products table
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    condition TEXT,
    price REAL NOT NULL,
    storage TEXT,
    stock INTEGER DEFAULT 1,
    description TEXT,
    specs TEXT,
    inStock BOOLEAN DEFAULT 1,
    featured BOOLEAN DEFAULT 0,
    cover TEXT,
    allImages TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Admin users table
  db.run(`CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create default admin user if not exists
  const defaultAdminId = 'admin-' + Date.now();
  const defaultEmail = 'admin@slphonehub.com';
  const defaultPassword = 'slphonehub123'; // Change this in production!
  
  db.get('SELECT id FROM admin_users WHERE email = ?', [defaultEmail], (err, row) => {
    if (!row) {
      bcrypt.hash(defaultPassword, 10, (err, hash) => {
        if (!err) {
          db.run('INSERT INTO admin_users (id, email, password) VALUES (?, ?, ?)', 
            [defaultAdminId, defaultEmail, hash]);
        }
      });
    }
  });
});

// Helper functions
function generateId() {
  return 'prod-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get all products with pagination and filtering
app.get('/api/phones', (req, res) => {
  const { category = 'all', limit = 50, offset = 0, search } = req.query;
  
  let query = 'SELECT * FROM products WHERE inStock = 1';
  let params = [];
  
  if (category !== 'all') {
    query += ' AND category = ?';
    params.push(category);
  }
  
  if (search) {
    query += ' AND (name LIKE ? OR brand LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  query += ' ORDER BY featured DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Parse allImages field
    const products = rows.map(product => ({
      ...product,
      allImages: product.allImages ? JSON.parse(product.allImages) : []
    }));
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM products WHERE inStock = 1';
    let countParams = [];
    
    if (category !== 'all') {
      countQuery += ' AND category = ?';
      countParams.push(category);
    }
    
    if (search) {
      countQuery += ' AND (name LIKE ? OR brand LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    db.get(countQuery, countParams, (err, countRow) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        total: countRow.total,
        items: products
      });
    });
  });
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  db.get('SELECT * FROM admin_users WHERE email = ?', [email], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({
      token,
      email: user.email
    });
  });
});

// Create product (admin only)
app.post('/api/phones', verifyToken, upload.array('images', 10), (req, res) => {
  try {
    const { name, brand, category, condition, price, storage, stock, description, specs, inStock, featured } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    
    const productId = generateId();
    
    // Handle images
    let cover = '';
    let allImages = [];
    
    if (req.files && req.files.length > 0) {
      allImages = req.files.map(file => `/uploads/${file.filename}`);
      cover = allImages[0];
    }
    
    // Handle base64 images from admin panel
    if (req.body.allImages) {
      try {
        const base64Images = JSON.parse(req.body.allImages);
        if (Array.isArray(base64Images) && base64Images.length > 0) {
          // For now, store base64 images. In production, save to disk
          allImages = base64Images;
          cover = base64Images[0];
        }
      } catch (e) {
        console.error('Error parsing base64 images:', e);
      }
    }
    
    const query = `INSERT INTO products (
      id, name, brand, category, condition, price, storage, stock, 
      description, specs, inStock, featured, cover, allImages
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
      productId, name, brand, category, condition, parseFloat(price), 
      storage, parseInt(stock) || 1, description, specs,
      inStock === 'true' || inStock === true,
      featured === 'true' || featured === true,
      cover, JSON.stringify(allImages)
    ];
    
    db.run(query, params, function(err) {
      if (err) {
        console.error('Error creating product:', err);
        return res.status(500).json({ error: 'Failed to create product' });
      }
      
      // Return created product
      db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
        if (err || !product) {
          return res.status(500).json({ error: 'Failed to retrieve created product' });
        }
        
        const responseProduct = {
          ...product,
          allImages: product.allImages ? JSON.parse(product.allImages) : []
        };
        
        res.status(201).json(responseProduct);
      });
    });
  } catch (error) {
    console.error('Error in product creation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update product (admin only)
app.put('/api/phones/:id', verifyToken, upload.array('images', 10), (req, res) => {
  const { id } = req.params;
  const { name, brand, category, condition, price, storage, stock, description, specs, inStock, featured } = req.body;
  
  // Check if product exists
  db.get('SELECT * FROM products WHERE id = ?', [id], (err, existingProduct) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    try {
      let cover = existingProduct.cover;
      let allImages = existingProduct.allImages ? JSON.parse(existingProduct.allImages) : [];
      
      // Handle new uploaded files
      if (req.files && req.files.length > 0) {
        const newImages = req.files.map(file => `/uploads/${file.filename}`);
        allImages = [...allImages, ...newImages];
        cover = newImages[0];
      }
      
      // Handle base64 images
      if (req.body.allImages) {
        try {
          const base64Images = JSON.parse(req.body.allImages);
          if (Array.isArray(base64Images) && base64Images.length > 0) {
            allImages = base64Images;
            cover = base64Images[0];
          }
        } catch (e) {
          console.error('Error parsing base64 images:', e);
        }
      }
      
      const query = `UPDATE products SET 
        name = ?, brand = ?, category = ?, condition = ?, price = ?, 
        storage = ?, stock = ?, description = ?, specs = ?, 
        inStock = ?, featured = ?, cover = ?, allImages = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`;
      
      const params = [
        name, brand, category, condition, parseFloat(price), 
        storage, parseInt(stock) || 1, description, specs,
        inStock === 'true' || inStock === true,
        featured === 'true' || featured === true,
        cover, JSON.stringify(allImages), id
      ];
      
      db.run(query, params, function(err) {
        if (err) {
          console.error('Error updating product:', err);
          return res.status(500).json({ error: 'Failed to update product' });
        }
        
        // Return updated product
        db.get('SELECT * FROM products WHERE id = ?', [id], (err, product) => {
          if (err || !product) {
            return res.status(500).json({ error: 'Failed to retrieve updated product' });
          }
          
          const responseProduct = {
            ...product,
            allImages: product.allImages ? JSON.parse(product.allImages) : []
          };
          
          res.json(responseProduct);
        });
      });
    } catch (error) {
      console.error('Error in product update:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

// Delete product (admin only)
app.delete('/api/phones/:id', verifyToken, (req, res) => {
  const { id } = req.params;
  
  db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete product' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json({ message: 'Product deleted successfully' });
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: 'File upload error: ' + error.message });
  }
  
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SL Phone Hub API running on http://localhost:${PORT}`);
  console.log(`📱 Admin credentials: admin@slphonehub.com / slphonehub123`);
  console.log(`🔗 API endpoints:`);
  console.log(`   GET  /api/phones - Get all products`);
  console.log(`   POST /api/admin/login - Admin login`);
  console.log(`   POST /api/phones - Create product (auth required)`);
  console.log(`   PUT  /api/phones/:id - Update product (auth required)`);
  console.log(`   DELETE /api/phones/:id - Delete product (auth required)`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('✅ Database connection closed.');
    }
    process.exit(0);
  });
});
