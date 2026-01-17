// MongoDB Sample Data for dbfordevs
// This script creates sample databases, collections, and documents

// Switch to testdb database
db = db.getSiblingDB('testdb');

// ============================================
// USERS COLLECTION
// ============================================
db.users.insertMany([
  {
    _id: ObjectId("507f1f77bcf86cd799439011"),
    username: "johndoe",
    email: "john@example.com",
    profile: {
      firstName: "John",
      lastName: "Doe",
      avatar: "https://api.example.com/avatars/1.jpg",
      bio: "Software developer and MongoDB enthusiast",
      location: "San Francisco, CA"
    },
    settings: {
      theme: "dark",
      notifications: true,
      language: "en"
    },
    roles: ["user", "admin"],
    createdAt: new Date("2024-01-15T10:30:00Z"),
    lastLogin: new Date("2024-06-20T14:22:15Z"),
    isActive: true
  },
  {
    _id: ObjectId("507f1f77bcf86cd799439012"),
    username: "janesmith",
    email: "jane@example.com",
    profile: {
      firstName: "Jane",
      lastName: "Smith",
      avatar: "https://api.example.com/avatars/2.jpg",
      bio: "Product manager and data analyst",
      location: "New York, NY"
    },
    settings: {
      theme: "light",
      notifications: false,
      language: "en"
    },
    roles: ["user"],
    createdAt: new Date("2024-02-20T08:15:00Z"),
    lastLogin: new Date("2024-06-21T09:45:30Z"),
    isActive: true
  },
  {
    _id: ObjectId("507f1f77bcf86cd799439013"),
    username: "bobwilson",
    email: "bob@example.com",
    profile: {
      firstName: "Bob",
      lastName: "Wilson",
      avatar: "https://api.example.com/avatars/3.jpg",
      bio: "DevOps engineer",
      location: "Seattle, WA"
    },
    settings: {
      theme: "dark",
      notifications: true,
      language: "en"
    },
    roles: ["user", "moderator"],
    createdAt: new Date("2024-03-10T12:00:00Z"),
    lastLogin: new Date("2024-06-19T16:30:00Z"),
    isActive: true
  }
]);

// Create indexes for users
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.users.createIndex({ "profile.location": 1 });
db.users.createIndex({ createdAt: -1 });

