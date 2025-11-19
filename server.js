// server.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5173",
      "https://sssventures.in",
      "https://www.sssventures.in",
    ],
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static uploads
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log("📁 Uploads directory created");
}
app.use("/uploads", express.static(uploadsDir));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    const safeFilename = "product-" + uniqueSuffix + fileExtension;
    cb(null, safeFilename);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// In-memory products list
let products = [];

const generateId = () => {
  return "prod-" + Date.now().toString() + Math.round(Math.random() * 1000);
};

function getFullImageUrl(imagePath) {
  if (!imagePath) {
    return `https://via.placeholder.com/300x300/4A5568/FFFFFF?text=No+Image`;
  }
  if (imagePath.startsWith("http")) {
    return imagePath;
  }
  if (imagePath.startsWith("/uploads/")) {
    return `${process.env.BACKEND_URL || `http://localhost:${PORT}`}${imagePath}`;
  }
  return imagePath;
}

// ✅ Routes
app.get("/api/products", (req, res) => {
  try {
    console.log("📦 Fetching products, total:", products.length);
    const productsWithFullUrls = products.map((product) => ({
      ...product,
      image: getFullImageUrl(product.image),
    }));
    res.json({ success: true, data: productsWithFullUrls, count: products.length });
  } catch (error) {
    console.error("❌ Error fetching products:", error);
    res.status(500).json({ success: false, error: "Failed to fetch products" });
  }
});

app.post("/api/products", upload.single("image"), (req, res) => {
  try {
    console.log("📨 Received product upload request");
    if (!req.body.name) {
      return res.status(400).json({ success: false, error: "Product name is required" });
    }
    let imageUrl = "";
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
      console.log("🖼️ Image saved:", imageUrl);
    }
    const newProduct = {
      id: generateId(),
      name: (req.body.name || "").trim(),
      price: req.body.price ? parseFloat(req.body.price) : 0,
      category: req.body.category || "",
      mainCategory: req.body.mainCategory || "",
      subCategory: req.body.subCategory || "",
      image: imageUrl,
      specifications: {
        category: req.body.category || "",
        subCategory: req.body.subCategory || "",
        composition: req.body.composition || "",
        gsm: req.body.gsm || "",
        width: req.body.width || "",
        count: req.body.count || "",
        construction: req.body.construction || "",
        weave: req.body.weave || "",
        finish: req.body.finish || "",
      },
      tags: req.body.tags
        ? typeof req.body.tags === "string"
          ? req.body.tags.split(",").map((t) => t.trim())
          : req.body.tags
        : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      inStock: true,
    };
    products.push(newProduct);
    console.log("✅ Product created successfully:", newProduct.id);
    res.status(201).json({
      success: true,
      message: "Product uploaded successfully",
      product: {
        ...newProduct,
        image: getFullImageUrl(newProduct.image),
      },
    });
  } catch (error) {
    console.error("❌ Error uploading product:", error);
    res.status(500).json({ success: false, error: "Failed to upload product", message: error.message });
  }
});

app.put("/api/products/:id", upload.single("image"), (req, res) => {
  try {
    const id = req.params.id;
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }
    const existing = products[index];
    let newImage = existing.image;
    if (req.file) {
      if (existing.image && existing.image.startsWith("/uploads/")) {
        const oldPath = path.join(__dirname, existing.image);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
          console.log("🗑️ Old image deleted:", oldPath);
        }
      }
      newImage = `/uploads/${req.file.filename}`;
      console.log("🖼️ New image saved:", newImage);
    }
    const updatedProduct = {
      ...existing,
      name: req.body.name || existing.name,
      price: req.body.price ? parseFloat(req.body.price) : existing.price,
      category: req.body.category || existing.category,
      mainCategory: req.body.mainCategory || existing.mainCategory,
      subCategory: req.body.subCategory || existing.subCategory,
      image: newImage,
      specifications: {
        category: req.body.category || existing.specifications.category,
        subCategory: req.body.subCategory || existing.specifications.subCategory,
        composition: req.body.composition || existing.specifications.composition,
        gsm: req.body.gsm || existing.specifications.gsm,
        width: req.body.width || existing.specifications.width,
        count: req.body.count || existing.specifications.count,
        construction: req.body.construction || existing.specifications.construction,
        weave: req.body.weave || existing.specifications.weave,
        finish: req.body.finish || existing.specifications.finish,
      },
      tags: req.body.tags
        ? typeof req.body.tags === "string"
          ? req.body.tags.split(",").map((t) => t.trim())
          : req.body.tags
        : existing.tags,
      updatedAt: new Date().toISOString(),
    };
    products[index] = updatedProduct;
    console.log("✅ Product updated successfully:", id);
    res.json({ success: true, message: "Product updated successfully", product: { ...updatedProduct, image: getFullImageUrl(updatedProduct.image) } });
  } catch (error) {
    console.error("❌ Error updating product:", error);
    res.status(500).json({ success: false, error: "Failed to update product", message: error.message });
  }
});

app.delete("/api/products/:id", (req, res) => {
  try {
    const id = req.params.id;
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }
    const prod = products[index];
    if (prod.image && prod.image.startsWith("/uploads/")) {
      const imgPath = path.join(__dirname, prod.image);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
        console.log("🗑️ Image file deleted:", imgPath);
      }
    }
    products.splice(index, 1);
    console.log("✅ Product deleted successfully:", id);
    res.json({ success: true, message: "Product deleted successfully", deletedId: id });
  } catch (error) {
    console.error("❌ Error deleting product:", error);
    res.status(500).json({ success: false, error: "Failed to delete product", message: error.message });
  }
});

app.get("/api/products/:id", (req, res) => {
  try {
    const id = req.params.id;
    const product = products.find((p) => p.id === id);
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }
    res.json({ success: true, product: { ...product, image: getFullImageUrl(product.image) } });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ success: false, error: "Failed to fetch product" });
  }
});

// Test / health endpoints
app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "OK", timestamp: new Date().toISOString(), productsCount: products.length });
});
app.get("/api/test", (req, res) => {
  res.json({ success: true, message: "API test ok!" });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SSS Ventures API Server",
    endpoints: {
      health: "GET /api/health",
      getAllProducts: "GET /api/products",
      getProduct: "GET /api/products/:id",
      createProduct: "POST /api/products",
      updateProduct: "PUT /api/products/:id",
      deleteProduct: "DELETE /api/products/:id",
    },
    timestamp: new Date().toISOString(),
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error("🚨 Server error:", error);
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ success: false, error: "File too large", message: "File size must be less than 10MB" });
    }
  }
  res.status(500).json({ success: false, error: "Server error", message: error.message });
});

// 404 handler
app.use("*", (req, res) => {
  console.log("❌ 404 - Route not found:", req.originalUrl);
  res.status(404).json({
    success: false,
    error: "API endpoint not found",
    requestedUrl: req.originalUrl,
    availableEndpoints: [
      "GET /",
      "GET /api/health",
      "GET /api/test",
      "GET /api/products",
      "GET /api/products/:id",
      "POST /api/products",
      "PUT /api/products/:id",
      "DELETE /api/products/:id",
    ],
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
});
