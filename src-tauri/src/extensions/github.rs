//! GitHub Extension Source
//!
//! Handles downloading and installing extensions from GitHub releases.

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

/// GitHub release information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub published_at: Option<String>,
    pub assets: Vec<GitHubAsset>,
}

/// GitHub release asset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
    pub content_type: Option<String>,
}

/// GitHub extension source for downloading extensions
pub struct GitHubExtensionSource {
    client: reqwest::Client,
}

impl GitHubExtensionSource {
    /// Create a new GitHub extension source
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::builder()
                .user_agent("dbfordevs")
                .build()
                .unwrap_or_else(|_| reqwest::Client::new()),
        }
    }

    /// Parse a GitHub repository URL
    pub fn parse_repo_url(url: &str) -> Option<(String, String)> {
        // Handle formats:
        // - https://github.com/owner/repo
        // - github.com/owner/repo
        // - owner/repo
        let url = url
            .trim()
            .trim_start_matches("https://")
            .trim_start_matches("http://")
            .trim_start_matches("github.com/");

        let parts: Vec<&str> = url.split('/').collect();
        if parts.len() >= 2 {
            Some((parts[0].to_string(), parts[1].to_string()))
        } else {
            None
        }
    }

    /// Get the latest release for a repository
    pub async fn get_latest_release(&self, owner: &str, repo: &str) -> AppResult<GitHubRelease> {
        let url = format!(
            "https://api.github.com/repos/{}/{}/releases/latest",
            owner, repo
        );

        let response = self
            .client
            .get(&url)
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to fetch release: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub API error ({}): {}",
                status, body
            )));
        }

        response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse release: {}", e)))
    }

    /// Get all releases for a repository
    pub async fn get_releases(&self, owner: &str, repo: &str) -> AppResult<Vec<GitHubRelease>> {
        let url = format!(
            "https://api.github.com/repos/{}/{}/releases",
            owner, repo
        );

        let response = self
            .client
            .get(&url)
            .header("Accept", "application/vnd.github+json")
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to fetch releases: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub API error ({}): {}",
                status, body
            )));
        }

        response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse releases: {}", e)))
    }

    /// Download a release asset
    pub async fn download_asset(&self, asset: &GitHubAsset) -> AppResult<Vec<u8>> {
        let response = self
            .client
            .get(&asset.browser_download_url)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to download asset: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Failed to download asset: {}",
                response.status()
            )));
        }

        response
            .bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| AppError::Internal(format!("Failed to read asset: {}", e)))
    }

    /// Download extension from a GitHub repository
    pub async fn download_extension(
        &self,
        owner: &str,
        repo: &str,
    ) -> AppResult<(GitHubRelease, Vec<u8>)> {
        let release = self.get_latest_release(owner, repo).await?;

        // Look for extension package (zip file)
        let asset = release
            .assets
            .iter()
            .find(|a| a.name.ends_with(".zip") || a.name.ends_with(".tar.gz"))
            .ok_or_else(|| {
                AppError::Internal("No extension package found in release".to_string())
            })?;

        let data = self.download_asset(asset).await?;
        Ok((release, data))
    }
}

impl Default for GitHubExtensionSource {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_repo_url() {
        assert_eq!(
            GitHubExtensionSource::parse_repo_url("https://github.com/owner/repo"),
            Some(("owner".to_string(), "repo".to_string()))
        );

        assert_eq!(
            GitHubExtensionSource::parse_repo_url("github.com/owner/repo"),
            Some(("owner".to_string(), "repo".to_string()))
        );

        assert_eq!(
            GitHubExtensionSource::parse_repo_url("owner/repo"),
            Some(("owner".to_string(), "repo".to_string()))
        );

        assert_eq!(GitHubExtensionSource::parse_repo_url("invalid"), None);
    }
}

