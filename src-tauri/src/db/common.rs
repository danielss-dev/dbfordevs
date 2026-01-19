//! Common utilities shared across database drivers.

use crate::models::{DatabaseType, StatementType};

/// Quotes a single SQL identifier (table name, column name, schema name) based on database type.
/// Properly escapes special characters within the identifier to prevent SQL injection.
///
/// # Examples
/// - PostgreSQL: `my"table` becomes `"my""table"`
/// - MySQL: `my`table` becomes `` `my``table` ``
/// - MSSQL: `my]table` becomes `[my]]table]`
pub fn quote_identifier_single(identifier: &str, db_type: &DatabaseType) -> String {
    match db_type {
        DatabaseType::MySQL | DatabaseType::MariaDB => {
            // MySQL uses backticks, escape any backticks in the identifier
            format!("`{}`", identifier.replace('`', "``"))
        }
        DatabaseType::MSSQL => {
            // MSSQL uses brackets, escape closing brackets
            format!("[{}]", identifier.replace(']', "]]"))
        }
        DatabaseType::PostgreSQL | DatabaseType::SQLite | DatabaseType::CockroachDB | DatabaseType::Oracle => {
            // PostgreSQL, SQLite, CockroachDB, and Oracle use double quotes
            format!("\"{}\"", identifier.replace('"', "\"\""))
        }
        DatabaseType::Redis | DatabaseType::MongoDB | DatabaseType::Cassandra => {
            // NoSQL databases don't use SQL identifiers
            identifier.to_string()
        }
    }
}

/// Quotes a SQL identifier that may be schema-qualified (e.g., "schema.table").
/// Handles each part of the identifier separately.
///
/// # Examples
/// - PostgreSQL: `public.my"table` becomes `"public"."my""table"`
/// - MySQL: `mydb.my`table` becomes `` `mydb`.`my``table` ``
pub fn quote_identifier(identifier: &str, db_type: &DatabaseType) -> String {
    identifier
        .split('.')
        .map(|part| quote_identifier_single(part, db_type))
        .collect::<Vec<_>>()
        .join(".")
}

/// Configuration for CTE parsing that varies by database.
#[derive(Default)]
pub struct CteParserConfig {
    /// Quote characters used for string literals (e.g., `'`, `"`, `` ` ``).
    pub string_quotes: Vec<char>,
    /// Additional DML keywords beyond INSERT/UPDATE/DELETE (e.g., REPLACE for MySQL).
    pub additional_dml_keywords: Vec<&'static str>,
    /// Whether to handle PostgreSQL dollar-quoted strings.
    pub handle_dollar_quotes: bool,
}

impl CteParserConfig {
    /// Configuration for PostgreSQL.
    pub fn postgres() -> Self {
        Self {
            string_quotes: vec!['\'', '"'],
            additional_dml_keywords: vec![],
            handle_dollar_quotes: true,
        }
    }

    /// Configuration for MySQL.
    pub fn mysql() -> Self {
        Self {
            string_quotes: vec!['\'', '"', '`'],
            additional_dml_keywords: vec!["REPLACE"],
            handle_dollar_quotes: false,
        }
    }

    /// Configuration for MSSQL.
    pub fn mssql() -> Self {
        Self {
            string_quotes: vec!['\'', '"'],
            additional_dml_keywords: vec![],
            handle_dollar_quotes: false,
        }
    }

    /// Configuration for SQLite.
    pub fn sqlite() -> Self {
        Self {
            string_quotes: vec!['\'', '"'],
            additional_dml_keywords: vec![],
            handle_dollar_quotes: false,
        }
    }
}

