const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded images statically - FIX PATH
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Uploads directory created');
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const safeFilename = 'product-' + uniqueSuffix + fileExtension;
    cb(null, safeFilename);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Products storage
let products = [];

// Generate ID
const generateId = () => {
  return 'prod-' + Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

// ✅ FIXED: Get all products
app.get('/api/products', (req, res) => {
  try {
    console.log('📦 Fetching products, total:', products.length);
    res.json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch products' 
    });
  }
});

// ✅ FIXED: Upload product - COMPATIBLE WITH ADMINPANEL
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    console.log('📨 Received product data:', req.body);
    console.log('🖼️ File received:', req.file);

    // Parse form data - AdminPanel sends all fields in body
    const {
      name,
      price,
      description = '',
      mainCategory,
      subCategory,
      nestedCategory = '',
      composition = '',
      gsm = '',
      width = '',
      count = '',
      construction = '',
      weave = '',
      finish = '',
      usage = '',
      tags = ''
    } = req.body;

    // Validation
    if (!name || !price || !mainCategory) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, price, mainCategory'
      });
    }

    // Handle image URL
    let imageUrl = 'https://via.placeholder.com/300x300/4A5568/FFFFFF?text=Product+Image';
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
      console.log('🖼️ Image saved:', imageUrl);
    }

    // Create product object - MATCHING ADMINPANEL STRUCTURE
    const newProduct = {
      id: generateId(),
      name: name.trim(),
      price: parseFloat(price),
      description: description.trim(),
      category: mainCategory, // For backward compatibility
      mainCategory: mainCategory.trim(),
      subCategory: subCategory ? subCategory.trim() : '',
      nestedCategory: nestedCategory ? nestedCategory.trim() : '',
      image: imageUrl,
      specifications: {
        category: mainCategory.trim(),
        subCategory: subCategory ? subCategory.trim() : '',
        composition: composition.trim(),
        gsm: gsm.trim(),
        width: width.trim(),
        count: count.trim(),
        construction: construction.trim(),
        weave: weave.trim(),
        finish: finish.trim(),
        usage: usage.trim()
      },
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inStock: true
    };

    products.push(newProduct);
    
    console.log('✅ Product created:', newProduct.id);
    
    res.status(201).json({
      success: true,
      message: 'Product uploaded successfully',
      product: newProduct
    });

  } catch (error) {
    console.error('❌ Error uploading product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to upload product',
      message: error.message 
    });
  }
});

// ✅ FIXED: Update product
app.put('/api/products/:id', upload.single('image'), (req, res) => {
  try {
    const productId = req.params.id;
    console.log('🔄 Updating product:', productId);

    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const existingProduct = products[productIndex];
    const {
      name,
      price,
      description,
      mainCategory,
      subCategory,
      nestedCategory,
      composition,
      gsm,
      width,
      count,
      construction,
      weave,
      finish,
      usage,
      tags
    } = req.body;

    // Handle image - keep existing if no new image
    let imageUrl = existingProduct.image;
    if (req.file) {
      // Delete old image if exists
      if (existingProduct.image && !existingProduct.image.startsWith('http')) {
        const oldImagePath = path.join(__dirname, existingProduct.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      imageUrl = `/uploads/${req.file.filename}`;
    }

    // Update product
    const updatedProduct = {
      ...existingProduct,
      name: name || existingProduct.name,
      price: price ? parseFloat(price) : existingProduct.price,
      description: description || existingProduct.description,
      mainCategory: mainCategory || existingProduct.mainCategory,
      subCategory: subCategory || existingProduct.subCategory,
      nestedCategory: nestedCategory || existingProduct.nestedCategory,
      image: imageUrl,
      specifications: {
        ...existingProduct.specifications,
        category: mainCategory || existingProduct.mainCategory,
        subCategory: subCategory || existingProduct.subCategory,
        composition: composition || existingProduct.specifications?.composition,
        gsm: gsm || existingProduct.specifications?.gsm,
        width: width || existingProduct.specifications?.width,
        count: count || existingProduct.specifications?.count,
        construction: construction || existingProduct.specifications?.construction,
        weave: weave || existingProduct.specifications?.weave,
        finish: finish || existingProduct.specifications?.finish,
        usage: usage || existingProduct.specifications?.usage
      },
      tags: tags ? tags.split(',').map(tag => tag.trim()) : existingProduct.tags,
      updatedAt: new Date().toISOString()
    };

    products[productIndex] = updatedProduct;

    res.json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product'
    });
  }
});

// ✅ FIXED: Delete product
app.delete('/api/products/:id', (req, res) => {
  try {
    const productId = req.params.id;
    console.log('🗑️ Deleting product:', productId);
    
    const productIndex = products.findIndex(p => p.id === productId);
    
    if (productIndex === -1) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found'
      });
    }

    // Remove image file
    const product = products[productIndex];
    if (product.image && !product.image.startsWith('http')) {
      const imagePath = path.join(__dirname, product.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log('🗑️ Image file deleted:', imagePath);
      }
    }

    products.splice(productIndex, 1);
    
    res.json({ 
      success: true,
      message: 'Product deleted successfully',
      deletedId: productId 
    });

  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete product'
    });
  }
});

// ✅ NEW: Get single product
app.get('/api/products/:id', (req, res) => {
  try {
    const productId = req.params.id;
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      product: product
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    timestamp: new Date().toISOString(),
    productsCount: products.length,
    uploadsDir: uploadsDir
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        success: false,
        error: 'File too large',
        message: 'File size must be less than 10MB' 
      });
    }
  }
  
  res.status(500).json({ 
    success: false,
    error: 'Server error',
    message: error.message 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
  console.log(`🖼️ Images URL: http://localhost:${PORT}/uploads`);
  console.log(`✅ Backend ready for Admin Panel!`);
});