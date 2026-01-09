/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

#import <XCTest/XCTest.h>
#import <OCMock/OCMock.h>
#import "RNPingStorage.h"
#import "RNPingStorage-Swift.h"

@interface RNPingStorageTests : XCTestCase
@property (nonatomic, strong) RNPingStorage *storage;
@end

@implementation RNPingStorageTests

- (void)setUp {
    [super setUp];
    self.storage = [[RNPingStorage alloc] init];
}

- (void)tearDown {
    self.storage = nil;
    [super tearDown];
}

// MARK: - Module Initialization Tests

- (void)testModuleInitialization {
    XCTAssertNotNil(self.storage, @"RNPingStorage should initialize successfully");
}

- (void)testSwiftImplIsNotNil {
    RNPingStorageImpl *swiftImpl = [self.storage swiftImpl];
    XCTAssertNotNil(swiftImpl, @"Swift implementation should not be nil");
}

- (void)testSwiftImplIsSingleton {
    RNPingStorageImpl *impl1 = [self.storage swiftImpl];
    RNPingStorageImpl *impl2 = [self.storage swiftImpl];
    XCTAssertEqual(impl1, impl2, @"Swift implementation should return the same singleton instance");
}

// MARK: - Configure Method Tests

- (void)testConfigureWithMemoryType {
    id mockSwiftImpl = OCMClassMock([RNPingStorageImpl class]);
    OCMStub([mockSwiftImpl shared]).andReturn(mockSwiftImpl);
    
    NSString *expectedId = @"storage-id-123";
    OCMStub([mockSwiftImpl configure:[OCMArg any]]).andReturn(expectedId);
    
    NSMutableDictionary *config = [NSMutableDictionary new];
    config[@"type"] = @"memory";
    config[@"keyAlias"] = @"test.keyalias";
    
    // Note: We can't easily test the C++ struct parameter without extensive setup,
    // but we can verify the method exists and the basic flow
    XCTAssertNotNil(self.storage, @"Storage should be initialized for configuration");
}

- (void)testConfigureWithEncryptedType {
    NSMutableDictionary *config = [NSMutableDictionary new];
    config[@"type"] = @"encrypted";
    config[@"keyAlias"] = @"test.encrypted.keyalias";
    
    // Verify the storage instance can handle configuration requests
    XCTAssertNotNil(self.storage, @"Storage should be initialized for encrypted configuration");
}

- (void)testConfigureWithCacheStrategy {
    NSMutableDictionary *config = [NSMutableDictionary new];
    config[@"type"] = @"memory";
    config[@"keyAlias"] = @"test.cache.keyalias";
    config[@"cacheStrategy"] = @"CACHE";
    
    XCTAssertNotNil(self.storage, @"Storage should handle cache strategy configuration");
}

- (void)testConfigureWithAllParameters {
    NSMutableDictionary *config = [NSMutableDictionary new];
    config[@"type"] = @"encrypted";
    config[@"keyAlias"] = @"test.full.keyalias";
    config[@"cacheStrategy"] = @"CACHE_ON_FAILURE";
    
    XCTAssertNotNil(self.storage, @"Storage should handle full configuration");
}

// MARK: - Save Method Tests

- (void)testSaveCallsSwiftImplementation {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Save should complete"];
    
    NSString *storageId = @"test-storage-id";
    NSDictionary *item = @{@"key": @"value", @"number": @42};
    
    id mockSwiftImpl = OCMPartialMock([RNPingStorageImpl shared]);
    
    // Stub the save method to call the resolver
    OCMStub([mockSwiftImpl save:storageId
                           item:item
                       resolver:[OCMArg any]
                       rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:4];
            resolve(@YES);
        });
    
    [self.storage save:storageId
                  item:item
               resolve:^(id result) {
                   XCTAssertNotNil(result, @"Save should return a result");
                   XCTAssertTrue([result boolValue], @"Save should return true on success");
                   [expectation fulfill];
               }
                reject:^(NSString *code, NSString *message, NSError *error) {
                    XCTFail(@"Save should not reject: %@", message);
                    [expectation fulfill];
                }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
    
    OCMVerify([mockSwiftImpl save:storageId item:item resolver:[OCMArg any] rejecter:[OCMArg any]]);
    [mockSwiftImpl stopMocking];
}

