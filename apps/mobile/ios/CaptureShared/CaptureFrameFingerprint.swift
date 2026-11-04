import CoreGraphics

enum CaptureFrameFingerprint {
  // The thumbnail bytes and hash remain in memory and never enter the shared JSON store.
  static func make(_ image: CGImage, width: Int, height: Int, orientation: UInt32) -> UInt64? {
    guard width > 0, height > 0 else { return nil }
    let side = 96
    var pixels = [UInt8](repeating: 0, count: side * side * 4)
    return pixels.withUnsafeMutableBufferPointer { bytes -> UInt64? in
      guard let context = CGContext(data: bytes.baseAddress, width: side, height: side,
        bitsPerComponent: 8, bytesPerRow: side * 4, space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else { return nil }
      context.interpolationQuality = .low
      context.draw(image, in: CGRect(x: 0, y: 0, width: CGFloat(side), height: CGFloat(side)))
      var hash: UInt64 = 14_695_981_039_346_656_037
      for byte in bytes { hash = (hash ^ UInt64(byte)) &* 1_099_511_628_211 }
      for value in [UInt64(width), UInt64(height), UInt64(orientation)] {
        var remaining = value
        for _ in 0..<8 {
          hash = (hash ^ (remaining & 0xff)) &* 1_099_511_628_211
          remaining >>= 8
        }
      }
      return hash
    }
  }
}
