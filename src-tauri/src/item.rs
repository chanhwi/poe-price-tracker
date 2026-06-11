//! Parser for PoE2 item text copied to the clipboard (Ctrl+C on a hovered item).
//! Drives the quick "register to watchlist" flow (DESIGN.md §7 / Section 4):
//! unique -> by name, rare/normal -> by base type, plus corrupted state.
//!
//! Supports BOTH the English client and the Korean client (poe.game.daum.net),
//! which localises the field labels and rarity values (e.g. `Rarity: Unique`
//! becomes `아이템 희귀도: 고유`).

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
        let t = s.trim();
        // Korean client (poe.game.daum.net) values.
        match t {
            "일반" => return Rarity::Normal,
            "마법" => return Rarity::Magic,
            "희귀" => return Rarity::Rare,
            "고유" => return Rarity::Unique,
            "젬" => return Rarity::Gem,
            "화폐" => return Rarity::Currency,
            "점술 카드" => return Rarity::DivinationCard,
            _ => {}
        }
        // English client values.
        match t.to_ascii_lowercase().as_str() {
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

// Field labels for both the English and Korean (poe.game.daum.net) clients.
const ITEM_CLASS_LABELS: &[&str] = &["Item Class:", "아이템 종류:"];
const RARITY_LABELS: &[&str] = &["Rarity:", "아이템 희귀도:"];
const ITEM_LEVEL_LABELS: &[&str] = &["Item Level:", "아이템 레벨:"];
const QUALITY_LABELS: &[&str] = &["Quality:", "품질:"];

/// Strip the first matching prefix from `line`, returning the remainder.
fn strip_any<'a>(line: &'a str, prefixes: &[&str]) -> Option<&'a str> {
    prefixes.iter().find_map(|p| line.strip_prefix(p))
}

/// A standalone "this item is corrupted" line, in either language.
fn is_corrupted_line(line: &str) -> bool {
    let t = line.trim();
    t == "Corrupted" || t.starts_with("타락")
}

/// Parse the in-game "Copy Item" clipboard text. Returns None if the text is
/// not a PoE item (no rarity line in any supported language).
pub fn parse_item(text: &str) -> Option<ParsedItem> {
    let lines: Vec<&str> = text
        .lines()
        .map(|l| l.trim_end_matches('\r').trim_end())
        .collect();

    let mut item_class: Option<String> = None;
    let mut rarity = Rarity::Other;
    let mut rarity_idx: Option<usize> = None;

    for (i, line) in lines.iter().enumerate() {
        if let Some(rest) = strip_any(line, ITEM_CLASS_LABELS) {
            item_class = Some(rest.trim().to_string());
        }
        if let Some(rest) = strip_any(line, RARITY_LABELS) {
            rarity = Rarity::parse(rest);
            rarity_idx = Some(i);
            break;
        }
    }
    let rarity_idx = rarity_idx?; // not PoE item text

    // Header block: non-empty lines after the rarity line up to the first separator.
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

    let corrupted = lines.iter().any(|l| is_corrupted_line(l));
    let item_level = find_numeric(&lines, ITEM_LEVEL_LABELS);
    let quality = find_numeric(&lines, QUALITY_LABELS);

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

/// Extract the first run of digits following any of the given `prefix:` lines,
/// e.g. "Item Level: 81" / "아이템 레벨: 81" -> 81,
/// "Quality: +20% (augmented)" / "품질: +20%" -> 20.
fn find_numeric(lines: &[&str], prefixes: &[&str]) -> Option<u32> {
    for line in lines {
        if let Some(rest) = strip_any(line, prefixes) {
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

    // Real captures from the Korean client (poe.game.daum.net), trimmed.
    const KR_UNIQUE: &str = "아이템 종류: 허리띠\r\n아이템 희귀도: 고유\r\n심야의 끈\r\n생가죽 허리띠\r\n--------\r\n아이템 레벨: 80\r\n--------\r\n마나 최대치 +49\r\n--------\r\n";
    const KR_UNIQUE_GLOVES: &str = "아이템 종류: 장갑\r\n아이템 희귀도: 고유\r\n도이드리의 임기\r\n꿰맨 장갑\r\n--------\r\n에너지 보호막: 41 (augmented)\r\n--------\r\n요구 사항: 레벨 16, 22 지능\r\n--------\r\n아이템 레벨: 76\r\n--------\r\n";
    const KR_CURRENCY: &str = "아이템 종류: 미가공 보조 젬\r\n아이템 희귀도: 화폐\r\n미가공 보조 젬 (3레벨)\r\n--------\r\n";

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

    // ---- Korean client ----

    #[test]
    fn parses_kr_unique_by_name() {
        let it = parse_item(KR_UNIQUE).unwrap();
        assert_eq!(it.rarity, Rarity::Unique);
        assert_eq!(it.item_class.as_deref(), Some("허리띠"));
        assert_eq!(it.name.as_deref(), Some("심야의 끈"));
        assert_eq!(it.base_type.as_deref(), Some("생가죽 허리띠"));
        assert_eq!(it.item_level, Some(80));
        assert!(it.register_by_name);
        assert_eq!(it.register_term.as_deref(), Some("심야의 끈"));
    }

    #[test]
    fn parses_kr_unique_gloves() {
        let it = parse_item(KR_UNIQUE_GLOVES).unwrap();
        assert_eq!(it.rarity, Rarity::Unique);
        assert_eq!(it.name.as_deref(), Some("도이드리의 임기"));
        assert_eq!(it.base_type.as_deref(), Some("꿰맨 장갑"));
        assert_eq!(it.item_level, Some(76));
        assert_eq!(it.register_term.as_deref(), Some("도이드리의 임기"));
    }

    #[test]
    fn parses_kr_currency_by_name() {
        let it = parse_item(KR_CURRENCY).unwrap();
        assert_eq!(it.rarity, Rarity::Currency);
        assert_eq!(it.name.as_deref(), Some("미가공 보조 젬 (3레벨)"));
        assert!(it.register_by_name);
        assert_eq!(it.register_term.as_deref(), Some("미가공 보조 젬 (3레벨)"));
    }
}