// ============================================
// PRODUCTS COLLECTION
// ============================================
db.products.insertMany([
  {
    _id: ObjectId("507f1f77bcf86cd799439021"),
    name: "Laptop Pro 15",
    sku: "LAPTOP-001",
    description: "High-performance laptop for professionals with stunning 4K display",
    price: {
      amount: 1299.99,
      currency: "USD"
    },
    inventory: {
      inStock: true,
      quantity: 45,
      warehouse: "WH-001"
    },
    specs: {
      cpu: "Intel i7-12700H",
      ram: "32GB DDR5",
      storage: "1TB NVMe SSD",
      display: "15.6 inch 4K",
      battery: "10 hours"
    },
    categories: ["electronics", "computers", "laptops"],
    tags: ["professional", "high-performance", "portable"],
    rating: {
      average: 4.7,
      count: 284
    },
    images: [
      "https://cdn.example.com/products/laptop-1.jpg",
      "https://cdn.example.com/products/laptop-2.jpg"
    ],
    createdAt: new Date("2024-01-10T00:00:00Z"),
    updatedAt: new Date("2024-06-15T00:00:00Z")
  },
  {
    _id: ObjectId("507f1f77bcf86cd799439022"),
    name: "Wireless Mouse",
    sku: "MOUSE-001",
    description: "Ergonomic wireless mouse with precision tracking",
    price: {
      amount: 29.99,
      currency: "USD"
    },
    inventory: {
      inStock: true,
      quantity: 200,
      warehouse: "WH-002"
    },
    specs: {
      dpi: "16000",
      buttons: 6,
      connectivity: "2.4GHz Wireless / Bluetooth",
      battery: "70 hours"
    },
    categories: ["electronics", "accessories"],
    tags: ["wireless", "ergonomic", "gaming"],
    rating: {
      average: 4.5,
      count: 523
    },
    images: [
      "https://cdn.example.com/products/mouse-1.jpg"
    ],
    createdAt: new Date("2024-02-15T00:00:00Z"),
    updatedAt: new Date("2024-05-20T00:00:00Z")
  },
  {
    _id: ObjectId("507f1f77bcf86cd799439023"),
    name: "Mechanical Keyboard",
    sku: "KB-001",
    description: "RGB mechanical keyboard with Cherry MX switches",
    price: {
      amount: 149.99,
      currency: "USD"
    },
    inventory: {
      inStock: true,
      quantity: 78,
      warehouse: "WH-001"
    },
    specs: {
      switches: "Cherry MX Blue",
      layout: "Full-size (104 keys)",
      backlight: "RGB per-key",
      connectivity: "USB-C"
    },
    categories: ["electronics", "accessories", "keyboards"],
    tags: ["mechanical", "rgb", "gaming"],
    rating: {
      average: 4.8,
      count: 189
    },
    images: [
      "https://cdn.example.com/products/keyboard-1.jpg",
      "https://cdn.example.com/products/keyboard-2.jpg"
    ],
    createdAt: new Date("2024-01-20T00:00:00Z"),
    updatedAt: new Date("2024-06-01T00:00:00Z")
  },
  {
    _id: ObjectId("507f1f77bcf86cd799439024"),
    name: "4K Monitor",
    sku: "MON-001",
    description: "27-inch 4K IPS monitor with HDR support",
    price: {
      amount: 449.99,
      currency: "USD"
    },
    inventory: {
      inStock: true,
      quantity: 32,
      warehouse: "WH-001"
    },
    specs: {
      size: "27 inches",
      resolution: "3840x2160",
      panel: "IPS",
      refreshRate: "60Hz",
      hdr: true
    },
    categories: ["electronics", "monitors"],
    tags: ["4k", "professional", "hdr"],
    rating: {
      average: 4.6,
      count: 156
    },
    images: [
      "https://cdn.example.com/products/monitor-1.jpg"
    ],
    createdAt: new Date("2024-03-01T00:00:00Z"),
    updatedAt: new Date("2024-06-10T00:00:00Z")
  },
  {
    _id: ObjectId("507f1f77bcf86cd799439025"),
    name: "USB-C Hub",
    sku: "HUB-001",
    description: "7-in-1 USB-C hub with HDMI, USB-A, and SD card reader",
    price: {
      amount: 59.99,
      currency: "USD"
    },
    inventory: {
      inStock: false,
      quantity: 0,
      warehouse: "WH-002"
    },
    specs: {
      ports: ["HDMI 4K", "USB-A x2", "USB-C PD", "SD", "microSD", "Ethernet"],
      power: "100W passthrough"
    },
    categories: ["electronics", "accessories"],
    tags: ["usb-c", "hub", "portable"],
    rating: {
      average: 4.3,
      count: 312
    },
    images: [
      "https://cdn.example.com/products/hub-1.jpg"
    ],
    createdAt: new Date("2024-04-01T00:00:00Z"),
    updatedAt: new Date("2024-06-18T00:00:00Z")
  }
]);

// Create indexes for products
db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ categories: 1 });
db.products.createIndex({ tags: 1 });
db.products.createIndex({ "price.amount": 1 });
db.products.createIndex({ "rating.average": -1 });
db.products.createIndex({ name: "text", description: "text" });

