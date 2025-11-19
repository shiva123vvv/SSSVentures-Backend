// server.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// -----------------------------
// JSON PERSISTENCE STORAGE
// -----------------------------
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "products.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

let products = [];

if (fs.existsSync(DATA_FILE)) {
  try {
    products = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    console.log(`📦 Loaded ${products.length} products from JSON file`);
  } catch (err) {
    console.error("❌ Failed to read products.json:", err);
    products = [];
  }
}

const saveProductsToFile = () => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
  console.log("💾 Products saved to products.json");
};

// -----------------------------
// Middleware
// -----------------------------
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

// -----------------------------
// Static Uploads Folder
// -----------------------------
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

app.use("/uploads", express.static(uploadsDir));

// -----------------------------
// Multer config
// -----------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "product-" + unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/"))
      return cb(new Error("Only images allowed"));
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// -----------------------------
// Helpers
// -----------------------------
const generateId = () =>
  "prod-" + Date.now() + "-" + Math.floor(Math.random() * 10000);

const getFullImageUrl = (imagePath) => {
  if (!imagePath) return "";

  if (imagePath.startsWith("http")) return imagePath;

  return `${process.env.BACKEND_URL || "https://sssventures-backend.onrender.com"}${imagePath}`;
};

// -----------------------------
// ROUTES
// -----------------------------

// GET all products
app.get("/api/products", (req, res) => {
  const final = products.map((p) => ({
    ...p,
    image: getFullImageUrl(p.image),
  }));
  res.json({ success: true, data: final });
});

// CREATE product
app.post("/api/products", upload.single("image"), (req, res) => {
  try {
    const newProduct = {
      id: generateId(),
      name: req.body.name || "",
      price: req.body.price || 0,
      category: req.body.category || "",
      mainCategory: req.body.mainCategory || "",
      subCategory: req.body.subCategory || "",
      image: req.file ? `/uploads/${req.file.filename}` : "",
      specifications: req.body.specifications
        ? JSON.parse(req.body.specifications)
        : {},
      tags: req.body.tags ? req.body.tags.split(",") : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    products.push(newProduct);
    saveProductsToFile();

    res.json({
      success: true,
      message: "Product created",
      product: {
        ...newProduct,
        image: getFullImageUrl(newProduct.image),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE product
app.put("/api/products/:id", upload.single("image"), (req, res) => {
  const id = req.params.id;
  const index = products.findIndex((p) => p.id === id);

  if (index === -1)
    return res.status(404).json({ success: false, error: "Product not found" });

  let prod = products[index];

  if (req.file) {
    if (prod.image && prod.image.startsWith("/uploads/")) {
      const old = path.join(__dirname, prod.image);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    prod.image = `/uploads/${req.file.filename}`;
  }

  prod = {
    ...prod,
    ...req.body,
    specifications: req.body.specifications
      ? JSON.parse(req.body.specifications)
      : prod.specifications,
    tags: req.body.tags ? req.body.tags.split(",") : prod.tags,
    updatedAt: new Date().toISOString(),
  };

  products[index] = prod;
  saveProductsToFile();

  res.json({
    success: true,
    product: { ...prod, image: getFullImageUrl(prod.image) },
  });
});

// DELETE product
app.delete("/api/products/:id", (req, res) => {
  const id = req.params.id;
  const index = products.findIndex((p) => p.id === id);

  if (index === -1)
    return res.status(404).json({ success: false, error: "Product not found" });

  const prod = products[index];

  if (prod.image && prod.image.startsWith("/uploads/")) {
    const img = path.join(__dirname, prod.image);
    if (fs.existsSync(img)) fs.unlinkSync(img);
  }

  products.splice(index, 1);
  saveProductsToFile();

  res.json({ success: true, deletedId: id });
});

// GET product by id
app.get("/api/products/:id", (req, res) => {
  const prod = products.find((p) => p.id === req.params.id);

  if (!prod)
    return res.status(404).json({ success: false, error: "Not found" });

  res.json({
    success: true,
    product: { ...prod, image: getFullImageUrl(prod.image) },
  });
});

// Health checks
app.get("/api/health", (req, res) =>
  res.json({
    success: true,
    status: "OK",
    productsCount: products.length,
    timestamp: new Date(),
  })
);

app.get("/api/test", (req, res) =>
  res.json({ success: true, message: "API test ok!" })
);

// Root
app.get("/", (req, res) =>
  res.json({ success: true, message: "SSS Ventures API running" })
);

// 404 handler
app.use("*", (req, res) =>
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
  })
);

app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
