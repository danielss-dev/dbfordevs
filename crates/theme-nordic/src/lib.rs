//! Nordic Theme Extension for dbfordevs
//!
//! An arctic, north-bluish color palette inspired by the beauty of the Nordic wilderness.
//! Based on the Nord color scheme (https://www.nordtheme.com/).
//!
//! ## Color Palette
//!
//! ### Polar Night (Dark backgrounds)
//! - `nord0`: #2E3440 - Origin color, darkest
//! - `nord1`: #3B4252 - Lighter shade for prominent UI elements
//! - `nord2`: #434C5E - UI elements like status bars
//! - `nord3`: #4C566A - Lightest, for comments and invisibles
//!
//! ### Snow Storm (Light text)
//! - `nord4`: #D8DEE9 - Origin color for text
//! - `nord5`: #E5E9F0 - Lighter variant
//! - `nord6`: #ECEFF4 - Lightest, high contrast text
//!
//! ### Frost (Blue accents)
//! - `nord7`: #8FBCBB - Frozen polar water
//! - `nord8`: #88C0D0 - Clear ice
//! - `nord9`: #81A1C1 - Arctic ocean
//! - `nord10`: #5E81AC - Deep arctic waters
//!
//! ### Aurora (Accent colors)
//! - `nord11`: #BF616A - Red
//! - `nord12`: #D08770 - Orange
//! - `nord13`: #EBCB8B - Yellow
//! - `nord14`: #A3BE8C - Green
//! - `nord15`: #B48EAD - Purple

use extension_core::{Extension, ExtensionCategory, ExtensionError, ExtensionMetadata};
use serde::{Deserialize, Serialize};

/// Nordic theme definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NordicTheme {
    pub variant: ThemeVariant,
}

/// Theme variant
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThemeVariant {
    Dark,
    Light,
}

impl NordicTheme {
    /// Create a new Nordic Dark theme
    pub fn dark() -> Self {
        Self {
            variant: ThemeVariant::Dark,
        }
    }

    /// Create a new Nordic Light theme
    pub fn light() -> Self {
        Self {
            variant: ThemeVariant::Light,
        }
    }

    /// Get the CSS variables for this theme
    pub fn css_variables(&self) -> &'static str {
        match self.variant {
            ThemeVariant::Dark => NORDIC_DARK_CSS,
            ThemeVariant::Light => NORDIC_LIGHT_CSS,
        }
    }
}

impl Default for NordicTheme {
    fn default() -> Self {
        Self::dark()
    }
}

impl Extension for NordicTheme {
    fn metadata(&self) -> ExtensionMetadata {
        ExtensionMetadata {
            id: "theme-nordic".to_string(),
            name: "Nordic Theme".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            description: "An arctic, north-bluish color palette inspired by the Nordic wilderness".to_string(),
            author: "dbfordevs".to_string(),
            category: ExtensionCategory::Theme,
            is_official: true,
            repository: Some("https://github.com/dbfordevs/dbfordevs".to_string()),
            min_app_version: Some("0.1.0".to_string()),
        }
    }

    fn on_load(&self) -> Result<(), ExtensionError> {
        Ok(())
    }
}

/// Nord color palette constants
pub mod colors {
    // Polar Night - Dark backgrounds
    pub const NORD0: &str = "#2E3440";
    pub const NORD1: &str = "#3B4252";
    pub const NORD2: &str = "#434C5E";
    pub const NORD3: &str = "#4C566A";

    // Snow Storm - Light text
    pub const NORD4: &str = "#D8DEE9";
    pub const NORD5: &str = "#E5E9F0";
    pub const NORD6: &str = "#ECEFF4";

    // Frost - Blue accents
    pub const NORD7: &str = "#8FBCBB";
    pub const NORD8: &str = "#88C0D0";
    pub const NORD9: &str = "#81A1C1";
    pub const NORD10: &str = "#5E81AC";

    // Aurora - Accent colors
    pub const NORD11: &str = "#BF616A"; // Red
    pub const NORD12: &str = "#D08770"; // Orange
    pub const NORD13: &str = "#EBCB8B"; // Yellow
    pub const NORD14: &str = "#A3BE8C"; // Green
    pub const NORD15: &str = "#B48EAD"; // Purple
}