/// Parses a CTE (WITH clause) statement to determine if the main statement is DML or SELECT.
///
/// This function handles:
/// - Nested parentheses
/// - String literals with proper escape handling
/// - PostgreSQL dollar-quoted strings (when enabled)
/// - Database-specific DML keywords
///
/// # Arguments
/// * `clean_sql` - The SQL string, already uppercased and trimmed
/// * `config` - Database-specific configuration
///
/// # Returns
/// The detected statement type (DML or Select)
pub fn parse_cte_statement_type(clean_sql: &str, config: &CteParserConfig) -> StatementType {
    let mut depth = 0;
    let mut in_string = false;
    let mut quote_char = ' ';
    let mut in_dollar_quote = false;
    let mut dollar_tag = String::new();
    let chars: Vec<char> = clean_sql.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let c = chars[i];

        // Handle dollar-quoted strings for PostgreSQL
        if config.handle_dollar_quotes && !in_string {
            if c == '$' && !in_dollar_quote {
                // Check for dollar quote start: $tag$ or $$
                let mut tag = String::new();
                let mut j = i + 1;
                while j < chars.len() && (chars[j].is_alphanumeric() || chars[j] == '_') {
                    tag.push(chars[j]);
                    j += 1;
                }
                if j < chars.len() && chars[j] == '$' {
                    in_dollar_quote = true;
                    dollar_tag = tag;
                    i = j + 1;
                    continue;
                }
            } else if c == '$' && in_dollar_quote {
                // Check for dollar quote end
                let mut tag = String::new();
                let mut j = i + 1;
                while j < chars.len() && (chars[j].is_alphanumeric() || chars[j] == '_') {
                    tag.push(chars[j]);
                    j += 1;
                }
                if j < chars.len() && chars[j] == '$' && tag == dollar_tag {
                    in_dollar_quote = false;
                    dollar_tag.clear();
                    i = j + 1;
                    continue;
                }
            }
        }

        // Skip if inside dollar quote
        if in_dollar_quote {
            i += 1;
            continue;
        }

        if in_string {
            if c == '\\' && i + 1 < chars.len() {
                // Skip escaped character
                i += 2;
                continue;
            }
            if c == quote_char {
                // Check for escaped quote (doubled quote character)
                if i + 1 < chars.len() && chars[i + 1] == quote_char {
                    i += 2;
                    continue;
                }
                in_string = false;
            }
        } else {
            if config.string_quotes.contains(&c) {
                in_string = true;
                quote_char = c;
            } else {
                match c {
                    '(' => depth += 1,
                    ')' => {
                        if depth > 0 {
                            depth -= 1;
                        }
                    }
                    _ => {
                        if depth == 0
                            && i > 0
                            && (chars[i - 1].is_whitespace() || chars[i - 1] == ')')
                        {
                            let remaining = &clean_sql[i..];

                            // Check standard DML keywords
                            if is_keyword_match(remaining, "INSERT", 6)
                                || is_keyword_match(remaining, "UPDATE", 6)
                                || is_keyword_match(remaining, "DELETE", 6)
                            {
                                return StatementType::Dml;
                            }

                            // Check additional DML keywords
                            for keyword in &config.additional_dml_keywords {
                                if is_keyword_match(remaining, keyword, keyword.len()) {
                                    return StatementType::Dml;
                                }
                            }

                            if is_keyword_match(remaining, "SELECT", 6) {
                                return StatementType::Select;
                            }
                        }
                    }
                }
            }
        }
        i += 1;
    }

    StatementType::Select
}

/// Checks if the string starts with the given keyword and is followed by a non-identifier character.
fn is_keyword_match(s: &str, keyword: &str, keyword_len: usize) -> bool {
    s.starts_with(keyword)
        && s.chars()
            .nth(keyword_len)
            .map_or(true, |c| !c.is_alphanumeric() && c != '_')
}

/// Escapes a SQLite identifier by doubling any double-quote characters.
///
/// This is used when constructing queries that reference schema-qualified tables
/// where the schema name needs to be safely interpolated.
pub fn escape_sqlite_identifier(identifier: &str) -> String {
    identifier.replace('"', "\"\"")
}

#[cfg(test)]
mod tests {
    use super::*;

    mod cte_parser {
        use super::*;

        #[test]
        fn test_simple_cte_select() {
            let sql = "WITH CTE AS (SELECT * FROM USERS) SELECT * FROM CTE";
            assert_eq!(
                parse_cte_statement_type(sql, &CteParserConfig::postgres()),
                StatementType::Select
            );
        }

        #[test]
        fn test_simple_cte_insert() {
            let sql = "WITH CTE AS (SELECT * FROM USERS) INSERT INTO TARGET SELECT * FROM CTE";
            assert_eq!(
                parse_cte_statement_type(sql, &CteParserConfig::postgres()),
                StatementType::Dml
            );
        }

