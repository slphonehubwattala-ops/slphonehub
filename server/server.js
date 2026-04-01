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
app.set('trust proxy', 1); // Trust Cloudflare proxy
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'slphonehub-secret-key-change-in-production';

// Security middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'https://slphonehub.com', 'https://www.slphonehub.com', 'https://slphonehub.github.io'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
  // Uncomment the line below if you want to completely reset the database
  // db.run('DROP TABLE IF EXISTS products');
  
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
    inStock INTEGER DEFAULT 1,
    featured INTEGER DEFAULT 0,
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

// Emergency Reset Route (Careful!)
app.get('/api/admin/reset-db', verifyToken, (req, res) => {
  db.serialize(() => {
    db.run('DROP TABLE IF EXISTS products', (err) => {
      if (err) return res.status(500).json({ error: 'Failed to drop table' });
      
      db.run(`CREATE TABLE products (
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
        inStock INTEGER DEFAULT 1,
        featured INTEGER DEFAULT 0,
        cover TEXT,
        allImages TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) return res.status(500).json({ error: 'Failed to recreate table' });
        res.json({ message: 'Database reset successful. Products table recreated.' });
      });
    });
  });
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
    const { 
      name, brand, category, condition, price, storage, stock, 
      description, specs, inStock, featured 
    } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ error: 'Name and price are required' });
    }
    
    const productId = generateId();
    
    // Handle images
    let cover = '';
    let allImages = [];
    
    // Check if files were uploaded via multer (multipart/form-data)
    if (req.files && req.files.length > 0) {
      allImages = req.files.map(file => `/uploads/${file.filename}`);
      cover = allImages[0];
    }
    
    // Handle JSON body images (application/json)
    if (req.body.allImages) {
      try {
        const imageArray = Array.isArray(req.body.allImages) 
          ? req.body.allImages 
          : JSON.parse(req.body.allImages);
          
        if (Array.isArray(imageArray) && imageArray.length > 0) {
          allImages = imageArray;
          cover = req.body.cover || allImages[0];
        }
      } catch (e) {
        console.error('Error processing images from body:', e.message);
        if (typeof req.body.allImages === 'string' && req.body.allImages.startsWith('data:image')) {
            allImages = [req.body.allImages];
            cover = allImages[0];
        }
      }
    }
    
    const query = `INSERT INTO products (
      id, name, brand, category, condition, price, storage, stock, 
      description, specs, inStock, featured, cover, allImages
    ) VALUES ($id, $name, $brand, $category, $condition, $price, $storage, $stock, 
      $description, $specs, $inStock, $featured, $cover, $allImages)`;
    
    const params = {
      $id: productId,
      $name: name || '',
      $brand: brand || '',
      $category: category || '',
      $condition: condition || '',
      $price: parseFloat(price) || 0,
      $storage: storage || '',
      $stock: parseInt(stock) || 1,
      $description: description || '',
      $specs: specs || '',
      $inStock: (inStock === 'true' || inStock === true) ? 1 : 0,
      $featured: (featured === 'true' || featured === true) ? 1 : 0,
      $cover: cover || '',
      $allImages: JSON.stringify(allImages)
    };
    
    db.run(query, params, function(err) {
      if (err) {
        console.error('DATABASE INSERT ERROR:', err.message);
        console.error('Full Error Details:', err);
        return res.status(500).json({ error: `Database error: ${err.message}` });
      }
      console.log('Product created successfully, ID:', productId);
      
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
    console.error('SERVER POST ERROR:', error);
    res.status(500).json({ error: `Server error: ${error.message}` });
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
      
      // Handle new uploaded files (multipart/form-data)
      if (req.files && req.files.length > 0) {
        const newImages = req.files.map(file => `/uploads/${file.filename}`);
        allImages = [...allImages, ...newImages];
        cover = newImages[0];
      }
      
      // Handle JSON body images (application/json)
      if (req.body.allImages) {
        try {
          const imageArray = Array.isArray(req.body.allImages) 
            ? req.body.allImages 
            : JSON.parse(req.body.allImages);
            
          if (Array.isArray(imageArray) && imageArray.length > 0) {
            allImages = imageArray;
            cover = req.body.cover || allImages[0];
          }
        } catch (e) {
          console.error('Error processing images from body (PUT):', e.message);
          if (typeof req.body.allImages === 'string' && req.body.allImages.startsWith('data:image')) {
              allImages = [req.body.allImages];
              cover = allImages[0];
          }
        }
      }
      
      const query = `UPDATE products SET 
        name = $name, brand = $brand, category = $category, condition = $condition, price = $price, 
        storage = $storage, stock = $stock, description = $description, specs = $specs, 
        inStock = $inStock, featured = $featured, cover = $cover, allImages = $allImages,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $id`;
      
      const params = {
        $name: name || '',
        $brand: brand || '',
        $category: category || '',
        $condition: condition || '',
        $price: parseFloat(price) || 0,
        $storage: storage || '',
        $stock: parseInt(stock) || 1,
        $description: description || '',
        $specs: specs || '',
        $inStock: (inStock === 'true' || inStock === true) ? 1 : 0,
        $featured: (featured === 'true' || featured === true) ? 1 : 0,
        $cover: cover || '',
        $allImages: JSON.stringify(allImages),
        $id: id
      };
      
      db.run(query, params, function(err) {
        if (err) {
          console.error('Error updating product:', err);
          return res.status(500).json({ error: 'Failed to update product: ' + err.message });
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
