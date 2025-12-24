/**
 * Extension Catalog
 */

export interface MarketplaceExtension {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: "validator" | "ai" | "exporter" | "theme" | "connector";
  isOfficial: boolean;
  isFeatured?: boolean;
  downloads: string;
  rating: number;
  repository?: string;
  icon?: string;
}

export const EXTENSION_CATALOG: MarketplaceExtension[] = [
  // Theme Extensions
  {
    id: "nordic-dark",
    name: "Nordic Dark",
    description: "An arctic, north-bluish dark theme inspired by the Nordic wilderness. Features Polar Night backgrounds and Frost accents.",
    version: "1.0.0",
    author: "dbfordevs",
    category: "theme",
    isOfficial: true,
    isFeatured: true,
    downloads: "2.1k",
    rating: 4.9,
  },
  {
    id: "nordic-light",
    name: "Nordic Light",
    description: "A light variant of the Nordic theme with Snow Storm backgrounds and aurora accent colors.",
    version: "1.0.0",
    author: "dbfordevs",
    category: "theme",
    isOfficial: true,
    downloads: "1.8k",
    rating: 4.8,
  },
  // AI Extensions
  {
    id: "ai-assistant",
    name: "AI Query Assistant",
    description: "Generate SQL from natural language, optimize slow queries, and get intelligent explanations. Powered by Claude.",
    version: "2.0.1",
    author: "dbfordevs",
    category: "ai",
    isOfficial: true,
    isFeatured: true,
    downloads: "5.4k",
    rating: 5.0,
  },
  // Validator Extensions (for future)
  {
    id: "validator-csharp",
    name: "C# / .NET Validator",
    description: "Validate ADO.NET connection strings for SQL Server, PostgreSQL, and MySQL.",
    version: "1.0.2",
    author: "dbfordevs",
    category: "validator",
    isOfficial: true,
    downloads: "1.2k",
    rating: 4.8,
  },
  {
    id: "validator-nodejs",
    name: "Node.js Validator",
    description: "Support for pg, mysql2, and mssql connection string formats (URL and JSON).",
    version: "1.1.0",
    author: "dbfordevs",
    category: "validator",
    isOfficial: true,
    downloads: "2.5k",
    rating: 4.9,
  },
  {
    id: "validator-python",
    name: "Python Validator",
    description: "SQLAlchemy, psycopg2, and PyMySQL connection URL validation.",
    version: "1.0.5",
    author: "dbfordevs",
    category: "validator",
    isOfficial: true,
    downloads: "800",
    rating: 4.7,
  },
];

