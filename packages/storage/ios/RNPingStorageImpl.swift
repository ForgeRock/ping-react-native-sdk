import Foundation
import PingStorage
import React
import RNPingCore

@available(iOS 16.0.0, *)
@objcMembers
public class RNPingStorageImpl: NSObject {

  @objc public static let shared = RNPingStorageImpl()

  @objc private override init() {
    super.init()
  }

  // MARK: - Configure
  @objc
  public func configure(_ config: NSDictionary) -> String {
    let id = RNPingStorageCommon.configure(config)
    return id
  }

  // MARK: - Save
  @objc(save:item:resolver:rejecter:)
  public func save(
    _ id: String,
    item: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    RNPingStorageCommon.save(
      id,
      item: item,
      resolver: { success in
        resolve(success)
      },
      rejecter: { code, message, error in
        print("RNPingStorage: Error saving item: \(error.debugDescription)")
        reject(code, message, error)
      }
    )
  }

  // MARK: - Get
  @objc(getItem:resolver:rejecter:)
  public func getItem(
    _ id: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    RNPingStorageCommon.getItem(
      id,
      resolver: { item in
        if let item = item {
          resolve(item)
        } else {
          resolve(nil)
        }
      },
      rejecter: { code, message, error in
        print("RNPingStorage: Error getting item: \(error.debugDescription)")
        reject(code, message, error)
      }
    )
  }

  // MARK: - Remove
  @objc(deleteItem:resolver:rejecter:)
  public func deleteItem(
    _ id: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    RNPingStorageCommon.deleteItem(
      id,
      resolver: { success in
        resolve(success)
      },
      rejecter: { code, message, error in
        print("RNPingStorage: Error deleting item: \(error.debugDescription)")
        reject(code, message, error)
      }
    )
  }
}