        #[test]
        fn test_simple_cte_update() {
            let sql = "WITH CTE AS (SELECT ID FROM USERS) UPDATE TARGET SET X = 1 WHERE ID IN (SELECT ID FROM CTE)";
            assert_eq!(
                parse_cte_statement_type(sql, &CteParserConfig::postgres()),
                StatementType::Dml
            );
        }

        #[test]
        fn test_simple_cte_delete() {
            let sql = "WITH CTE AS (SELECT ID FROM USERS) DELETE FROM TARGET WHERE ID IN (SELECT ID FROM CTE)";
            assert_eq!(
                parse_cte_statement_type(sql, &CteParserConfig::postgres()),
                StatementType::Dml
            );
        }

        #[test]
        fn test_nested_cte() {
            let sql = "WITH CTE1 AS (SELECT * FROM (SELECT * FROM INNER_TABLE)), CTE2 AS (SELECT * FROM CTE1) SELECT * FROM CTE2";
            assert_eq!(
                parse_cte_statement_type(sql, &CteParserConfig::postgres()),
                StatementType::Select
            );
        }

        #[test]
        fn test_cte_with_string_containing_keyword() {
            let sql = "WITH CTE AS (SELECT 'INSERT INTO FAKE' AS COL) SELECT * FROM CTE";
            assert_eq!(
                parse_cte_statement_type(sql, &CteParserConfig::postgres()),
                StatementType::Select
            );
        }

        #[test]
        fn test_cte_with_escaped_quote() {
            let sql = "WITH CTE AS (SELECT 'IT''S A TEST' AS COL) INSERT INTO TARGET SELECT * FROM CTE";
            assert_eq!(
                parse_cte_statement_type(sql, &CteParserConfig::postgres()),
                StatementType::Dml
            );
        }

        #[test]
        fn test_cte_with_backslash_escape() {
            let sql = "WITH CTE AS (SELECT 'IT\\'S A TEST' AS COL) INSERT INTO TARGET SELECT * FROM CTE";
            assert_eq!(
                parse_cte_statement_type(sql, &CteParserConfig::postgres()),
                StatementType::Dml
            );
        }

        #[test]
        fn test_postgres_dollar_quoted_string() {
            let sql =
                "WITH CTE AS (SELECT $$INSERT INTO FAKE$$ AS COL) SELECT * FROM CTE";
            assert_eq!(
                parse_cte_statement_type(sql, &CteParserConfig::postgres()),
                StatementType::Select
            );
        }

        #[test]
        fn test_postgres_dollar_quoted_with_tag() {
            let sql =
                "WITH CTE AS (SELECT $tag$INSERT INTO FAKE$tag$ AS COL) SELECT * FROM CTE";
            assert_eq!(
                parse_cte_statement_type(sql, &CteParserConfig::postgres()),
                StatementType::Select
            );
        }

        #[test]
        fn test_mysql_replace_keyword() {
            let sql = "WITH CTE AS (SELECT * FROM USERS) REPLACE INTO TARGET SELECT * FROM CTE";
            assert_eq!(
                parse_cte_statement_type(sql, &CteParserConfig::mysql()),
                StatementType::Dml
            );
        }

        #[test]
        fn test_mysql_backtick_quotes() {
            let sql = "WITH CTE AS (SELECT `INSERT` FROM USERS) SELECT * FROM CTE";
            assert_eq!(
                parse_cte_statement_type(sql, &CteParserConfig::mysql()),
                StatementType::Select
            );
        }

        #[test]
        fn test_keyword_not_matched_as_prefix() {
            // INSERTED should not match INSERT
            let sql = "WITH CTE AS (SELECT INSERTED FROM USERS) SELECT * FROM CTE";
            assert_eq!(
                parse_cte_statement_type(sql, &CteParserConfig::postgres()),
                StatementType::Select
            );
        }
    }

    mod sqlite_identifier {
        use super::*;

        #[test]
        fn test_escape_no_quotes() {
            assert_eq!(escape_sqlite_identifier("main"), "main");
        }

        #[test]
        fn test_escape_with_double_quotes() {
            assert_eq!(escape_sqlite_identifier("my\"schema"), "my\"\"schema");
        }

        #[test]
        fn test_escape_multiple_quotes() {
            assert_eq!(escape_sqlite_identifier("a\"b\"c"), "a\"\"b\"\"c");
        }
    }
}