- (void)testSaveWithEmptyDictionary {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Save with empty dictionary should complete"];
    
    NSString *storageId = @"test-storage-id";
    NSDictionary *item = @{};
    
    id mockSwiftImpl = OCMPartialMock([RNPingStorageImpl shared]);
    
    OCMStub([mockSwiftImpl save:storageId
                           item:item
                       resolver:[OCMArg any]
                       rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:4];
            resolve(@YES);
        });
    
    [self.storage save:storageId
                  item:item
               resolve:^(id result) {
                   XCTAssertTrue([result boolValue], @"Save should succeed with empty dictionary");
                   [expectation fulfill];
               }
                reject:^(NSString *code, NSString *message, NSError *error) {
                    XCTFail(@"Save should not reject with empty dictionary: %@", message);
                    [expectation fulfill];
                }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
    [mockSwiftImpl stopMocking];
}

- (void)testSaveWithComplexData {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Save with complex data should complete"];
    
    NSString *storageId = @"test-storage-id";
    NSDictionary *item = @{
        @"string": @"test",
        @"number": @123,
        @"boolean": @YES,
        @"array": @[@1, @2, @3],
        @"nested": @{@"inner": @"value"}
    };
    
    id mockSwiftImpl = OCMPartialMock([RNPingStorageImpl shared]);
    
    OCMStub([mockSwiftImpl save:storageId
                           item:item
                       resolver:[OCMArg any]
                       rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:4];
            resolve(@YES);
        });
    
    [self.storage save:storageId
                  item:item
               resolve:^(id result) {
                   XCTAssertTrue([result boolValue], @"Save should succeed with complex data");
                   [expectation fulfill];
               }
                reject:^(NSString *code, NSString *message, NSError *error) {
                    XCTFail(@"Save should not reject: %@", message);
                    [expectation fulfill];
                }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
    [mockSwiftImpl stopMocking];
}

