export interface PluginData {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: "Validators" | "AI" | "Exporters" | "Themes";
  downloads: string;
  rating: number;
  isOfficial: boolean;
  isFeatured?: boolean;
}

export const PLUGINS: PluginData[] = [
  {
    id: "validator-csharp",
    name: "C# / .NET Validator",
    description: "Validate ADO.NET connection strings for SQL Server, PostgreSQL, and MySQL.",
    version: "1.0.2",
    author: "dbfordevs",
    category: "Validators",
    downloads: "1.2k",
    rating: 4.8,
    isOfficial: true,
  },
  {
    id: "validator-nodejs",
    name: "Node.js Validator",
    description: "Support for pg, mysql2, and mssql connection string formats (URL and JSON).",
    version: "1.1.0",
    author: "dbfordevs",
    category: "Validators",
    downloads: "2.5k",
    rating: 4.9,
    isOfficial: true,
  },
  {
    id: "validator-python",
    name: "Python Validator",
    description: "SQLAlchemy, psycopg2, and PyMySQL connection URL validation.",
    version: "1.0.5",
    author: "dbfordevs",
    category: "Validators",
    downloads: "800",
    rating: 4.7,
    isOfficial: true,
  },
  {
    id: "ai-assistant",
    name: "AI Query Assistant",
    description: "Generate SQL from natural language, optimize slow queries, and explain plans.",
    version: "2.0.1",
    author: "dbfordevs",
    category: "AI",
    downloads: "5.4k",
    rating: 5.0,
    isOfficial: true,
    isFeatured: true,
  },
  {
    id: "exporter-parquet",
    name: "Parquet Exporter",
    description: "Export result sets to Apache Parquet format for big data processing.",
    version: "0.9.0",
    author: "Community",
    category: "Exporters",
    downloads: "300",
    rating: 4.5,
    isOfficial: false,
  },
  {
    id: "theme-nord",
    name: "Nord Theme",
    description: "An arctic, north-bluish color palette for dbfordevs.",
    version: "1.0.0",
    author: "Arctic Ice Studio",
    category: "Themes",
    downloads: "1.5k",
    rating: 4.8,
    isOfficial: false,
  },
];