// ============================================
// ORDERS COLLECTION
// ============================================
db.orders.insertMany([
  {
    _id: ObjectId("507f1f77bcf86cd799439031"),
    orderNumber: "ORD-2024-001",
    customer: {
      userId: ObjectId("507f1f77bcf86cd799439011"),
      name: "John Doe",
      email: "john@example.com"
    },
    items: [
      {
        productId: ObjectId("507f1f77bcf86cd799439021"),
        name: "Laptop Pro 15",
        quantity: 1,
        price: 1299.99
      },
      {
        productId: ObjectId("507f1f77bcf86cd799439022"),
        name: "Wireless Mouse",
        quantity: 1,
        price: 29.99
      }
    ],
    shipping: {
      method: "express",
      address: {
        street: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zip: "94102",
        country: "USA"
      },
      trackingNumber: "1Z999AA10123456784"
    },
    payment: {
      method: "credit_card",
      last4: "4242",
      status: "completed"
    },
    totals: {
      subtotal: 1329.98,
      tax: 119.70,
      shipping: 15.00,
      total: 1464.68
    },
    status: "shipped",
    statusHistory: [
      { status: "pending", date: new Date("2024-06-15T14:30:00Z") },
      { status: "processing", date: new Date("2024-06-15T14:35:00Z") },
      { status: "shipped", date: new Date("2024-06-16T09:00:00Z") }
    ],
    createdAt: new Date("2024-06-15T14:30:00Z"),
    updatedAt: new Date("2024-06-16T09:00:00Z")
  },
  {
    _id: ObjectId("507f1f77bcf86cd799439032"),
    orderNumber: "ORD-2024-002",
    customer: {
      userId: ObjectId("507f1f77bcf86cd799439012"),
      name: "Jane Smith",
      email: "jane@example.com"
    },
    items: [
      {
        productId: ObjectId("507f1f77bcf86cd799439023"),
        name: "Mechanical Keyboard",
        quantity: 1,
        price: 149.99
      }
    ],
    shipping: {
      method: "standard",
      address: {
        street: "456 Park Ave",
        city: "New York",
        state: "NY",
        zip: "10001",
        country: "USA"
      },
      trackingNumber: null
    },
    payment: {
      method: "paypal",
      email: "jane@example.com",
      status: "completed"
    },
    totals: {
      subtotal: 149.99,
      tax: 13.50,
      shipping: 0,
      total: 163.49
    },
    status: "processing",
    statusHistory: [
      { status: "pending", date: new Date("2024-06-20T10:15:00Z") },
      { status: "processing", date: new Date("2024-06-20T10:20:00Z") }
    ],
    createdAt: new Date("2024-06-20T10:15:00Z"),
    updatedAt: new Date("2024-06-20T10:20:00Z")
  },
  {
    _id: ObjectId("507f1f77bcf86cd799439033"),
    orderNumber: "ORD-2024-003",
    customer: {
      userId: ObjectId("507f1f77bcf86cd799439011"),
      name: "John Doe",
      email: "john@example.com"
    },
    items: [
      {
        productId: ObjectId("507f1f77bcf86cd799439024"),
        name: "4K Monitor",
        quantity: 2,
        price: 449.99
      }
    ],
    shipping: {
      method: "express",
      address: {
        street: "123 Main St",
        city: "San Francisco",
        state: "CA",
        zip: "94102",
        country: "USA"
      },
      trackingNumber: "1Z999AA10123456785"
    },
    payment: {
      method: "credit_card",
      last4: "1234",
      status: "completed"
    },
    totals: {
      subtotal: 899.98,
      tax: 81.00,
      shipping: 25.00,
      total: 1005.98
    },
    status: "delivered",
    statusHistory: [
      { status: "pending", date: new Date("2024-06-10T08:00:00Z") },
      { status: "processing", date: new Date("2024-06-10T08:15:00Z") },
      { status: "shipped", date: new Date("2024-06-11T10:00:00Z") },
      { status: "delivered", date: new Date("2024-06-13T14:30:00Z") }
    ],
    createdAt: new Date("2024-06-10T08:00:00Z"),
    updatedAt: new Date("2024-06-13T14:30:00Z")
  }
]);

// Create indexes for orders
db.orders.createIndex({ orderNumber: 1 }, { unique: true });
db.orders.createIndex({ "customer.userId": 1 });
db.orders.createIndex({ status: 1 });
db.orders.createIndex({ createdAt: -1 });

// ============================================
// LOGS COLLECTION (Time-series like)
// ============================================
db.logs.insertMany([
  {
    timestamp: new Date("2024-06-21T10:00:00Z"),
    level: "info",
    service: "api",
    message: "Application started",
    metadata: { version: "2.1.0", environment: "production" }
  },
  {
    timestamp: new Date("2024-06-21T10:00:01Z"),
    level: "info",
    service: "api",
    message: "Database connection established",
    metadata: { host: "mongodb.example.com", database: "production" }
  },
  {
    timestamp: new Date("2024-06-21T10:01:00Z"),
    level: "info",
    service: "api",
    message: "User login successful",
    metadata: { userId: "507f1f77bcf86cd799439011", ip: "192.168.1.100" }
  },
  {
    timestamp: new Date("2024-06-21T10:02:30Z"),
    level: "warning",
    service: "api",
    message: "Rate limit approaching",
    metadata: { userId: "507f1f77bcf86cd799439012", currentRate: 950, limit: 1000 }
  },
  {
    timestamp: new Date("2024-06-21T10:05:00Z"),
    level: "error",
    service: "payment",
    message: "Payment gateway timeout",
    metadata: { orderId: "ORD-2024-004", gateway: "stripe", timeout: 30000 }
  },
  {
    timestamp: new Date("2024-06-21T10:10:00Z"),
    level: "info",
    service: "worker",
    message: "Email notification sent",
    metadata: { type: "order_confirmation", recipient: "john@example.com" }
  }
]);