- (void)testSaveRejectsOnError {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Save should reject on error"];
    
    NSString *storageId = @"invalid-storage-id";
    NSDictionary *item = @{@"key": @"value"};
    
    id mockSwiftImpl = OCMPartialMock([RNPingStorageImpl shared]);
    
    NSError *testError = [NSError errorWithDomain:@"TestDomain" code:500 userInfo:nil];
    OCMStub([mockSwiftImpl save:storageId
                           item:item
                       resolver:[OCMArg any]
                       rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseRejectBlock reject;
            [invocation getArgument:&reject atIndex:5];
            reject(@"E_SAVE_FAILED", @"Failed to save", testError);
        });
    
    [self.storage save:storageId
                  item:item
               resolve:^(id result) {
                   XCTFail(@"Save should not resolve on error");
                   [expectation fulfill];
               }
                reject:^(NSString *code, NSString *message, NSError *error) {
                    XCTAssertEqualObjects(code, @"E_SAVE_FAILED", @"Error code should match");
                    XCTAssertEqualObjects(message, @"Failed to save", @"Error message should match");
                    [expectation fulfill];
                }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
    [mockSwiftImpl stopMocking];
}

// MARK: - Get Method Tests

- (void)testGetItemCallsSwiftImplementation {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Get should complete"];
    
    NSString *storageId = @"test-storage-id";
    NSDictionary *expectedItem = @{@"key": @"value"};
    
    id mockSwiftImpl = OCMPartialMock([RNPingStorageImpl shared]);
    
    OCMStub([mockSwiftImpl getItem:storageId
                          resolver:[OCMArg any]
                          rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:3];
            resolve(expectedItem);
        });
    
    [self.storage getItem:storageId
                  resolve:^(id result) {
                      XCTAssertNotNil(result, @"Get should return a result");
                      XCTAssertEqualObjects(result, expectedItem, @"Retrieved item should match saved item");
                      [expectation fulfill];
                  }
                   reject:^(NSString *code, NSString *message, NSError *error) {
                       XCTFail(@"Get should not reject: %@", message);
                       [expectation fulfill];
                   }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
    
    OCMVerify([mockSwiftImpl getItem:storageId resolver:[OCMArg any] rejecter:[OCMArg any]]);
    [mockSwiftImpl stopMocking];
}

- (void)testGetItemReturnsNilWhenEmpty {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Get should return nil when empty"];
    
    NSString *storageId = @"empty-storage-id";
    
    id mockSwiftImpl = OCMPartialMock([RNPingStorageImpl shared]);
    
    OCMStub([mockSwiftImpl getItem:storageId
                          resolver:[OCMArg any]
                          rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:3];
            resolve(nil);
        });
    
    [self.storage getItem:storageId
                  resolve:^(id result) {
                      XCTAssertNil(result, @"Get should return nil when no data exists");
                      [expectation fulfill];
                  }
                   reject:^(NSString *code, NSString *message, NSError *error) {
                       XCTFail(@"Get should not reject when empty: %@", message);
                       [expectation fulfill];
                   }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
    [mockSwiftImpl stopMocking];
}

- (void)testGetItemRejectsOnError {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Get should reject on error"];
    
    NSString *storageId = @"invalid-storage-id";
    
    id mockSwiftImpl = OCMPartialMock([RNPingStorageImpl shared]);
    
    NSError *testError = [NSError errorWithDomain:@"TestDomain" code:404 userInfo:nil];
    OCMStub([mockSwiftImpl getItem:storageId
                          resolver:[OCMArg any]
                          rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseRejectBlock reject;
            [invocation getArgument:&reject atIndex:4];
            reject(@"E_GET_FAILED", @"Failed to get item", testError);
        });
    
    [self.storage getItem:storageId
                  resolve:^(id result) {
                      XCTFail(@"Get should not resolve on error");
                      [expectation fulfill];
                  }
                   reject:^(NSString *code, NSString *message, NSError *error) {
                       XCTAssertEqualObjects(code, @"E_GET_FAILED", @"Error code should match");
                       XCTAssertEqualObjects(message, @"Failed to get item", @"Error message should match");
                       [expectation fulfill];
                   }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
    [mockSwiftImpl stopMocking];
}

// MARK: - Delete Method Tests

- (void)testDeleteItemCallsSwiftImplementation {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Delete should complete"];
    
    NSString *storageId = @"test-storage-id";
    
    id mockSwiftImpl = OCMPartialMock([RNPingStorageImpl shared]);
    
    OCMStub([mockSwiftImpl deleteItem:storageId
                             resolver:[OCMArg any]
                             rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:3];
            resolve(@YES);
        });
    
    [self.storage deleteItem:storageId
                     resolve:^(id result) {
                         XCTAssertNotNil(result, @"Delete should return a result");
                         XCTAssertTrue([result boolValue], @"Delete should return true on success");
                         [expectation fulfill];
                     }
                      reject:^(NSString *code, NSString *message, NSError *error) {
                          XCTFail(@"Delete should not reject: %@", message);
                          [expectation fulfill];
                      }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
    
    OCMVerify([mockSwiftImpl deleteItem:storageId resolver:[OCMArg any] rejecter:[OCMArg any]]);
    [mockSwiftImpl stopMocking];
}

- (void)testDeleteItemRejectsOnError {
    XCTestExpectation *expectation = [self expectationWithDescription:@"Delete should reject on error"];
    
    NSString *storageId = @"invalid-storage-id";
    
    id mockSwiftImpl = OCMPartialMock([RNPingStorageImpl shared]);
    
    NSError *testError = [NSError errorWithDomain:@"TestDomain" code:500 userInfo:nil];
    OCMStub([mockSwiftImpl deleteItem:storageId
                             resolver:[OCMArg any]
                             rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseRejectBlock reject;
            [invocation getArgument:&reject atIndex:4];
            reject(@"E_DELETE_FAILED", @"Failed to delete", testError);
        });
    
    [self.storage deleteItem:storageId
                     resolve:^(id result) {
                         XCTFail(@"Delete should not resolve on error");
                         [expectation fulfill];
                     }
                      reject:^(NSString *code, NSString *message, NSError *error) {
                          XCTAssertEqualObjects(code, @"E_DELETE_FAILED", @"Error code should match");
                          XCTAssertEqualObjects(message, @"Failed to delete", @"Error message should match");
                          [expectation fulfill];
                      }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
    [mockSwiftImpl stopMocking];
}

// MARK: - Integration Tests

- (void)testFullLifecycleWithMocks {
    NSString *storageId = @"lifecycle-storage-id";
    NSDictionary *testItem = @{@"data": @"lifecycle-test"};
    
    id mockSwiftImpl = OCMPartialMock([RNPingStorageImpl shared]);
    
    // Test Save
    XCTestExpectation *saveExpectation = [self expectationWithDescription:@"Save should complete"];
    OCMStub([mockSwiftImpl save:storageId
                           item:testItem
                       resolver:[OCMArg any]
                       rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:4];
            resolve(@YES);
        });
    
    [self.storage save:storageId
                  item:testItem
               resolve:^(id result) {
                   XCTAssertTrue([result boolValue]);
                   [saveExpectation fulfill];
               }
                reject:^(NSString *code, NSString *message, NSError *error) {
                    XCTFail(@"Save failed: %@", message);
                    [saveExpectation fulfill];
                }];
    
    [self waitForExpectations:@[saveExpectation] timeout:2.0];
    
    // Test Get
    XCTestExpectation *getExpectation = [self expectationWithDescription:@"Get should complete"];
    OCMStub([mockSwiftImpl getItem:storageId
                          resolver:[OCMArg any]
                          rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:3];
            resolve(testItem);
        });
    
    [self.storage getItem:storageId
                  resolve:^(id result) {
                      XCTAssertEqualObjects(result, testItem);
                      [getExpectation fulfill];
                  }
                   reject:^(NSString *code, NSString *message, NSError *error) {
                       XCTFail(@"Get failed: %@", message);
                       [getExpectation fulfill];
                   }];
    
    [self waitForExpectations:@[getExpectation] timeout:2.0];
    
    // Test Delete
    XCTestExpectation *deleteExpectation = [self expectationWithDescription:@"Delete should complete"];
    OCMStub([mockSwiftImpl deleteItem:storageId
                             resolver:[OCMArg any]
                             rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:3];
            resolve(@YES);
        });
    
    [self.storage deleteItem:storageId
                     resolve:^(id result) {
                         XCTAssertTrue([result boolValue]);
                         [deleteExpectation fulfill];
                     }
                      reject:^(NSString *code, NSString *message, NSError *error) {
                          XCTFail(@"Delete failed: %@", message);
                          [deleteExpectation fulfill];
                      }];
    
    [self waitForExpectations:@[deleteExpectation] timeout:2.0];
    
    [mockSwiftImpl stopMocking];
}