/// CSS variables for Nordic Dark theme
pub const NORDIC_DARK_CSS: &str = r#"
:root {
  /* Nordic Dark Theme */
  
  /* Background colors - Polar Night */
  --background: 220 16% 22%;
  --foreground: 218 27% 92%;
  
  /* Card colors */
  --card: 220 17% 24%;
  --card-foreground: 218 27% 92%;
  
  /* Popover colors */
  --popover: 220 16% 22%;
  --popover-foreground: 218 27% 92%;
  
  /* Primary - Frost Blue (nord8) */
  --primary: 193 43% 67%;
  --primary-foreground: 220 16% 22%;
  
  /* Secondary - Polar Night lighter */
  --secondary: 220 16% 28%;
  --secondary-foreground: 218 27% 92%;
  
  /* Muted colors */
  --muted: 220 16% 28%;
  --muted-foreground: 219 14% 55%;
  
  /* Accent - Frost (nord9) */
  --accent: 213 32% 63%;
  --accent-foreground: 220 16% 22%;
  
  /* Destructive - Aurora Red (nord11) */
  --destructive: 354 42% 56%;
  --destructive-foreground: 218 27% 92%;
  
  /* Border and input */
  --border: 220 16% 32%;
  --input: 220 16% 32%;
  --ring: 193 43% 67%;
  
  /* Semantic colors - Aurora */
  --success: 92 28% 65%;
  --warning: 40 81% 73%;
  
  /* Radius */
  --radius: 0.5rem;
  
  /* Chart colors - Full Aurora palette */
  --chart-1: 193 43% 67%;
  --chart-2: 179 25% 65%;
  --chart-3: 92 28% 65%;
  --chart-4: 40 81% 73%;
  --chart-5: 311 20% 63%;
}
"#;

/// CSS variables for Nordic Light theme
pub const NORDIC_LIGHT_CSS: &str = r#"
:root {
  /* Nordic Light Theme */
  
  /* Background colors - Snow Storm */
  --background: 219 28% 96%;
  --foreground: 220 16% 22%;
  
  /* Card colors */
  --card: 220 27% 98%;
  --card-foreground: 220 16% 22%;
  
  /* Popover colors */
  --popover: 220 27% 98%;
  --popover-foreground: 220 16% 22%;
  
  /* Primary - Frost Blue (nord10) */
  --primary: 213 32% 52%;
  --primary-foreground: 219 28% 96%;
  
  /* Secondary - Snow Storm darker */
  --secondary: 219 28% 88%;
  --secondary-foreground: 220 16% 22%;
  
  /* Muted colors */
  --muted: 219 28% 90%;
  --muted-foreground: 220 16% 36%;
  
  /* Accent - Frost (nord9) */
  --accent: 213 32% 63%;
  --accent-foreground: 220 16% 22%;
  
  /* Destructive - Aurora Red (nord11) */
  --destructive: 354 42% 56%;
  --destructive-foreground: 219 28% 96%;
  
  /* Border and input */
  --border: 218 27% 85%;
  --input: 218 27% 85%;
  --ring: 213 32% 52%;
  
  /* Semantic colors - Aurora */
  --success: 92 28% 52%;
  --warning: 40 81% 50%;
  
  /* Radius */
  --radius: 0.5rem;
  
  /* Chart colors - Full Aurora palette */
  --chart-1: 213 32% 52%;
  --chart-2: 179 25% 50%;
  --chart-3: 92 28% 52%;
  --chart-4: 40 81% 50%;
  --chart-5: 311 20% 50%;
}
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dark_theme() {
        let theme = NordicTheme::dark();
        assert_eq!(theme.variant, ThemeVariant::Dark);
        assert!(theme.css_variables().contains("Nordic Dark"));
    }

    #[test]
    fn test_light_theme() {
        let theme = NordicTheme::light();
        assert_eq!(theme.variant, ThemeVariant::Light);
        assert!(theme.css_variables().contains("Nordic Light"));
    }

    #[test]
    fn test_metadata() {
        let theme = NordicTheme::default();
        let metadata = theme.metadata();
        assert_eq!(metadata.id, "theme-nordic");
        assert!(metadata.is_official);
    }
}

