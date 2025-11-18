// server.js - COMPLETE FIXED VERSION
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

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Uploads directory created');
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
  return 'prod-' + Date.now().toString() + Math.round(Math.random() * 1000);
};

// ✅ FIXED: Get all products
app.get('/api/products', (req, res) => {
  try {
    console.log('📦 Fetching products, total:', products.length);
    
    // Add full image URL to each product
    const productsWithFullUrls = products.map(product => ({
      ...product,
      image: product.image.startsWith('http') ? product.image : 
             `http://localhost:${PORT}${product.image}`
    }));
    
    res.json({
      success: true,
      data: productsWithFullUrls,
      count: products.length
    });
  } catch (error) {
    console.error('❌ Error fetching products:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch products' 
    });
  }
});

// ✅ FIXED: Upload product - WITHOUT DESCRIPTION AND USAGE
app.post('/api/products', upload.single('image'), async (req, res) => {
  try {
    console.log('📨 Received product upload request');
    console.log('📝 Body data:', JSON.stringify(req.body, null, 2));
    console.log('🖼️ File received:', req.file);

    // Parse specifications if sent as JSON string
    let specifications = {};
    if (req.body.specifications) {
      try {
        specifications = typeof req.body.specifications === 'string' 
          ? JSON.parse(req.body.specifications) 
          : req.body.specifications;
      } catch (parseError) {
        console.log('⚠️ Could not parse specifications, using individual fields');
      }
    }

    // Use individual fields if specifications parsing failed
    if (Object.keys(specifications).length === 0) {
      specifications = {
        category: req.body.mainCategory || req.body.category || '',
        subCategory: req.body.subCategory || '',
        composition: req.body.composition || '',
        gsm: req.body.gsm || '',
        width: req.body.width || '',
        count: req.body.count || '',
        construction: req.body.construction || '',
        weave: req.body.weave || '',
        finish: req.body.finish || ''
        // ❌ USAGE REMOVED
      };
    }

    // Required fields validation
    if (!req.body.name) {
      return res.status(400).json({
        success: false,
        error: 'Product name is required'
      });
    }

    // Handle image URL
    let imageUrl = 'https://via.placeholder.com/300x300/4A5568/FFFFFF?text=Product+Image';
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
      console.log('🖼️ Image saved:', imageUrl);
    }

    // Create product object - WITHOUT DESCRIPTION AND USAGE
    const newProduct = {
      id: generateId(),
      name: req.body.name.trim(),
      price: req.body.price ? parseFloat(req.body.price) : 0,
      // ❌ DESCRIPTION REMOVED
      category: req.body.mainCategory || req.body.category || '',
      mainCategory: req.body.mainCategory || req.body.category || '',
      subCategory: req.body.subCategory || '',
      nestedCategory: req.body.nestedCategory || '',
      image: imageUrl,
      specifications: specifications,
      tags: req.body.tags ? 
        (typeof req.body.tags === 'string' ? 
          req.body.tags.split(',').map(tag => tag.trim()) : 
          req.body.tags) : 
        [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inStock: true
    };

    products.push(newProduct);
    
    console.log('✅ Product created successfully:', newProduct.id);
    console.log('📊 Total products now:', products.length);
    
    res.status(201).json({
      success: true,
      message: 'Product uploaded successfully',
      product: {
        ...newProduct,
        image: newProduct.image.startsWith('http') ? newProduct.image : 
               `http://localhost:${PORT}${newProduct.image}`
      }
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

// ✅ FIXED: Update product - WITHOUT DESCRIPTION AND USAGE
app.put('/api/products/:id', upload.single('image'), (req, res) => {
  try {
    const productId = req.params.id;
    console.log('🔄 Updating product:', productId);
    console.log('📝 Update data:', JSON.stringify(req.body, null, 2));

    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const existingProduct = products[productIndex];
    
    // Parse specifications if sent
    let specifications = existingProduct.specifications;
    if (req.body.specifications) {
      try {
        specifications = typeof req.body.specifications === 'string' 
          ? JSON.parse(req.body.specifications) 
          : req.body.specifications;
      } catch (parseError) {
        console.log('⚠️ Could not parse specifications in update');
      }
    } else {
      // Update individual specification fields WITHOUT USAGE
      specifications = {
        ...specifications,
        category: req.body.mainCategory || req.body.category || specifications.category,
        subCategory: req.body.subCategory || specifications.subCategory,
        composition: req.body.composition || specifications.composition,
        gsm: req.body.gsm || specifications.gsm,
        width: req.body.width || specifications.width,
        count: req.body.count || specifications.count,
        construction: req.body.construction || specifications.construction,
        weave: req.body.weave || specifications.weave,
        finish: req.body.finish || specifications.finish
        // ❌ USAGE REMOVED
      };
    }

    // Handle image - keep existing if no new image
    let imageUrl = existingProduct.image;
    if (req.file) {
      // Delete old image if exists and is local file
      if (existingProduct.image && 
          !existingProduct.image.startsWith('http') && 
          !existingProduct.image.startsWith('data:')) {
        const oldImagePath = path.join(__dirname, existingProduct.image);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
          console.log('🗑️ Old image deleted:', oldImagePath);
        }
      }
      imageUrl = `/uploads/${req.file.filename}`;
      console.log('🖼️ New image saved:', imageUrl);
    }

    // Update product WITHOUT DESCRIPTION
    const updatedProduct = {
      ...existingProduct,
      name: req.body.name || existingProduct.name,
      price: req.body.price ? parseFloat(req.body.price) : existingProduct.price,
      // ❌ DESCRIPTION REMOVED
      mainCategory: req.body.mainCategory || existingProduct.mainCategory,
      subCategory: req.body.subCategory || existingProduct.subCategory,
      nestedCategory: req.body.nestedCategory || existingProduct.nestedCategory,
      image: imageUrl,
      specifications: specifications,
      tags: req.body.tags ? 
        (typeof req.body.tags === 'string' ? 
          req.body.tags.split(',').map(tag => tag.trim()) : 
          req.body.tags) : 
        existingProduct.tags,
      updatedAt: new Date().toISOString()
    };

    products[productIndex] = updatedProduct;

    console.log('✅ Product updated successfully:', productId);

    res.json({
      success: true,
      message: 'Product updated successfully',
      product: {
        ...updatedProduct,
        image: updatedProduct.image.startsWith('http') ? updatedProduct.image : 
               `http://localhost:${PORT}${updatedProduct.image}`
      }
    });

  } catch (error) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product',
      message: error.message
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

    // Remove image file if it's a local file
    const product = products[productIndex];
    if (product.image && 
        !product.image.startsWith('http') && 
        !product.image.startsWith('data:')) {
      const imagePath = path.join(__dirname, product.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log('🗑️ Image file deleted:', imagePath);
      }
    }

    products.splice(productIndex, 1);
    
    console.log('✅ Product deleted successfully:', productId);
    console.log('📊 Total products now:', products.length);
    
    res.json({ 
      success: true,
      message: 'Product deleted successfully',
      deletedId: productId 
    });

  } catch (error) {
    console.error('❌ Error deleting product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete product',
      message: error.message
    });
  }
});

// ✅ Get single product
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

    // Add full image URL
    const productWithFullUrl = {
      ...product,
      image: product.image.startsWith('http') ? product.image : 
             `http://localhost:${PORT}${product.image}`
    };

    res.json({
      success: true,
      product: productWithFullUrl
    });

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch product'
    });
  }
});

// ✅ Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    timestamp: new Date().toISOString(),
    productsCount: products.length,
    uploadsDir: uploadsDir,
    message: 'Server is running correctly - DESCRIPTION & USAGE REMOVED'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('🚨 Server error:', error);
  
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

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'API endpoint not found'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
  console.log(`🖼️ Images URL: http://localhost:${PORT}/uploads`);
  console.log(`❌ DESCRIPTION & USAGE FIELDS REMOVED`);
  console.log(`✅ Backend ready for Admin Panel!`);
});