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
    print("RNPingStorage: configure called with config: \(config)")
    let id = RNPingStorageCommon.configure(config)
    print("RNPingStorage: created storage instance \(id)")
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
    print("RNPingStorage: save called with item: \(item)")

    RNPingStorageCommon.save(
      id,
      item: item,
      resolver: { success in
        print("RNPingStorage: Save successful")
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
    print("RNPingStorage: get called")

    RNPingStorageCommon.get(
      id,
      resolver: { item in
        if let item = item {
          print("RNPingStorage: Retrieved json: \(item)")
          resolve(item)
        } else {
          print("RNPingStorage: No data found in storage")
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
  @objc(delete:resolver:rejecter:)
  public func delete(
    _ id: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    print("RNPingStorage: delete called")

    RNPingStorageCommon.delete(
      id,
      resolver: { success in
        print("RNPingStorage: Delete successful")
        resolve(success)
      },
      rejecter: { code, message, error in
        print("RNPingStorage: Error deleting item: \(error.debugDescription)")
        reject(code, message, error)
      }
    )
  }
}
