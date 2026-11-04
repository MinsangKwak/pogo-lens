import Foundation

enum PokemonFrameText {
  static func minimalSnippet(_ lines: [String]) -> String? {
    let cp = #"^CP\s*\d{1,5}$"#
    let hp = #"^(?:HP\s*)?\d{1,4}\s*/\s*\d{1,4}\s*(?:HP|체력)?$"#
    let label = #"^(?:공격|방어|체력|평가|Attack|Defense|Stamina|HP|Appraise)$"#
    func matches(_ value: String, _ pattern: String) -> Bool {
      value.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }
    let trimmed = lines.prefix(80).map { String($0.prefix(100)).trimmingCharacters(in: .whitespacesAndNewlines) }
    guard trimmed.contains(where: { matches($0, cp) }),
          trimmed.contains(where: { matches($0, hp) }),
          trimmed.contains(where: { matches($0, #"^(?:공격|방어|평가|Attack|Defense|Appraise)$"#) }) else { return nil }
    let selected = trimmed.filter { matches($0, cp) || matches($0, hp) || matches($0, label) }
    return String(selected.prefix(12).joined(separator: "\n").prefix(500))
  }
}
