//! Parser for PoE2 item text copied to the clipboard (Ctrl+C on a hovered item).
//! Drives the quick "register to watchlist" flow (DESIGN.md §7 / Section 4):
//! unique -> by name, rare/normal -> by base type, plus corrupted state.

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Rarity {
    Normal,
    Magic,
    Rare,
    Unique,
    Gem,
    Currency,
    DivinationCard,
    Other,
}

impl Rarity {
    fn parse(s: &str) -> Rarity {
        match s.trim().to_ascii_lowercase().as_str() {
            "normal" => Rarity::Normal,
            "magic" => Rarity::Magic,
            "rare" => Rarity::Rare,
            "unique" => Rarity::Unique,
            "gem" => Rarity::Gem,
            "currency" => Rarity::Currency,
            "divination card" => Rarity::DivinationCard,
            _ => Rarity::Other,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ParsedItem {
    pub item_class: Option<String>,
    pub rarity: Rarity,
    /// Display name (unique/rare/magic/currency). None for plain Normal items.
    pub name: Option<String>,
    /// Base type. For Unique/Rare it's the 2nd header line; for Normal the 1st.
    /// For Magic the base is embedded in `name`, so this is left None.
    pub base_type: Option<String>,
    pub corrupted: bool,
    pub item_level: Option<u32>,
    pub quality: Option<u32>,
    /// The term to register on the watchlist, per the rule below.
    pub register_term: Option<String>,
    /// True if `register_term` is a unique/currency NAME, false if a base type.
    pub register_by_name: bool,
}

const SEP: &str = "--------";

/// Parse the in-game "Copy Item" clipboard text. Returns None if the text is
/// not a PoE item (no `Rarity:` line).
pub fn parse_item(text: &str) -> Option<ParsedItem> {
    let lines: Vec<&str> = text
        .lines()
        .map(|l| l.trim_end_matches('\r').trim_end())
        .collect();

    let mut item_class: Option<String> = None;
    let mut rarity = Rarity::Other;
    let mut rarity_idx: Option<usize> = None;

    for (i, line) in lines.iter().enumerate() {
        if let Some(rest) = line.strip_prefix("Item Class:") {
            item_class = Some(rest.trim().to_string());
        }
        if let Some(rest) = line.strip_prefix("Rarity:") {
            rarity = Rarity::parse(rest);
            rarity_idx = Some(i);
            break;
        }
    }
    let rarity_idx = rarity_idx?; // not PoE item text

    // Header block: non-empty lines after "Rarity:" up to the first separator.
    let header: Vec<&str> = lines[rarity_idx + 1..]
        .iter()
        .take_while(|l| **l != SEP)
        .filter(|l| !l.is_empty())
        .copied()
        .collect();

    let (name, base_type) = match rarity {
        Rarity::Unique | Rarity::Rare => (
            header.first().map(|s| s.to_string()),
            header.get(1).map(|s| s.to_string()),
        ),
        Rarity::Normal => (None, header.first().map(|s| s.to_string())),
        // magic (base embedded in name), currency, gem, div card, other
        _ => (header.first().map(|s| s.to_string()), None),
    };

    let corrupted = lines.iter().any(|l| *l == "Corrupted");
    let item_level = find_numeric(&lines, "Item Level:");
    let quality = find_numeric(&lines, "Quality:");

    // Registration rule (DESIGN.md §7 / user decision): unique & name-identity
    // items register by name; rare/normal register by base type.
    let register_by_name = !matches!(rarity, Rarity::Rare | Rarity::Normal);
    let register_term = if register_by_name {
        name.clone().or_else(|| base_type.clone())
    } else {
        base_type.clone().or_else(|| name.clone())
    };

    Some(ParsedItem {
        item_class,
        rarity,
        name,
        base_type,
        corrupted,
        item_level,
        quality,
        register_term,
        register_by_name,
    })
}

/// Extract the first run of digits following a `prefix:` line, e.g.
/// "Item Level: 81" -> 81, "Quality: +20% (augmented)" -> 20.
fn find_numeric(lines: &[&str], prefix: &str) -> Option<u32> {
    for line in lines {
        if let Some(rest) = line.strip_prefix(prefix) {
            let digits: String = rest
                .chars()
                .skip_while(|c| !c.is_ascii_digit())
                .take_while(|c| c.is_ascii_digit())
                .collect();
            if let Ok(n) = digits.parse::<u32>() {
                return Some(n);
            }
        }
    }
    None
}

/// Tauri command: parse clipboard item text (used for testing / the hotkey flow).
#[tauri::command]
pub fn parse_item_text(text: String) -> Option<ParsedItem> {
    parse_item(&text)
}

#[cfg(test)]
mod tests {
    use super::*;

    const RARE: &str = "Item Class: Gloves\r\nRarity: Rare\r\nGale Grip\r\nStellar Gauntlets\r\n--------\r\nQuality: +20% (augmented)\r\n--------\r\nRequirements:\r\nLevel: 65\r\n--------\r\nItem Level: 81\r\n--------\r\n+25 to maximum Life\r\n--------\r\nCorrupted\r\n";
    const UNIQUE: &str = "Item Class: Body Armours\r\nRarity: Unique\r\nTabula Rasa\r\nSimple Robe\r\n--------\r\nItem Level: 50\r\n--------\r\n";
    const NORMAL: &str = "Item Class: Boots\r\nRarity: Normal\r\nIron Greaves\r\n--------\r\nItem Level: 70\r\n";
    const MAGIC: &str = "Item Class: Rings\r\nRarity: Magic\r\nJade Ring of the Wind\r\n--------\r\nItem Level: 72\r\n";
    const CURRENCY: &str = "Item Class: Stackable Currency\r\nRarity: Currency\r\nDivine Orb\r\n--------\r\nStack Size: 3/10\r\n--------\r\n";

    #[test]
    fn parses_rare_by_base_type() {
        let it = parse_item(RARE).unwrap();
        assert_eq!(it.rarity, Rarity::Rare);
        assert_eq!(it.item_class.as_deref(), Some("Gloves"));
        assert_eq!(it.name.as_deref(), Some("Gale Grip"));
        assert_eq!(it.base_type.as_deref(), Some("Stellar Gauntlets"));
        assert!(it.corrupted);
        assert_eq!(it.item_level, Some(81));
        assert_eq!(it.quality, Some(20));
        assert!(!it.register_by_name);
        assert_eq!(it.register_term.as_deref(), Some("Stellar Gauntlets"));
    }

    #[test]
    fn parses_unique_by_name() {
        let it = parse_item(UNIQUE).unwrap();
        assert_eq!(it.rarity, Rarity::Unique);
        assert_eq!(it.name.as_deref(), Some("Tabula Rasa"));
        assert_eq!(it.base_type.as_deref(), Some("Simple Robe"));
        assert!(!it.corrupted);
        assert!(it.register_by_name);
        assert_eq!(it.register_term.as_deref(), Some("Tabula Rasa"));
    }

    #[test]
    fn parses_normal_by_base_type() {
        let it = parse_item(NORMAL).unwrap();
        assert_eq!(it.rarity, Rarity::Normal);
        assert_eq!(it.name, None);
        assert_eq!(it.base_type.as_deref(), Some("Iron Greaves"));
        assert!(!it.register_by_name);
        assert_eq!(it.register_term.as_deref(), Some("Iron Greaves"));
    }

    #[test]
    fn parses_magic_by_name() {
        let it = parse_item(MAGIC).unwrap();
        assert_eq!(it.rarity, Rarity::Magic);
        assert_eq!(it.name.as_deref(), Some("Jade Ring of the Wind"));
        assert_eq!(it.base_type, None);
        assert!(it.register_by_name);
    }

    #[test]
    fn parses_currency_by_name() {
        let it = parse_item(CURRENCY).unwrap();
        assert_eq!(it.rarity, Rarity::Currency);
        assert_eq!(it.name.as_deref(), Some("Divine Orb"));
        assert!(it.register_by_name);
        assert_eq!(it.register_term.as_deref(), Some("Divine Orb"));
    }

    #[test]
    fn rejects_non_item_text() {
        assert!(parse_item("just random clipboard text").is_none());
        assert!(parse_item("").is_none());
    }
}