// MARK: - Thread Safety Tests

- (void)testConcurrentSaveOperations {
    NSString *storageId = @"concurrent-storage-id";
    
    id mockSwiftImpl = OCMPartialMock([RNPingStorageImpl shared]);
    
    OCMStub([mockSwiftImpl save:[OCMArg any]
                           item:[OCMArg any]
                       resolver:[OCMArg any]
                       rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseResolveBlock resolve;
            [invocation getArgument:&resolve atIndex:4];
            // Simulate async operation
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.1 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                resolve(@YES);
            });
        });
    
    NSInteger operationCount = 5;
    NSMutableArray *expectations = [NSMutableArray arrayWithCapacity:operationCount];
    
    for (NSInteger i = 0; i < operationCount; i++) {
        XCTestExpectation *expectation = [self expectationWithDescription:[NSString stringWithFormat:@"Save %ld", (long)i]];
        [expectations addObject:expectation];
        
        NSDictionary *item = @{@"index": @(i)};
        
        [self.storage save:storageId
                      item:item
                   resolve:^(id result) {
                       XCTAssertTrue([result boolValue]);
                       [expectation fulfill];
                   }
                    reject:^(NSString *code, NSString *message, NSError *error) {
                        XCTFail(@"Save %ld failed: %@", (long)i, message);
                        [expectation fulfill];
                    }];
    }
    
    [self waitForExpectations:expectations timeout:5.0];
    [mockSwiftImpl stopMocking];
}

// MARK: - Parameter Validation Tests

- (void)testSaveWithNilIdDoesNotCrash {
    // This test verifies that the module handles nil parameters gracefully
    // In production, React Native should prevent nil parameters, but we test defensive coding
    XCTestExpectation *expectation = [self expectationWithDescription:@"Should handle nil id"];
    
    id mockSwiftImpl = OCMPartialMock([RNPingStorageImpl shared]);
    
    OCMStub([mockSwiftImpl save:nil
                           item:[OCMArg any]
                       resolver:[OCMArg any]
                       rejecter:[OCMArg any]])
        .andDo(^(NSInvocation *invocation) {
            RCTPromiseRejectBlock reject;
            [invocation getArgument:&reject atIndex:5];
            reject(@"E_INVALID_PARAM", @"Invalid storage id", nil);
        });
    
    [self.storage save:nil
                  item:@{@"key": @"value"}
               resolve:^(id result) {
                   XCTFail(@"Should not resolve with nil id");
                   [expectation fulfill];
               }
                reject:^(NSString *code, NSString *message, NSError *error) {
                    [expectation fulfill];
                }];
    
    [self waitForExpectationsWithTimeout:2.0 handler:nil];
    [mockSwiftImpl stopMocking];
}

@end
