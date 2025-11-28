import PingStorage
import Foundation

// Registry for multiple storage instances
@available(iOS 16.0.0, *) // Keeping it 16 only for the POC
public class StorageRegistry {
  public static let shared = StorageRegistry()
  private var instances: [String: any Storage<String>] = [:]

  public func create(config: NSDictionary) -> String {
    let id = UUID().uuidString

    let type = config["type"] as? String ?? "encrypted"
    let keyAlias = config["keyAlias"] as? String ?? "com.pingidentity.rnsampleapp.keyalias"
    let cacheStrategyRaw = (config["cacheStrategy"] as? String)?.uppercased()

    let base: any Storage<String>
    switch type.lowercased() {
    case "memory":
      base = MemoryStorage<String>()
    case "encrypted", "datastore":
      base = KeychainStorage<String>(
        account: keyAlias,
        encryptor: NoEncryptor()
      )
    default:
      base = MemoryStorage<String>()
    }

    let finalInstance: any Storage<String>
    if cacheStrategyRaw == "CACHE" {
      finalInstance = StorageDelegate(delegate: base, cacheable: true)
    } else {
      finalInstance = base
    }

    instances[id] = finalInstance
    return id
  }

  public func get(_ id: String) -> (any Storage<String>)? {
    return instances[id]
  }

  public func printAllRegisteredIds() {
    let keys = instances.keys
    print("📦 [StorageRegistry] Registered Storage Instances:")
    if keys.isEmpty {
        print("   — none —")
    } else {
        for key in keys {
            print("   • \(key)")
        }
    }
  }

  public func listIds() -> [String] {
    return Array(instances.keys)
  }
}
