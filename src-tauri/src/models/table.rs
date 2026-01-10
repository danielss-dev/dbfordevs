use serde::{Deserialize, Serialize};
use super::ColumnInfo;

/// Foreign key action type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ForeignKeyAction {
    Cascade,
    SetNull,
    SetDefault,
    Restrict,
    NoAction,
}

impl ForeignKeyAction {
    pub fn to_sql(&self) -> &'static str {
        match self {
            ForeignKeyAction::Cascade => "CASCADE",
            ForeignKeyAction::SetNull => "SET NULL",
            ForeignKeyAction::SetDefault => "SET DEFAULT",
            ForeignKeyAction::Restrict => "RESTRICT",
            ForeignKeyAction::NoAction => "NO ACTION",
        }
    }
}

/// Column definition for creating a new table
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewColumnDefinition {
    pub id: String,
    pub name: String,
    pub data_type: String,
    pub length: Option<u32>,
    pub precision: Option<u32>,
    pub scale: Option<u32>,
    pub nullable: bool,
    pub default_value: Option<String>,
    pub is_primary_key: bool,
    pub is_auto_increment: bool,
    pub is_unique: bool,
    pub comment: Option<String>,
}

/// Foreign key definition for creating a new table
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewForeignKeyDefinition {
    pub id: String,
    pub name: Option<String>,
    pub columns: Vec<String>,
    pub references_table: String,
    pub references_columns: Vec<String>,
    pub on_delete: Option<ForeignKeyAction>,
    pub on_update: Option<ForeignKeyAction>,
}

/// Check constraint definition
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewCheckConstraintDefinition {
    pub id: String,
    pub name: Option<String>,
    pub expression: String,
}

/// Index definition for creating a new table
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewIndexDefinition {
    pub id: String,
    pub name: Option<String>,
    pub columns: Vec<String>,
    pub is_unique: bool,
}

/// Complete table definition for creating a new table
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewTableDefinition {
    pub name: String,
    pub schema: Option<String>,
    pub columns: Vec<NewColumnDefinition>,
    pub primary_key_columns: Vec<String>,
    pub foreign_keys: Vec<NewForeignKeyDefinition>,
    pub check_constraints: Vec<NewCheckConstraintDefinition>,
    pub indexes: Vec<NewIndexDefinition>,
    pub comment: Option<String>,
}

/// Table reference info for foreign key picker
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableReferenceInfo {
    pub table_name: String,
    pub schema: Option<String>,
    pub primary_key_columns: Vec<ColumnInfo>,
}
