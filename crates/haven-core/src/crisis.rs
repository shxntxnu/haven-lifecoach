//! Crisis resources and verified emergency contact directory.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EmergencyResource {
    pub name: String,
    pub phone: Option<String>,
    pub text: Option<String>,
    pub website: Option<String>,
    pub hours: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CrisisPack {
    pub region: String,
    pub country_name: String,
    pub emergency_services: String,
    pub emergency_description: String,
    pub resources: Vec<EmergencyResource>,
}

const UK_JSON: &str = include_str!("../../../resources/crisis_packs/uk.json");
const US_JSON: &str = include_str!("../../../resources/crisis_packs/us.json");
const EU_JSON: &str = include_str!("../../../resources/crisis_packs/eu.json");
const DEFAULT_JSON: &str = include_str!("../../../resources/crisis_packs/default.json");

/// Retrieve a verified crisis pack for a specific region.
/// Falls back to the global emergency pack if the region is not directly recognized.
pub fn get_crisis_pack(region: &str) -> CrisisPack {
    let json_data = match region.to_uppercase().as_str() {
        "UK" | "GB" | "UNITED KINGDOM" => UK_JSON,
        "US" | "USA" | "UNITED STATES" => US_JSON,
        "EU" | "EUROPE" => EU_JSON,
        _ => DEFAULT_JSON,
    };

    serde_json::from_str(json_data).unwrap_or_else(|_| CrisisPack {
        region: "GLOBAL".to_string(),
        country_name: "Emergency Services".to_string(),
        emergency_services: "Local Emergency Services (999/911/112)".to_string(),
        emergency_description: "Please call your local emergency service immediately.".to_string(),
        resources: vec![EmergencyResource {
            name: "Befrienders Worldwide".to_string(),
            phone: None,
            text: None,
            website: Some("https://www.befrienders.org".to_string()),
            hours: "24/7".to_string(),
            description: "Confidential emotional support worldwide.".to_string(),
        }],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_crisis_packs_load_correctly() {
        let uk = get_crisis_pack("UK");
        assert_eq!(uk.emergency_services, "999");
        assert!(!uk.resources.is_empty());

        let us = get_crisis_pack("US");
        assert_eq!(us.emergency_services, "911");
        assert!(!us.resources.is_empty());

        let eu = get_crisis_pack("EU");
        assert_eq!(eu.emergency_services, "112");
        assert!(!eu.resources.is_empty());

        let fallback = get_crisis_pack("XYZ");
        assert_eq!(fallback.region, "GLOBAL");
    }
}