// Create indexes for logs
db.logs.createIndex({ timestamp: -1 });
db.logs.createIndex({ level: 1 });
db.logs.createIndex({ service: 1 });
db.logs.createIndex({ timestamp: -1, level: 1 });

// ============================================
// ANALYTICS COLLECTION
// ============================================
db.analytics.insertMany([
  {
    date: new Date("2024-06-21"),
    type: "daily_summary",
    metrics: {
      pageViews: 15420,
      uniqueVisitors: 3280,
      sessions: 4520,
      avgSessionDuration: 245,
      bounceRate: 42.5
    },
    topPages: [
      { path: "/", views: 5200 },
      { path: "/products", views: 3100 },
      { path: "/checkout", views: 1850 }
    ],
    referrers: [
      { source: "google", visits: 2100 },
      { source: "direct", visits: 1800 },
      { source: "facebook", visits: 450 }
    ]
  },
  {
    date: new Date("2024-06-20"),
    type: "daily_summary",
    metrics: {
      pageViews: 14200,
      uniqueVisitors: 3050,
      sessions: 4200,
      avgSessionDuration: 238,
      bounceRate: 44.2
    },
    topPages: [
      { path: "/", views: 4800 },
      { path: "/products", views: 2900 },
      { path: "/checkout", views: 1650 }
    ],
    referrers: [
      { source: "google", visits: 1950 },
      { source: "direct", visits: 1700 },
      { source: "twitter", visits: 380 }
    ]
  }
]);

// Create indexes for analytics
db.analytics.createIndex({ date: -1, type: 1 });

// ============================================
// CATEGORIES COLLECTION (Reference data)
// ============================================
db.categories.insertMany([
  {
    _id: "electronics",
    name: "Electronics",
    description: "Electronic devices and gadgets",
    parent: null,
    level: 0,
    path: "electronics"
  },
  {
    _id: "computers",
    name: "Computers",
    description: "Desktop and laptop computers",
    parent: "electronics",
    level: 1,
    path: "electronics/computers"
  },
  {
    _id: "laptops",
    name: "Laptops",
    description: "Portable laptop computers",
    parent: "computers",
    level: 2,
    path: "electronics/computers/laptops"
  },
  {
    _id: "accessories",
    name: "Accessories",
    description: "Computer and electronic accessories",
    parent: "electronics",
    level: 1,
    path: "electronics/accessories"
  },
  {
    _id: "keyboards",
    name: "Keyboards",
    description: "Computer keyboards",
    parent: "accessories",
    level: 2,
    path: "electronics/accessories/keyboards"
  },
  {
    _id: "monitors",
    name: "Monitors",
    description: "Computer monitors and displays",
    parent: "electronics",
    level: 1,
    path: "electronics/monitors"
  }
]);

// Create indexes for categories
db.categories.createIndex({ parent: 1 });
db.categories.createIndex({ path: 1 });

// ============================================
// SETTINGS COLLECTION (Application config)
// ============================================
db.settings.insertMany([
  {
    _id: "app_config",
    version: "2.1.0",
    environment: "production",
    features: {
      darkMode: true,
      betaFeatures: false,
      maintenance: false
    },
    limits: {
      rateLimit: 1000,
      maxUploadSize: 10485760,
      maxConnections: 100
    },
    updatedAt: new Date("2024-06-21T00:00:00Z")
  },
  {
    _id: "email_templates",
    templates: {
      welcome: {
        subject: "Welcome to Our Platform",
        body: "Hello {{name}}, welcome aboard!"
      },
      orderConfirmation: {
        subject: "Order Confirmation - {{orderNumber}}",
        body: "Thank you for your order {{orderNumber}}"
      },
      passwordReset: {
        subject: "Password Reset Request",
        body: "Click the link to reset your password"
      }
    },
    updatedAt: new Date("2024-06-15T00:00:00Z")
  }
]);

print("MongoDB sample data loaded successfully!");
print("Collections created: users, products, orders, logs, analytics, categories, settings");
